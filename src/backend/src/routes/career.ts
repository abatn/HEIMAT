// career.ts — Karriere-Pfad Routes
//
// GET /api/career/advice?role=Krankenpfleger — Karriere-Advice laden
// GET /api/career/roles — Verfügbare Berufsgruppen auflisten

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { careerService } from '../services/careerService';
import { validate } from '../middleware/validate';
import { logger } from '../utils/logger';

export const careerRouter = Router();

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------

const careerAdviceSchema = z.object({
  role: z.string().min(1, 'Berufsbezeichnung erforderlich').max(200),
});

// ---------------------------------------------------------------------------
// GET /api/career/advice — Karriere-Advice laden
// ---------------------------------------------------------------------------

careerRouter.get(
  '/advice',
  validate(careerAdviceSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const role = req.query.role as string;

    try {
      const result = await careerService.getCareerAdvice(role);
      res.json({ status: 'ok', ...result });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Career advice failed: ${msg}`);
      res.status(500).json({
        status: 'error',
        message: 'Karriere-Advice konnte nicht geladen werden',
        detail: msg,
      });
    }
  })
);

// ---------------------------------------------------------------------------
// GET /api/career/roles — Verfügbare Berufsgruppen auflisten
// ---------------------------------------------------------------------------

careerRouter.get('/roles', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    roles: [
      'Entwickler', 'Senior Entwickler', 'Frontend Entwickler', 'DevOps Engineer',
      'Krankenpfleger', 'Arzt',
      'Elektriker',
      'Koch',
      'Lehrer',
      'Sachbearbeiter',
      'Lagerarbeiter',
    ],
  });
});
