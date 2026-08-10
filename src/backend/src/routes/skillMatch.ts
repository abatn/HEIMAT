// skillMatch.ts — Skill-Matching Routes
//
// POST /api/jobs/extract-skills — Skills aus Job-Beschreibung extrahieren
// POST /api/jobs/match-skills — Match-Score berechnen

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { skillMatchService } from '../services/skillMatchService';
import { validate } from '../middleware/validate';
import { logger } from '../utils/logger';

export const skillMatchRouter = Router();

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const extractSkillsSchema = z.object({
  description: z.string().min(10, 'Beschreibung zu kurz').max(10000),
});

const matchSkillsSchema = z.object({
  userSkills: z.array(z.string()).min(1, 'Mindestens ein Skill erforderlich'),
  jobSkills: z.array(z.string()).min(1, 'Mindestens ein Job-Skill erforderlich'),
});

// ---------------------------------------------------------------------------
// POST /api/jobs/extract-skills — Skills aus Job-Beschreibung extrahieren
// ---------------------------------------------------------------------------

skillMatchRouter.post(
  '/extract-skills',
  validate(extractSkillsSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const { description } = req.body;

    try {
      const result = await skillMatchService.extractSkills(description);
      res.json({ status: 'ok', ...result });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Skill-Extraktion fehlgeschlagen: ${msg}`);
      res.status(500).json({
        status: 'error',
        message: 'Skill-Extraktion fehlgeschlagen',
        detail: msg,
      });
    }
  })
);

// ---------------------------------------------------------------------------
// POST /api/jobs/match-skills — Match-Score berechnen
// ---------------------------------------------------------------------------

skillMatchRouter.post(
  '/match-skills',
  validate(matchSkillsSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const { userSkills, jobSkills } = req.body;

    try {
      const result = skillMatchService.calculateMatch(userSkills, jobSkills);
      res.json({ status: 'ok', ...result });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Skill-Matching fehlgeschlagen: ${msg}`);
      res.status(500).json({
        status: 'error',
        message: 'Skill-Matching fehlgeschlagen',
        detail: msg,
      });
    }
  })
);
