import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';
import { dbVendoService } from '../services/dbVendoService';
import { logger } from '../utils/logger';
import { errorMessage } from '../utils/error';

const adminRouter = Router();

function requireAdmin(req: Request, res: Response): boolean {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    res.status(503).json({ success: false, message: 'Admin endpoints disabled: ADMIN_KEY not configured' });
    return false;
  }
  const key = req.headers['x-admin-key'];
  if (key !== adminKey) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return false;
  }
  return true;
}

// POST /api/admin/migrate – Schema aus schema.sql ausführen
adminRouter.post('/migrate', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    res.json({ success: true, message: 'Schema migrated' });
  } catch (error: unknown) {
    logger.error(`Admin migrate failed: ${errorMessage(error)}`);
    res.status(500).json({ success: false, message: errorMessage(error) });
  }
});

// GET /api/admin/db-vendo-status – Prüft transitous.org Erreichbarkeit
adminRouter.get('/db-vendo-status', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const health = await dbVendoService.healthCheck();
    const testStops = await dbVendoService.searchStopsByCoords(52.52, 13.40, 3);
    res.json({
      success: true,
      provider: 'transitous.org',
      apiHealth: health,
      testQuery: '52.52,13.40 (Berlin Mitte)',
      testResults: testStops.length,
      sampleStop: testStops[0] || null,
    });
  } catch (error: unknown) {
    logger.error(`Admin transitous status failed: ${errorMessage(error)}`);
    res.status(500).json({ success: false, message: errorMessage(error) });
  }
});

// GET /api/admin/db-vendo-selftest – Testet transitous.org mit Abfahrten + Journey
adminRouter.get('/db-vendo-selftest', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const t0 = Date.now();

    // 1. Haltestellen in der Nähe suchen
    const stops = await dbVendoService.searchStopsByCoords(52.52, 13.40, 5);

    // 2. Abfahrten holen
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let departures: any[] = [];
    if (stops.length > 0) {
      departures = await dbVendoService.getDepartures(stops[0].id, 5);
    }

    // 3. Journey testen (Alexanderplatz → Hauptbahnhof)
    const journeys = await dbVendoService.getJourneys(
      '', '', undefined,
      52.5219, 13.4132, // Alexanderplatz
      52.5255, 13.3695, // Hauptbahnhof
    );

    res.json({
      success: true,
      provider: 'transitous.org',
      ms: Date.now() - t0,
      stops: stops.length,
      departures: departures.length,
      journeys: journeys.length,
      sampleStop: stops[0] || null,
      sampleDeparture: departures[0] || null,
      sampleJourney: journeys[0] || null,
    });
  } catch (error: unknown) {
    logger.error(`Admin transitous selftest failed: ${errorMessage(error)}`);
    res.status(500).json({ success: false, message: errorMessage(error) });
  }
});

export default adminRouter;
