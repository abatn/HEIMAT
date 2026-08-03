// mentalHealth.ts — Mental Health API Routes (PHQ-9 + Ollama)
//
// ENDPOINTS:
//   POST   /api/health/mental/phq9           → PHQ-9 Screening durchführen
//   GET    /api/health/mental/phq9/history   → PHQ-9 Verlauf laden
//   GET    /api/health/mental/stats          → Statistiken
//   GET    /api/health/mental/crisis         → Notfall-Kontakte
//   GET    /api/health/mental/questions      → PHQ-9 Fragen (Referenz)

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createPhq9BodySchema,
  phq9HistoryQuerySchema,
} from '../middleware/schemas';
import { mentalHealthService, PHQ9_QUESTIONS, PHQ9_SCALE } from '../services/mentalHealthService';

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const mentalHealthRouter = Router();

// -------------------------------------------------------------------------
// POST /api/health/mental/phq9 — PHQ-9 Screening durchführen
// -------------------------------------------------------------------------
mentalHealthRouter.post(
  '/phq9',
  requireAuth,
  validate(createPhq9BodySchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const { answers, additional_notes, location } = req.body;

    const result = await mentalHealthService.createPhq9Assessment(
      userId,
      answers,
      additional_notes,
      location
    );

    res.status(201).json({
      status: 'ok',
      assessment: result,
      message: `PHQ-9 Score: ${result.total_score}/27 — ${result.severity}`,
    });
  })
);

// -------------------------------------------------------------------------
// GET /api/health/mental/phq9/history — PHQ-9 Verlauf laden
// -------------------------------------------------------------------------
mentalHealthRouter.get(
  '/phq9/history',
  requireAuth,
  validate(phq9HistoryQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const limitRaw = req.query.limit;
    const limitStr = typeof limitRaw === 'string' ? limitRaw : undefined;
    const limit = parseInt(limitStr || '20') || 20;

    const history = await mentalHealthService.getPhq9History(userId, limit);

    res.json({
      status: 'ok',
      history,
      count: history.length,
    });
  })
);

// -------------------------------------------------------------------------
// GET /api/health/mental/stats — Statistiken
// -------------------------------------------------------------------------
mentalHealthRouter.get(
  '/stats',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;

    const stats = await mentalHealthService.getPhq9Stats(userId);

    res.json({
      status: 'ok',
      stats,
    });
  })
);

// -------------------------------------------------------------------------
// GET /api/health/mental/crisis — Notfall-Kontakte
// -------------------------------------------------------------------------
mentalHealthRouter.get(
  '/crisis',
  asyncHandler(async (req: Request, res: Response) => {
    const contacts = mentalHealthService.getEmergencyContacts();

    res.json({
      status: 'ok',
      contacts,
    });
  })
);

// -------------------------------------------------------------------------
// GET /api/health/mental/questions — PHQ-9 Fragen (Referenz)
// -------------------------------------------------------------------------
mentalHealthRouter.get(
  '/questions',
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      questions: PHQ9_QUESTIONS,
      scale: PHQ9_SCALE,
    });
  })
);

export { mentalHealthRouter };
