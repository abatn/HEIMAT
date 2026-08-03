// prevention.ts — Präventions-Assistent API Routes
//
// ENDPOINTS:
//   GET    /api/health/prevention           → Aktive Empfehlungen laden
//   POST   /api/health/prevention/generate  → Empfehlungen generieren
//   PUT    /api/health/prevention/:id       → Als erledigt markieren
//   GET    /api/health/prevention/history   → Verlauf (erledigte Empfehlungen)
//   GET    /api/health/prevention/stats     → Statistiken

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  completePreventionBodySchema,
} from '../middleware/schemas';
import { preventionService } from '../services/preventionService';

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const preventionRouter = Router();

// -------------------------------------------------------------------------
// GET /api/health/prevention — Aktive Empfehlungen laden
// -------------------------------------------------------------------------
preventionRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;

    const recommendations = await preventionService.getActiveRecommendations(userId);

    res.json({
      status: 'ok',
      recommendations,
      count: recommendations.length,
    });
  })
);

// -------------------------------------------------------------------------
// POST /api/health/prevention/generate — Empfehlungen generieren
// -------------------------------------------------------------------------
preventionRouter.post(
  '/generate',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;

    const newRecommendations = await preventionService.generateRecommendations(userId);

    res.status(201).json({
      status: 'ok',
      new_recommendations: newRecommendations,
      count: newRecommendations.length,
      message: newRecommendations.length > 0
        ? `${newRecommendations.length} neue Empfehlungen generiert`
        : 'Keine neuen Empfehlungen (Profil unvollständig oder bereits alle generiert)',
    });
  })
);

// -------------------------------------------------------------------------
// PUT /api/health/prevention/:id — Als erledigt markieren
// -------------------------------------------------------------------------
preventionRouter.put(
  '/:id',
  requireAuth,
  validate(completePreventionBodySchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const recommendationId = req.params.id as string;
    const { doctor_id } = req.body;

    const updated = await preventionService.completeRecommendation(
      userId,
      recommendationId,
      doctor_id
    );

    if (!updated) {
      res.status(404).json({
        status: 'error',
        message: 'Empfehlung nicht gefunden',
      });
      return;
    }

    res.json({
      status: 'ok',
      recommendation: updated,
      message: 'Empfehlung als erledigt markiert',
    });
  })
);

// -------------------------------------------------------------------------
// GET /api/health/prevention/history — Verlauf
// -------------------------------------------------------------------------
preventionRouter.get(
  '/history',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;

    const history = await preventionService.getCompletedRecommendations(userId);

    res.json({
      status: 'ok',
      history,
      count: history.length,
    });
  })
);

// -------------------------------------------------------------------------
// GET /api/health/prevention/stats — Statistiken
// -------------------------------------------------------------------------
preventionRouter.get(
  '/stats',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;

    const stats = await preventionService.getStats(userId);

    res.json({
      status: 'ok',
      stats,
    });
  })
);

export { preventionRouter };
