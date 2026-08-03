// jobs.ts — Phase D: Job-Suche Routes
//
// GET /api/jobs/search?q=Entwickler&location=Berlin&page=0&per_page=20
//
// Datenquelle: Arbeitnow API (Open Source, kein API-Key)
// Pattern-Mirror zu weather.ts / airQuality.ts / waste.ts

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { jobService } from '../services/jobService';
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
    const page = parseInt((req.query.page as string) || '0', 10);
    const perPage = parseInt((req.query.per_page as string) || '20', 10);

    try {
      const result = await jobService.searchJobs(q, location, page, perPage);
      res.json({ status: 'ok', ...result });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Jobs search failed: ${msg}`);
      res.status(502).json({
        status: 'error',
        message: 'Job-Suche fehlgeschlagen (Arbeitnow API)',
        detail: msg,
      });
    }
  })
);

// ---------------------------------------------------------------------------
// GET /api/jobs/status — Health-Check
// ---------------------------------------------------------------------------

jobsRouter.get('/status', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    source: 'arbeitnow',
    attribution: 'https://www.arbeitnow.com',
    license: 'Free public API, no key required',
  });
});
