// jobs.ts — Erweiterte Job-Suche Routes
//
// GET /api/jobs/search?q=Krankenpfleger&location=Berlin&branchen=gesundheit
// GET /api/jobs/status — Health-Check + verfügbare Branchen
//
// Datenquellen: Adzuna API (primär) + Arbeitnow (Fallback)

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { jobService, BRANCHEN_LABELS } from '../services/jobService';
import { validate } from '../middleware/validate';
import { logger } from '../utils/logger';

export const jobsRouter = Router();

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------

const jobSearchQuerySchema = z.object({
  q: z.string().min(1, 'Suchbegriff erforderlich').max(200),
  location: z.string().max(200).optional(),
  branchen: z
    .string()
    .optional()
    .refine(
      (v) => !v || v in BRANCHEN_LABELS,
      'Ungültige Branche. Gültig: alle, technik, gesundheit, handwerk, bildung, gastro, verwaltung, logistik'
    ),
  page: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v), 'page muss eine Zahl sein'),
  per_page: z
    .string()
    .optional()
    .refine((v) => !v || (/^\d+$/.test(v) && Number(v) <= 50), 'per_page max 50'),
});

// ---------------------------------------------------------------------------
// GET /api/jobs/search — Jobs suchen
// ---------------------------------------------------------------------------

jobsRouter.get(
  '/search',
  validate(jobSearchQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query.q as string;
    const location = req.query.location as string | undefined;
    const branchen = req.query.branchen as string | undefined;
    const page = parseInt((req.query.page as string) || '0', 10);
    const perPage = parseInt((req.query.per_page as string) || '20', 10);

    try {
      const result = await jobService.searchJobs(
        q,
        location,
        branchen,
        page,
        perPage
      );
      res.json({ status: 'ok', ...result });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Jobs search failed: ${msg}`);
      res.status(502).json({
        status: 'error',
        message: 'Job-Suche fehlgeschlagen',
        detail: msg,
      });
    }
  })
);

// ---------------------------------------------------------------------------
// GET /api/jobs/status — Health-Check + verfügbare Branchen
// ---------------------------------------------------------------------------

jobsRouter.get('/status', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    sources: ['adzuna', 'arbeitnow'],
    branchen: BRANCHEN_LABELS,
    attribution: {
      adzuna: 'https://www.adzuna.de',
      arbeitnow: 'https://www.arbeitnow.com',
    },
  });
});
