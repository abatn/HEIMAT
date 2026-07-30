import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';
import { dbVendoService } from '../services/dbVendoService';
import { gtfsService } from '../services/gtfsService';
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

// POST /api/admin/health/cleanup – Löscht ALLE DB-Ärzte inkl. Slots + Termine
// User-Regel: "mock, simulation, fake sind verboten" — Overpass ist Primärquelle.
// Alle DB-Einträge (Dr. Test, Dr. Full, Dr. Anna Schmidt, etc.) sind Fake-Daten
// mit identischem Batch-Timestamp (nie von echten Usern registriert).
adminRouter.post('/health/cleanup', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    // Batch-Timestamp aller Fake-Ärzte (nie von echten Usern registriert,
    // alle 5 haben exakt denselben created_at — Batch-Insert durch AI-Agent).
    // WICHTIG: Kein 'Z' Suffix — PostgreSQL interpretiert 'Z' als UTC und
    // konvertiert in die Session-Timezone, was den Vergleich zerstört.
    const fakeBatchTs = '2026-07-15 18:53:44.378';

    // 1. Löschen verknüpfter Termine
    await pool.query(
      `DELETE FROM appointments WHERE doctor_id IN (
        SELECT id FROM doctors WHERE created_at = $1::timestamp
      )`,
      [fakeBatchTs]
    );

    // 2. Löschen verknüpfter Slots
    await pool.query(
      `DELETE FROM doctor_slots WHERE doctor_id IN (
        SELECT id FROM doctors WHERE created_at = $1::timestamp
      )`,
      [fakeBatchTs]
    );

    // 3. Löschen der Fake-Ärzte (Batch-Timestamp-Filter)
    const result = await pool.query(
      'DELETE FROM doctors WHERE created_at = $1::timestamp',
      [fakeBatchTs]
    );

    const deletedCount = result.rowCount ?? 0;
    logger.info(`Admin-Cleanup: ${deletedCount} Fake-Aerzte (Batch ${fakeBatchTs}) geloescht`);
    res.json({
      success: true,
      deleted: deletedCount,
      message: `${deletedCount} Fake-Aerzte (Batch ${fakeBatchTs}) geloescht. Echte registrierte Aerzte bleiben intakt.`,
    });
  } catch (error: unknown) {
    logger.error(`Admin-Cleanup failed: ${errorMessage(error)}`);
    res.status(500).json({ success: false, message: errorMessage(error) });
  }
});

// GET /api/admin/db-vendo-status – Prüft transitous.org Erreichbarkeit
// Erfordert ?lat=&lng= Query-Parameter (keine hardcoded Koordinaten mehr)
adminRouter.get('/db-vendo-status', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ success: false, message: 'lat und lng als Query-Parameter erforderlich' });
    return;
  }

  try {
    const health = await dbVendoService.healthCheck(lat, lng, `${lat},${lng}`);
    const testStops = await dbVendoService.searchStopsByCoords(lat, lng, 3);
    res.json({
      success: true,
      provider: 'transitous.org',
      apiHealth: health,
      testQuery: `${lat},${lng}`,
      testResults: testStops.length,
      sampleStop: testStops[0] || null,
    });
  } catch (error: unknown) {
    logger.error(`Admin transitous status failed: ${errorMessage(error)}`);
    res.status(500).json({ success: false, message: errorMessage(error) });
  }
});

// GET /api/admin/db-vendo-selftest – Testet transitous.org mit Abfahrten + Journey
// Erfordert ?from_lat=&from_lng=&to_lat=&to_lng= Query-Parameter
adminRouter.get('/db-vendo-selftest', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const fromLat = parseFloat(req.query.from_lat as string);
  const fromLng = parseFloat(req.query.from_lng as string);
  const toLat = parseFloat(req.query.to_lat as string);
  const toLng = parseFloat(req.query.to_lng as string);

  if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) {
    res.status(400).json({
      success: false,
      message: 'from_lat, from_lng, to_lat, to_lng als Query-Parameter erforderlich',
    });
    return;
  }

  try {
    const t0 = Date.now();

    // 1. Haltestellen in der Nähe suchen
    const stops = await dbVendoService.searchStopsByCoords(fromLat, fromLng, 5);

    // 2. Abfahrten holen
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let departures: any[] = [];
    if (stops.length > 0) {
      departures = await dbVendoService.getDepartures(stops[0].id, 5);
    }

    // 3. Journey testen
    const journeys = await dbVendoService.getJourneys(
      '', '', undefined,
      fromLat, fromLng,
      toLat, toLng,
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

// GET /api/admin/gtfs-status – GTFS-Import-Status abrufen
adminRouter.get('/gtfs-status', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const status = await gtfsService.getStatus();
    res.json({ success: true, ...status });
  } catch (error: unknown) {
    logger.error(`Admin gtfs-status failed: ${errorMessage(error)}`);
    res.status(500).json({ success: false, message: errorMessage(error) });
  }
});

export default adminRouter;
