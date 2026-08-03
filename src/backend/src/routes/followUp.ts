// followUp.ts — Post-Termin Follow-up API Routes (Nachsorge)
//
// ENDPOINTS:
//   GET    /api/health/followups              → Offene Follow-ups laden
//   POST   /api/health/followups/:id/respond  → User antwortet
//   GET    /api/health/followups/history      → Verlauf
//   GET    /api/health/followups/stats        → Statistiken
//   POST   /api/health/followups/check        → Cron: Offene Follow-ups prüfen

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  respondFollowUpBodySchema,
  followUpHistoryQuerySchema,
} from '../middleware/schemas';
import { followUpService } from '../services/followUpService';

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Simple admin check (checks X-Admin-Key header)
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
};

const followUpRouter = Router();

// -------------------------------------------------------------------------
// GET /api/health/followups — Offene Follow-ups laden
// -------------------------------------------------------------------------
followUpRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;

    const followUps = await followUpService.getPendingFollowUps(userId);

    res.json({
      status: 'ok',
      followups: followUps,
      count: followUps.length,
    });
  })
);

// -------------------------------------------------------------------------
// POST /api/health/followups/:id/respond — User antwortet
// -------------------------------------------------------------------------
followUpRouter.post(
  '/:id/respond',
  requireAuth,
  validate(respondFollowUpBodySchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const followUpId = req.params.id as string;
    const text = req.body.text as string;
    const severity = req.body.severity as number;

    const updated = await followUpService.respondToFollowUp(
      followUpId,
      userId,
      { text, severity }
    );

    if (!updated) {
      res.status(404).json({
        status: 'error',
        message: 'Follow-up nicht gefunden',
      });
      return;
    }

    res.json({
      status: 'ok',
      followup: updated,
      message: 'Antwort gespeichert',
      needs_followup: updated.needs_followup,
    });
  })
);

// -------------------------------------------------------------------------
// GET /api/health/followups/history — Verlauf
// -------------------------------------------------------------------------
followUpRouter.get(
  '/history',
  requireAuth,
  validate(followUpHistoryQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const limitRaw = req.query.limit;
    const limitStr = typeof limitRaw === 'string' ? limitRaw : undefined;
    const limit = parseInt(limitStr || '20') || 20;

    const history = await followUpService.getFollowUpHistory(userId, limit);

    res.json({
      status: 'ok',
      history,
      count: history.length,
    });
  })
);

// -------------------------------------------------------------------------
// GET /api/health/followups/stats — Statistiken
// -------------------------------------------------------------------------
followUpRouter.get(
  '/stats',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;

    const stats = await followUpService.getStats(userId);

    res.json({
      status: 'ok',
      stats,
    });
  })
);

// -------------------------------------------------------------------------
// POST /api/health/followups/check — Cron: Offene Follow-ups prüfen (Admin)
// -------------------------------------------------------------------------
followUpRouter.post(
  '/check',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await followUpService.checkPendingFollowUps();

    res.json({
      status: 'ok',
      sent: result.sent,
      skipped: result.skipped,
      message: `${result.sent} Follow-ups als 'sent' markiert`,
    });
  })
);

export { followUpRouter };
