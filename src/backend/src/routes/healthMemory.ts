// healthMemory.ts — Health AI Agent: Gedächtnis (Symptom-Verlauf) Routes

import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import {
  healthMemoryQuerySchema,
  createHealthMemoryBodySchema,
  resolveHealthMemoryBodySchema,
} from '../middleware/schemas';
import { healthMemoryService } from '../services/healthMemoryService';

export const healthMemoryRouter = Router();

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ---------------------------------------------------------------------------
// GET /api/health/memory — Symptom-Verlauf laden
// ---------------------------------------------------------------------------
healthMemoryRouter.get(
  '/',
  requireAuth,
  validate(healthMemoryQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const days = req.query.days ? parseInt(req.query.days as string) : undefined;
    const resolved = req.query.resolved === 'true' ? true : req.query.resolved === 'false' ? false : undefined;

    const result = await healthMemoryService.getMemory(userId, {
      limit,
      symptom: req.query.symptom as string,
      days,
      resolved,
    });

    res.json({
      status: 'ok',
      ...result,
    });
  })
);

// ---------------------------------------------------------------------------
// POST /api/health/memory — Neuen Symptom-Eintrag erstellen
// ---------------------------------------------------------------------------
healthMemoryRouter.post(
  '/',
  requireAuth,
  validate(createHealthMemoryBodySchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;

    const memory = await healthMemoryService.createMemory(userId, req.body);

    res.status(201).json({
      status: 'ok',
      memory,
      message: 'Symptom in Gedächtnis gespeichert',
    });
  })
);

// ---------------------------------------------------------------------------
// GET /api/health/memory/stats — Statistiken
// ---------------------------------------------------------------------------
healthMemoryRouter.get(
  '/stats',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;

    const stats = await healthMemoryService.getStats(userId);

    res.json({
      status: 'ok',
      stats,
    });
  })
);

// ---------------------------------------------------------------------------
// GET /api/health/memory/:id — Einzelnen Eintrag laden
// ---------------------------------------------------------------------------
healthMemoryRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const memory = await healthMemoryService.getMemoryById(userId, req.params.id as string);

    res.json({
      status: 'ok',
      memory,
    });
  })
);

// ---------------------------------------------------------------------------
// PUT /api/health/memory/:id/resolve — Als gelöst markieren
// ---------------------------------------------------------------------------
healthMemoryRouter.put(
  '/:id/resolve',
  requireAuth,
  validate(resolveHealthMemoryBodySchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const memory = await healthMemoryService.resolveMemory(
      userId,
      req.params.id as string,
      req.body
    );

    res.json({
      status: 'ok',
      memory,
      message: 'Symptom als gelöst markiert',
    });
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/health/memory/:id — Eintrag löschen
// ---------------------------------------------------------------------------
healthMemoryRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    await healthMemoryService.deleteMemory(userId, req.params.id as string);

    res.json({
      status: 'ok',
      message: 'Symptom-Eintrag gelöscht',
    });
  })
);
