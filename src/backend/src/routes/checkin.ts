// ---------------------------------------------------------------------------
// Check-in Routes — "Lebenszeichen" (Phase AI-Health-2, 2026-07-29)
//
// Endpoints:
//   POST /api/checkin/activate   — Check-in aktivieren (Opt-in)
//   POST /api/checkin/deactivate — Check-in deaktivieren
//   POST /api/checkin/ping       — "Mir geht's gut" (Timer zurücksetzen)
//   GET  /api/checkin/status     — Aktuellen Status abrufen
//   GET  /api/checkin/settings   — Einstellungen abrufen
//   PUT  /api/checkin/settings   — Einstellungen aktualisieren
//   GET  /api/checkin/events     — Ereignis-Historie abrufen
//
// Auth: Alle Endpoints benötigen requireAuth (JWT).
// Privacy: KEINE Sensoren. Nur Timer-basiert. User Opt-in erforderlich.
// KEIN Mock, KEINE Simulation.
// ---------------------------------------------------------------------------

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { checkinService } from '../services/checkinService';
import { logger } from '../utils/logger';

export const checkinRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next); };

// ---------------------------------------------------------------------------
// POST /api/checkin/activate — Check-in aktivieren (Opt-in)
// Body: { intervalHours?, intervalHealthHours?, emergencyContactName?,
//         emergencyContactPhone?, emergencyContactEmail?, auto112Enabled? }
// ---------------------------------------------------------------------------

checkinRouter.post('/activate', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { intervalHours, intervalHealthHours, emergencyContactName,
          emergencyContactPhone, emergencyContactEmail, auto112Enabled } = req.body || {};

  try {
    const settings = await checkinService.activate(userId, {
      intervalHours: intervalHours ? parseInt(intervalHours, 10) : undefined,
      intervalHealthHours: intervalHealthHours ? parseInt(intervalHealthHours, 10) : undefined,
      emergencyContactName: emergencyContactName || undefined,
      emergencyContactPhone: emergencyContactPhone || undefined,
      emergencyContactEmail: emergencyContactEmail || undefined,
      auto112Enabled: auto112Enabled === true ? true : undefined,
    });

    res.status(201).json({
      status: 'ok',
      message: 'Check-in aktiviert. Sie erhalten täglich eine Erinnerung.',
      settings: {
        intervalHours: settings.intervalHours,
        isActive: settings.isActive,
        emergencyContactName: settings.emergencyContactName,
        emergencyContactPhone: settings.emergencyContactPhone,
        auto112Enabled: settings.auto112Enabled,
      },
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    logger.error(`Check-in activate failed: ${errMsg}`);
    res.status(500).json({ status: 'error', message: 'Check-in konnte nicht aktiviert werden' });
  }
}));

// ---------------------------------------------------------------------------
// POST /api/checkin/deactivate — Check-in deaktivieren
// ---------------------------------------------------------------------------

checkinRouter.post('/deactivate', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  try {
    await checkinService.deactivate(userId);
    res.json({ status: 'ok', message: 'Check-in deaktiviert.' });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    logger.error(`Check-in deactivate failed: ${errMsg}`);
    res.status(500).json({ status: 'error', message: 'Check-in konnte nicht deaktiviert werden' });
  }
}));

// ---------------------------------------------------------------------------
// POST /api/checkin/ping — "Mir geht's gut"
// Body: { healthSymptoms?: string } — Optional: Symptom für adaptiven Timer
// ---------------------------------------------------------------------------

checkinRouter.post('/ping', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { healthSymptoms } = req.body || {};

  try {
    const status = await checkinService.ping(userId, healthSymptoms || undefined);
    res.json({
      status: 'ok',
      message: 'Check-in bestätigt. Alles okay.',
      nextPingDueAt: status.nextPingDueAt,
      escalationStage: status.escalationStage,
      healthContextActive: status.healthContextActive,
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    if (errMsg.includes('nicht aktiviert')) {
      res.status(400).json({ status: 'error', message: errMsg });
      return;
    }
    logger.error(`Check-in ping failed: ${errMsg}`);
    res.status(500).json({ status: 'error', message: 'Ping fehlgeschlagen' });
  }
}));

// ---------------------------------------------------------------------------
// GET /api/checkin/status — Aktuellen Status
// ---------------------------------------------------------------------------

checkinRouter.get('/status', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  try {
    const status = await checkinService.getStatus(userId);

    if (!status) {
      res.json({
        status: 'ok',
        isActive: false,
        message: 'Check-in ist nicht aktiviert.',
        escalationStage: 0,
        nextPingDueAt: null,
      });
      return;
    }

    res.json({
      status: 'ok',
      isActive: true,
      timeSinceLastPingMinutes: status.timeSinceLastPingMinutes,
      currentIntervalHours: status.currentIntervalHours,
      escalationStage: status.escalationStage,
      nextPingDueAt: status.nextPingDueAt,
      healthContextActive: status.healthContextActive,
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    logger.error(`Check-in status failed: ${errMsg}`);
    res.status(500).json({ status: 'error', message: 'Status konnte nicht abgerufen werden' });
  }
}));

// ---------------------------------------------------------------------------
// GET /api/checkin/settings — Einstellungen abrufen
// ---------------------------------------------------------------------------

checkinRouter.get('/settings', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  try {
    const settings = await checkinService.getSettings(userId);

    if (!settings) {
      res.json({
        status: 'ok',
        isActive: false,
        settings: null,
      });
      return;
    }

    res.json({
      status: 'ok',
      isActive: settings.isActive,
      settings: {
        intervalHours: settings.intervalHours,
        intervalHealthHours: settings.intervalHealthHours,
        emergencyContactName: settings.emergencyContactName,
        emergencyContactPhone: settings.emergencyContactPhone,
        emergencyContactEmail: settings.emergencyContactEmail,
        auto112Enabled: settings.auto112Enabled,
        lastPingAt: settings.lastPingAt,
      },
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    logger.error(`Check-in settings get failed: ${errMsg}`);
    res.status(500).json({ status: 'error', message: 'Einstellungen konnten nicht abgerufen werden' });
  }
}));

// ---------------------------------------------------------------------------
// PUT /api/checkin/settings — Einstellungen aktualisieren
// Body: { intervalHours?, intervalHealthHours?, emergencyContactName?,
//         emergencyContactPhone?, emergencyContactEmail?, auto112Enabled? }
// ---------------------------------------------------------------------------

checkinRouter.put('/settings', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { intervalHours, intervalHealthHours, emergencyContactName,
          emergencyContactPhone, emergencyContactEmail, auto112Enabled } = req.body || {};

  try {
    const settings = await checkinService.updateSettings(userId, {
      intervalHours: intervalHours !== undefined ? parseInt(intervalHours, 10) : undefined,
      intervalHealthHours: intervalHealthHours !== undefined ? parseInt(intervalHealthHours, 10) : undefined,
      emergencyContactName: emergencyContactName !== undefined ? emergencyContactName : undefined,
      emergencyContactPhone: emergencyContactPhone !== undefined ? emergencyContactPhone : undefined,
      emergencyContactEmail: emergencyContactEmail !== undefined ? emergencyContactEmail : undefined,
      auto112Enabled: auto112Enabled !== undefined ? auto112Enabled === true : undefined,
    });

    res.json({
      status: 'ok',
      message: 'Einstellungen aktualisiert.',
      settings: {
        intervalHours: settings.intervalHours,
        intervalHealthHours: settings.intervalHealthHours,
        emergencyContactName: settings.emergencyContactName,
        emergencyContactPhone: settings.emergencyContactPhone,
        auto112Enabled: settings.auto112Enabled,
      },
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    if (errMsg.includes('nicht aktiviert')) {
      res.status(400).json({ status: 'error', message: errMsg });
      return;
    }
    logger.error(`Check-in settings update failed: ${errMsg}`);
    res.status(500).json({ status: 'error', message: 'Einstellungen konnten nicht aktualisiert werden' });
  }
}));

// ---------------------------------------------------------------------------
// GET /api/checkin/events — Ereignis-Historie (letzte 20)
// ---------------------------------------------------------------------------

checkinRouter.get('/events', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

  try {
    const events = await checkinService.getEvents(userId, limit);
    res.json({
      status: 'ok',
      events,
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    logger.error(`Check-in events failed: ${errMsg}`);
    res.status(500).json({ status: 'error', message: 'Ereignisse konnten nicht abgerufen werden' });
  }
}));
