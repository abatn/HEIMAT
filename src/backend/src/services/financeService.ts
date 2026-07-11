import { query, queryOne, execute } from '../config/database';
import { AppError } from '../middleware/errorHandler';

interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
}

interface Transaction {
  id: string;
  from_wallet_id: string;
  to_wallet_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

export class FinanceService {
  async getWallet(userId: string): Promise<Wallet> {
    const wallet = await queryOne<Wallet>(
      'SELECT * FROM wallets WHERE user_id = $1',
      [userId]
    );

    if (!wallet) {
      // Wallet erstellen falls nicht vorhanden
      const newWallet = await queryOne<Wallet>(
        'INSERT INTO wallets (user_id, balance, currency) VALUES ($1, 0.00, $2) RETURNING *',
        [userId, 'EUR']
      );
      return newWallet!;
    }

    return wallet;
  }

  async createPayment(fromUserId: string, toUserId: string, amount: number, currency: string = 'EUR'): Promise<Transaction> {
    if (amount <= 0) {
      throw new AppError('Amount must be positive', 400);
    }

    // Wallets abrufen oder erstellen
    const fromWallet = await this.getWallet(fromUserId);
    const toWallet = await this.getWallet(toUserId);

    if (fromWallet.balance < amount) {
      throw new AppError('Insufficient balance', 400);
    }

    // Transaktion in Datenbank durchführen
    const transaction = await queryOne<Transaction>(
      `INSERT INTO transactions (from_wallet_id, to_wallet_id, amount, currency, status)
       VALUES ($1, $2, $3, $4, 'completed')
       RETURNING *`,
      [fromWallet.id, toWallet.id, amount, currency]
    );

    // Guthaben aktualisieren
    await execute(
      'UPDATE wallets SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [amount, fromWallet.id]
    );

    await execute(
      'UPDATE wallets SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [amount, toWallet.id]
    );

    return transaction!;
  }

  async getTransactions(userId: string): Promise<Transaction[]> {
    return query<Transaction>(
      `SELECT t.* 
       FROM transactions t
       JOIN wallets w ON t.from_wallet_id = w.id OR t.to_wallet_id = w.id
       WHERE w.user_id = $1
       ORDER BY t.created_at DESC
       LIMIT 50`,
      [userId]
    );
  }

  async getBalance(userId: string): Promise<number> {
    const wallet = await queryOne<Wallet>(
      'SELECT balance FROM wallets WHERE user_id = $1',
      [userId]
    );

    if (!wallet) {
      return 0;
    }

    return Number(wallet.balance);
  }

  async getWalletById(walletId: string): Promise<Wallet> {
    const wallet = await queryOne<Wallet>(
      'SELECT * FROM wallets WHERE id = $1',
      [walletId]
    );

    if (!wallet) {
      throw new AppError('Wallet not found', 404);
    }

    return wallet;
  }
}

export const financeService = new FinanceService();
