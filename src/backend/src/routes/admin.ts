import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';
import { dbVendoService } from '../services/dbVendoService';
import { logger } from '../utils/logger';

const adminRouter = Router();

const ADMIN_KEY = process.env.ADMIN_KEY || 'heimat-admin-2024';

function requireAdmin(req: Request, res: Response): boolean {
  const key = req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) {
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
  } catch (error: any) {
    logger.error(`Admin migrate failed: ${error.message}`);
    res.status(500).json({ success: false, message: error.message || 'Migration failed' });
  }
});

// GET /api/admin/db-vendo-status – Prüft db-vendo-client Erreichbarkeit
adminRouter.get('/db-vendo-status', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const health = await dbVendoService.healthCheck();
    const testStops = await dbVendoService.searchStops('Hauptbahnhof', 3);
    res.json({
      success: true,
      dbRest: health,
      testQuery: 'Hauptbahnhof',
      testResults: testStops.length,
      sampleStop: testStops[0] || null,
    });
  } catch (error: any) {
    logger.error(`Admin db-vendo status failed: ${error.message}`);
    res.status(500).json({ success: false, message: error.message || 'Status check failed' });
  }
});

// GET /api/admin/db-vendo-selftest – Testet db-vendo-client mit Abfahrten + Journey
adminRouter.get('/db-vendo-selftest', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const query = (req.query.q as string) || 'Berlin Hauptbahnhof';
    const t0 = Date.now();

    // 1. Haltestelle suchen
    const stops = await dbVendoService.searchStops(query, 3);

    // 2. Abfahrten holen
    let departures: any[] = [];
    if (stops.length > 0) {
      departures = await dbVendoService.getDepartures(stops[0].id, 5);
    }

    // 3. Journey testen (erste Haltestelle → zweite)
    let journeys: any[] = [];
    if (stops.length >= 2) {
      journeys = await dbVendoService.getJourneys(stops[0].id, stops[1].id);
    }

    res.json({
      success: true,
      query,
      ms: Date.now() - t0,
      stops: stops.length,
      departures: departures.length,
      journeys: journeys.length,
      sampleStop: stops[0] || null,
      sampleDeparture: departures[0] || null,
      sampleJourney: journeys[0] || null,
    });
  } catch (error: any) {
    logger.error(`Admin db-vendo selftest failed: ${error.message}`);
    res.status(500).json({ success: false, message: error.message || 'selftest failed' });
  }
});

export default adminRouter;
