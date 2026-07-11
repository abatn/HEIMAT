import { AppError } from '../middleware/errorHandler';

interface Wallet {
  id: string;
  balance: number;
  currency: string;
  userId: string;
}

interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  currency: string;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed';
}

export class FinanceService {
  private wallets: Map<string, Wallet> = new Map();
  private transactions: Transaction[] = [];

  constructor() {
    // Mock-Daten für Demo
    this.wallets.set('user1', {
      id: 'wallet1',
      balance: 100.00,
      currency: 'EUR',
      userId: 'user1',
    });
    this.wallets.set('user2', {
      id: 'wallet2',
      balance: 50.00,
      currency: 'EUR',
      userId: 'user2',
    });
  }

  async getWallet(userId: string): Promise<Wallet> {
    const wallet = this.wallets.get(userId);
    if (!wallet) {
      throw new AppError('Wallet not found', 404);
    }
    return wallet;
  }

  async createPayment(from: string, to: string, amount: number, currency: string = 'EUR'): Promise<Transaction> {
    if (amount <= 0) {
      throw new AppError('Amount must be positive', 400);
    }

    const fromWallet = this.wallets.get(from);
    const toWallet = this.wallets.get(to);

    if (!fromWallet) {
      throw new AppError('Sender wallet not found', 404);
    }

    if (!toWallet) {
      throw new AppError('Recipient wallet not found', 404);
    }

    if (fromWallet.balance < amount) {
      throw new AppError('Insufficient balance', 400);
    }

    // Transaktion durchführen
    fromWallet.balance -= amount;
    toWallet.balance += amount;

    const transaction: Transaction = {
      id: `tx_${Date.now()}`,
      from,
      to,
      amount,
      currency,
      timestamp: new Date().toISOString(),
      status: 'completed',
    };

    this.transactions.push(transaction);
    return transaction;
  }

  async getTransactions(userId: string): Promise<Transaction[]> {
    return this.transactions.filter(
      tx => tx.from === userId || tx.to === userId
    );
  }

  async getBalance(userId: string): Promise<number> {
    const wallet = this.wallets.get(userId);
    if (!wallet) {
      throw new AppError('Wallet not found', 404);
    }
    return wallet.balance;
  }
}

export const financeService = new FinanceService();
