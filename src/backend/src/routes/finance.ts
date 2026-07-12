import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { financeService } from '../services/financeService';

export const financeRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next); };

financeRouter.get('/wallet/:userId', asyncHandler(async (req: Request, res: Response) => {
  const wallet = await financeService.getWallet(req.params.userId);
  res.json({ status: 'ok', wallet });
}));

financeRouter.post('/pay', asyncHandler(async (req: Request, res: Response) => {
  const { from, to, amount, currency } = req.body;
  if (!from || !to || !amount) throw new AppError('From, to, and amount are required', 400);
  if (typeof amount !== 'number' || amount <= 0) throw new AppError('Amount must be a positive number', 400);
  const transaction = await financeService.createPayment(from, to, amount, currency || 'EUR');
  res.json({ status: 'ok', transaction });
}));

financeRouter.get('/transactions/:userId', asyncHandler(async (req: Request, res: Response) => {
  const transactions = await financeService.getTransactions(req.params.userId);
  res.json({ status: 'ok', transactions, count: transactions.length });
}));

financeRouter.get('/balance/:userId', asyncHandler(async (req: Request, res: Response) => {
  const balance = await financeService.getBalance(req.params.userId);
  res.json({ status: 'ok', balance, currency: 'EUR' });
}));
