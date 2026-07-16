import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { financeService } from '../services/financeService';
import { talerService } from '../services/talerService';

export const financeRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next); };

financeRouter.get('/wallet/:userId', asyncHandler(async (req: Request, res: Response) => {
  const wallet = await financeService.getWallet(req.params.userId);
  res.json({ status: 'ok', wallet });
}));

financeRouter.get('/balance/:userId', asyncHandler(async (req: Request, res: Response) => {
  const { balance, currency } = await talerService.getBalance(req.params.userId);
  res.json({ status: 'ok', balance, currency });
}));

financeRouter.post('/pay', asyncHandler(async (req: Request, res: Response) => {
  const { from, to, amount, currency, description } = req.body;
  if (!from || !to || !amount) throw new AppError('From, to, and amount are required', 400);
  if (typeof amount !== 'number' || amount <= 0) throw new AppError('Amount must be a positive number', 400);
  const transaction = await financeService.createPayment(from, to, amount, currency || 'KUDOS', description);
  res.json({ status: 'ok', transaction });
}));

financeRouter.get('/transactions/:userId', asyncHandler(async (req: Request, res: Response) => {
  const transactions = await financeService.getTransactions(req.params.userId);
  res.json({ status: 'ok', transactions, count: transactions.length });
}));

financeRouter.get('/taler/config', asyncHandler(async (req: Request, res: Response) => {
  const config = await talerService.getExchangeConfig();
  res.json(config);
}));

financeRouter.post('/taler/wallet', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) throw new AppError('userId is required', 400);
  const wallet = await talerService.createWallet(userId);
  res.json({ status: 'ok', wallet });
}));

financeRouter.get('/taler/purse/:purseId', asyncHandler(async (req: Request, res: Response) => {
  const purse = await talerService.getPurse(req.params.purseId);
  res.json({ status: 'ok', purse });
}));

financeRouter.post('/taler/purse/create', asyncHandler(async (req: Request, res: Response) => {
  const { senderUserId, receiverUserId, amount, contractHash, description } = req.body;
  if (!senderUserId || !receiverUserId || !amount) {
    throw new AppError('senderUserId, receiverUserId, and amount are required', 400);
  }
  if (typeof amount !== 'number' || amount <= 0) {
    throw new AppError('Amount must be a positive number', 400);
  }
  const purse = await talerService.createPurse(senderUserId, receiverUserId, amount, contractHash, description);
  res.json({ status: 'ok', purse });
}));

financeRouter.post('/taler/purse/:purseId/deposit', asyncHandler(async (req: Request, res: Response) => {
  const { senderUserId } = req.body;
  if (!senderUserId) throw new AppError('senderUserId is required', 400);
  const result = await talerService.depositToPurse(req.params.purseId, senderUserId);
  res.json({ status: 'ok', ...result });
}));

financeRouter.post('/taler/purse/:purseId/merge', asyncHandler(async (req: Request, res: Response) => {
  const { receiverUserId } = req.body;
  if (!receiverUserId) throw new AppError('receiverUserId is required', 400);
  const result = await talerService.mergePurse(req.params.purseId, receiverUserId);
  res.json({ status: 'ok', ...result });
}));

financeRouter.post('/taler/purse/:purseId/abort', asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) throw new AppError('userId is required', 400);
  const purse = await talerService.abortPurse(req.params.purseId, userId);
  res.json({ status: 'ok', purse });
}));
