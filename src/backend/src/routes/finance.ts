import { Router, Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler';

export const financeRouter = Router();

// Get wallet balance
financeRouter.get('/wallet', async (req: Request, res: Response) => {
  // TODO: Integrate with GNU Taler
  res.json({
    status: 'ok',
    balance: 0,
    currency: 'EUR',
    message: 'Wallet integration - coming soon',
  });
});

// Create payment
financeRouter.post('/pay', async (req: Request, res: Response) => {
  const { recipient, amount, currency } = req.body;

  if (!recipient || !amount) {
    throw new AppError('Recipient and amount are required', 400);
  }

  // TODO: Integrate with GNU Taler
  res.json({
    status: 'ok',
    transactionId: null,
    message: 'P2P payment - coming soon',
  });
});

// Get transaction history
financeRouter.get('/transactions', async (req: Request, res: Response) => {
  // TODO: Query transaction history
  res.json({
    status: 'ok',
    transactions: [],
    message: 'Transaction history - coming soon',
  });
});
