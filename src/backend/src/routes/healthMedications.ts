// healthMedications.ts — Health AI Agent: Medikamente Routes

import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import {
  userMedicationsQuerySchema,
  createMedicationBodySchema,
  updateMedicationBodySchema,
  checkInteractionsBodySchema,
} from '../middleware/schemas';
import { userMedicationsService } from '../services/userMedicationsService';

export const healthMedicationsRouter = Router();

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ---------------------------------------------------------------------------
// GET /api/health/medications — Alle Medikamente laden
// ---------------------------------------------------------------------------
healthMedicationsRouter.get(
  '/',
  requireAuth,
  validate(userMedicationsQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const activeOnly = req.query.active_only === 'true';

    const result = await userMedicationsService.getMedications(userId, {
      active_only: activeOnly,
    });

    res.json({
      status: 'ok',
      ...result,
    });
  })
);

// ---------------------------------------------------------------------------
// POST /api/health/medications — Neues Medikament hinzufügen
// ---------------------------------------------------------------------------
healthMedicationsRouter.post(
  '/',
  requireAuth,
  validate(createMedicationBodySchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;

    const result = await userMedicationsService.addMedication(userId, req.body);

    res.status(201).json({
      status: 'ok',
      ...result,
      message: 'Medikament hinzugefügt',
    });
  })
);

// ---------------------------------------------------------------------------
// POST /api/health/medications/check — Interaktions-Check
// ---------------------------------------------------------------------------
healthMedicationsRouter.post(
  '/check',
  requireAuth,
  validate(checkInteractionsBodySchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const { drugs } = req.body;

    const result = await userMedicationsService.checkInteractions(
      (req as any).userId,
      drugs
    );

    res.json({
      status: 'ok',
      ...result,
    });
  })
);

// ---------------------------------------------------------------------------
// GET /api/health/medications/interactions — Interaktions-Check für User-Medikamente
// ---------------------------------------------------------------------------
healthMedicationsRouter.get(
  '/interactions',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;

    const result = await userMedicationsService.checkUserInteractions(userId);

    res.json({
      status: 'ok',
      ...result,
    });
  })
);

// ---------------------------------------------------------------------------
// GET /api/health/medications/:id — Einzelnes Medikament laden
// ---------------------------------------------------------------------------
healthMedicationsRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const medication = await userMedicationsService.getMedicationById(
      userId,
      req.params.id as string
    );

    res.json({
      status: 'ok',
      medication,
    });
  })
);

// ---------------------------------------------------------------------------
// PUT /api/health/medications/:id — Medikament aktualisieren
// ---------------------------------------------------------------------------
healthMedicationsRouter.put(
  '/:id',
  requireAuth,
  validate(updateMedicationBodySchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const medication = await userMedicationsService.updateMedication(
      userId,
      req.params.id as string,
      req.body
    );

    res.json({
      status: 'ok',
      medication,
      message: 'Medikament aktualisiert',
    });
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/health/medications/:id — Medikament entfernen (deaktivieren)
// ---------------------------------------------------------------------------
healthMedicationsRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    await userMedicationsService.removeMedication(userId, req.params.id as string);

    res.json({
      status: 'ok',
      message: 'Medikament deaktiviert',
    });
  })
);
