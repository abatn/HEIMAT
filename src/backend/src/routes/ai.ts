import { Router, Request, Response, NextFunction } from 'express';
import { getDashboardContext } from '../services/aiHomeService';

export const aiRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next); };

// ---------------------------------------------------------------------------
// AI Home Dashboard — kontextualisierte Daten für die Startseite
// ---------------------------------------------------------------------------

aiRouter.get('/home', asyncHandler(async (req: Request, res: Response) => {
  const context = getDashboardContext();
  res.json({
    status: 'ok',
    context,
  });
}));
