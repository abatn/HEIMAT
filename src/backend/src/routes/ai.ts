import { Router, Request, Response, NextFunction } from 'express';
import { getDashboardContext, getPersonalizedContext } from '../services/aiHomeService';

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

// ---------------------------------------------------------------------------
// AI Home Dashboard — personalisierte Daten via BayesClassifier
// POST /api/ai/home/personalized
// Body: { recentActions: string[] }
// ---------------------------------------------------------------------------

aioRouter.post('/home/personalized', asyncHandler(async (req: Request, res: Response) => {
  const { recentActions } = req.body;
  const actions: string[] = Array.isArray(recentActions) ? recentActions : [];
  const context = getPersonalizedContext(actions);
  res.json({
    status: 'ok',
    context,
    personalized: actions.length > 0,
  });
}));
