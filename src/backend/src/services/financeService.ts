import { AppError } from '../middleware/errorHandler';
import { talerService, TalerWallet, TalerTransaction } from './talerService';

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
  description: string | null;
  created_at: string;
}

export class FinanceService {
  async getWallet(userId: string): Promise<Wallet> {
    const talerWallet: TalerWallet = await talerService.getWallet(userId);
    return {
      id: talerWallet.id,
      user_id: talerWallet.user_id,
      balance: parseFloat(talerWallet.balance),
      currency: talerWallet.currency,
    };
  }

  async getBalance(userId: string): Promise<number> {
    const { balance } = await talerService.getBalance(userId);
    return balance;
  }

  async createPayment(
    fromUserId: string,
    toUserId: string,
    amount: number,
    description?: string
  ): Promise<Transaction> {
    if (amount <= 0) {
      throw new AppError('Amount must be positive', 400);
    }

    const purse = await talerService.createPurse(
      fromUserId,
      toUserId,
      amount,
      undefined,
      description
    );

    const { purse: fundedPurse, transaction } = await talerService.depositToPurse(
      purse.id,
      fromUserId
    );

    const { purse: mergedPurse } = await talerService.mergePurse(purse.id, toUserId);

    return {
      id: transaction.id,
      from_wallet_id: fundedPurse.sender_wallet_id,
      to_wallet_id: mergedPurse.receiver_wallet_id || '',
      amount: parseFloat(transaction.amount),
      currency: transaction.currency,
      status: mergedPurse.status === 'merged' ? 'completed' : transaction.status,
      description: transaction.description,
      created_at: transaction.created_at,
    };
  }

  async getTransactions(userId: string): Promise<Transaction[]> {
    const txs: TalerTransaction[] = await talerService.getTransactions(userId);
    return txs.map(tx => ({
      id: tx.id,
      from_wallet_id: tx.from_wallet_id,
      to_wallet_id: tx.to_wallet_id,
      amount: parseFloat(tx.amount),
      currency: tx.currency,
      status: tx.status,
      description: tx.description,
      created_at: tx.created_at,
    }));
  }
}

export const financeService = new FinanceService();
