import { query, queryOne, execute } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const CURRENCY = 'KUDOS';
const INITIAL_BALANCE = 100;
const PURSE_FEE = 0;
const PURSE_TIMEOUT_HOURS = 24;

export interface TalerWallet {
  id: string;
  user_id: string;
  wallet_pub: string;
  wallet_priv: string;
  balance: string;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface TalerPurse {
  id: string;
  purse_pub: string;
  purse_priv: string;
  amount: string;
  currency: string;
  contract_hash: string | null;
  sender_wallet_id: string;
  receiver_wallet_id: string | null;
  status: string;
  created_at: string;
  expires_at: string;
  merged_at: string | null;
}

export interface TalerTransaction {
  id: string;
  purse_id: string | null;
  from_wallet_id: string;
  to_wallet_id: string;
  amount: string;
  currency: string;
  contract_hash: string | null;
  status: string;
  description: string | null;
  created_at: string;
}

function generateKeyPair(): { pub: string; priv: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    pub: publicKey.export({ type: 'spki', format: 'der' }).toString('hex'),
    priv: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('hex'),
  };
}

function generatePurseKeyPair(): { pub: string; priv: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    pub: publicKey.export({ type: 'spki', format: 'der' }).toString('hex'),
    priv: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('hex'),
  };
}

function sha512(data: string): string {
  return crypto.createHash('sha512').update(data).digest('hex');
}

function parseAmount(amount: string): number {
  const parts = amount.split(':');
  if (parts.length === 2) {
    return parseFloat(parts[0]);
  }
  return parseFloat(amount);
}

function formatAmount(value: number): string {
  return `${value.toFixed(2)}:${CURRENCY}`;
}

export class TalerService {
  async createWallet(userId: string): Promise<TalerWallet> {
    const existing = await queryOne<TalerWallet>(
      'SELECT * FROM taler_wallets WHERE user_id = $1',
      [userId]
    );

    if (existing) {
      return existing;
    }

    const keyPair = generateKeyPair();
    const wallet = await queryOne<TalerWallet>(
      `INSERT INTO taler_wallets (user_id, wallet_pub, wallet_priv, balance, currency)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, keyPair.pub, keyPair.priv, INITIAL_BALANCE.toString(), CURRENCY]
    );

    logger.info(`Taler wallet created for user ${userId} with ${INITIAL_BALANCE} ${CURRENCY}`);

    await this.logTransaction({
      purseId: null,
      fromWalletId: 'system',
      toWalletId: wallet!.id,
      amount: INITIAL_BALANCE,
      contractHash: null,
      status: 'completed',
      description: `Initial ${CURRENCY} deposit`,
    });

    return wallet!;
  }

  async getWallet(userId: string): Promise<TalerWallet> {
    let wallet = await queryOne<TalerWallet>(
      'SELECT * FROM taler_wallets WHERE user_id = $1',
      [userId]
    );

    if (!wallet) {
      wallet = await this.createWallet(userId);
    }

    return wallet;
  }

  async getBalance(userId: string): Promise<{ balance: number; currency: string }> {
    const wallet = await this.getWallet(userId);
    return {
      balance: parseAmount(wallet.balance),
      currency: wallet.currency,
    };
  }

  async createPurse(
    senderUserId: string,
    receiverUserId: string,
    amount: number,
    contractHash?: string,
    _description?: string
  ): Promise<TalerPurse> {
    if (amount <= 0) {
      throw new AppError('Amount must be positive', 400);
    }

    const senderWallet = await this.getWallet(senderUserId);
    const senderBalance = parseAmount(senderWallet.balance);

    if (senderBalance < amount) {
      throw new AppError('Insufficient balance', 400);
    }

    const receiverWallet = await this.getWallet(receiverUserId);
    const purseKeys = generatePurseKeyPair();
    const contractHashValue = contractHash || sha512(`${senderUserId}-${receiverUserId}-${amount}-${Date.now()}`);
    const expiresAt = new Date(Date.now() + PURSE_TIMEOUT_HOURS * 60 * 60 * 1000);

    const purse = await queryOne<TalerPurse>(
      `INSERT INTO taler_purses (purse_pub, purse_priv, amount, currency, contract_hash,
        sender_wallet_id, receiver_wallet_id, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'created', $8)
       RETURNING *`,
      [
        purseKeys.pub,
        purseKeys.priv,
        amount.toString(),
        CURRENCY,
        contractHashValue,
        senderWallet.id,
        receiverWallet.id,
        expiresAt.toISOString(),
      ]
    );

    logger.info(`Purse ${purse!.id} created: ${amount} ${CURRENCY} from ${senderUserId} to ${receiverUserId}`);

    return purse!;
  }

  async depositToPurse(
    purseId: string,
    senderUserId: string
  ): Promise<{ purse: TalerPurse; transaction: TalerTransaction }> {
    const purse = await queryOne<TalerPurse>(
      'SELECT * FROM taler_purses WHERE id = $1',
      [purseId]
    );

    if (!purse) {
      throw new AppError('Purse not found', 404);
    }

    if (purse.status !== 'created') {
      throw new AppError(`Purse is in status '${purse.status}', cannot deposit`, 400);
    }

    if (new Date(purse.expires_at) < new Date()) {
      await execute(
        "UPDATE taler_purses SET status = 'expired' WHERE id = $1",
        [purseId]
      );
      throw new AppError('Purse has expired', 410);
    }

    const senderWallet = await queryOne<TalerWallet>(
      'SELECT * FROM taler_wallets WHERE id = $1',
      [purse.sender_wallet_id]
    );

    if (!senderWallet) {
      throw new AppError('Sender wallet not found', 404);
    }

    const amount = parseAmount(purse.amount);
    const senderBalance = parseAmount(senderWallet.balance);

    if (senderBalance < amount) {
      throw new AppError('Insufficient balance', 400);
    }

    await execute(
      'UPDATE taler_wallets SET balance = (CAST(balance AS NUMERIC) - $1)::TEXT, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [amount, senderWallet.id]
    );

    await execute(
      "UPDATE taler_purses SET status = 'funded' WHERE id = $1",
      [purseId]
    );

    const transaction = await this.logTransaction({
      purseId: purse.id,
      fromWalletId: senderWallet.id,
      toWalletId: purse.receiver_wallet_id || 'escrow',
      amount,
      contractHash: purse.contract_hash,
      status: 'completed',
      description: `Purse deposit: ${amount} ${CURRENCY}`,
    });

    const updatedPurse = await queryOne<TalerPurse>(
      'SELECT * FROM taler_purses WHERE id = $1',
      [purseId]
    );

    logger.info(`Purse ${purseId} funded: ${amount} ${CURRENCY} debited from ${senderUserId}`);

    return { purse: updatedPurse!, transaction };
  }

  async mergePurse(
    purseId: string,
    receiverUserId: string
  ): Promise<{ purse: TalerPurse; transaction: TalerTransaction }> {
    const purse = await queryOne<TalerPurse>(
      'SELECT * FROM taler_purses WHERE id = $1',
      [purseId]
    );

    if (!purse) {
      throw new AppError('Purse not found', 404);
    }

    if (purse.status !== 'funded') {
      throw new AppError(`Purse is in status '${purse.status}', cannot merge`, 400);
    }

    if (new Date(purse.expires_at) < new Date()) {
      await execute(
        "UPDATE taler_purses SET status = 'expired' WHERE id = $1",
        [purseId]
      );
      await this.refundPurse(purse);
      throw new AppError('Purse has expired, funds refunded', 410);
    }

    const receiverWallet = await queryOne<TalerWallet>(
      'SELECT * FROM taler_wallets WHERE id = $1',
      [purse.receiver_wallet_id]
    );

    if (!receiverWallet) {
      throw new AppError('Receiver wallet not found', 404);
    }

    if (receiverWallet.user_id !== receiverUserId) {
      throw new AppError('Receiver mismatch', 403);
    }

    const amount = parseAmount(purse.amount);

    await execute(
      'UPDATE taler_wallets SET balance = (CAST(balance AS NUMERIC) + $1)::TEXT, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [amount, receiverWallet.id]
    );

    await execute(
      "UPDATE taler_purses SET status = 'merged', merged_at = CURRENT_TIMESTAMP WHERE id = $1",
      [purseId]
    );

    const transaction = await this.logTransaction({
      purseId: purse.id,
      fromWalletId: purse.sender_wallet_id,
      toWalletId: receiverWallet.id,
      amount,
      contractHash: purse.contract_hash,
      status: 'completed',
      description: `Purse merge: ${amount} ${CURRENCY}`,
    });

    const updatedPurse = await queryOne<TalerPurse>(
      'SELECT * FROM taler_purses WHERE id = $1',
      [purseId]
    );

    logger.info(`Purse ${purseId} merged: ${amount} ${CURRENCY} credited to ${receiverUserId}`);

    return { purse: updatedPurse!, transaction };
  }

  async getPurse(purseId: string): Promise<TalerPurse> {
    const purse = await queryOne<TalerPurse>(
      'SELECT * FROM taler_purses WHERE id = $1',
      [purseId]
    );

    if (!purse) {
      throw new AppError('Purse not found', 404);
    }

    return purse;
  }

  async abortPurse(purseId: string, userId: string): Promise<TalerPurse> {
    const purse = await queryOne<TalerPurse>(
      'SELECT * FROM taler_purses WHERE id = $1',
      [purseId]
    );

    if (!purse) {
      throw new AppError('Purse not found', 404);
    }

    if (purse.status === 'merged') {
      throw new AppError('Cannot abort a merged purse', 400);
    }

    if (purse.status === 'aborted' || purse.status === 'expired') {
      throw new AppError('Purse is already in terminal state', 400);
    }

    const senderWallet = await queryOne<TalerWallet>(
      'SELECT * FROM taler_wallets WHERE id = $1',
      [purse.sender_wallet_id]
    );

    if (!senderWallet || senderWallet.user_id !== userId) {
      throw new AppError('Only the sender can abort a purse', 403);
    }

    if (purse.status === 'funded') {
      const amount = parseAmount(purse.amount);
      await execute(
        'UPDATE taler_wallets SET balance = (CAST(balance AS NUMERIC) + $1)::TEXT, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [amount, senderWallet.id]
      );
      logger.info(`Purse ${purseId} aborted: ${amount} ${CURRENCY} refunded to ${userId}`);
    }

    await execute(
      "UPDATE taler_purses SET status = 'aborted' WHERE id = $1",
      [purseId]
    );

    const updatedPurse = await queryOne<TalerPurse>(
      'SELECT * FROM taler_purses WHERE id = $1',
      [purseId]
    );

    return updatedPurse!;
  }

  async getTransactions(userId: string): Promise<TalerTransaction[]> {
    const wallet = await queryOne<TalerWallet>(
      'SELECT id FROM taler_wallets WHERE user_id = $1',
      [userId]
    );

    if (!wallet) {
      return [];
    }

    return query<TalerTransaction>(
      `SELECT * FROM taler_transactions
       WHERE from_wallet_id = $1 OR to_wallet_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [wallet.id]
    );
  }

  async getExchangeConfig() {
    return {
      name: 'HEIMAT Taler Exchange (Simulator)',
      currency: CURRENCY,
      version: 'v37-sim',
      exchange_url: 'http://localhost:3000/api/finance/taler',
      master_public_key: sha512('heimat-exchange-master'),
      default_purse_expiration: `${PURSE_TIMEOUT_HOURS}h`,
      purse_fee: formatAmount(PURSE_FEE),
      purse_timeout: `${PURSE_TIMEOUT_HOURS}h`,
      accounts: [
        {
          payto_uri: 'payto://x-taler-bank/localhost/ exchange',
          label: 'HEIMAT Exchange',
        },
      ],
      denominations: [
        { value: '1', freq: 8, fee_withdraw: '0', fee_deposit: '0', fee_refresh: '0', fee_refund: '0' },
        { value: '2', freq: 4, fee_withdraw: '0', fee_deposit: '0', fee_refresh: '0', fee_refund: '0' },
        { value: '5', freq: 2, fee_withdraw: '0', fee_deposit: '0', fee_refresh: '0', fee_refund: '0' },
        { value: '10', freq: 1, fee_withdraw: '0', fee_deposit: '0', fee_refresh: '0', fee_refund: '0' },
      ],
    };
  }

  private async refundPurse(purse: TalerPurse): Promise<void> {
    const senderWallet = await queryOne<TalerWallet>(
      'SELECT * FROM taler_wallets WHERE id = $1',
      [purse.sender_wallet_id]
    );

    if (senderWallet && purse.status === 'funded') {
      const amount = parseAmount(purse.amount);
      await execute(
        'UPDATE taler_wallets SET balance = (CAST(balance AS NUMERIC) + $1)::TEXT, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [amount, senderWallet.id]
      );

      await this.logTransaction({
        purseId: purse.id,
        fromWalletId: purse.receiver_wallet_id || 'escrow',
        toWalletId: senderWallet.id,
        amount,
        contractHash: purse.contract_hash,
        status: 'refunded',
        description: `Purse refund: ${amount} ${CURRENCY}`,
      });
    }
  }

  private async logTransaction(data: {
    purseId: string | null;
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    contractHash: string | null;
    status: string;
    description: string | null;
  }): Promise<TalerTransaction> {
    const tx = await queryOne<TalerTransaction>(
      `INSERT INTO taler_transactions (purse_id, from_wallet_id, to_wallet_id, amount, currency, contract_hash, status, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.purseId,
        data.fromWalletId,
        data.toWalletId,
        data.amount.toString(),
        CURRENCY,
        data.contractHash,
        data.status,
        data.description,
      ]
    );

    return tx!;
  }
}

export const talerService = new TalerService();
