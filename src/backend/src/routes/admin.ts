import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { pool, query } from '../config/database';
import { gtfsService } from '../services/gtfsService';
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

// POST /api/admin/import-gtfs – GTFS-Feed herunterladen, parsen und importieren
adminRouter.post('/import-gtfs', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    await gtfsService.downloadAndParse();
    const stats = await gtfsService.importToDatabase();
    res.json({ success: true, message: 'GTFS imported', stats });
  } catch (error: any) {
    logger.error(`Admin GTFS import failed: ${error.message}`);
    res.status(500).json({ success: false, message: error.message || 'GTFS import failed' });
  }
});

// GET /api/admin/gtfs-status – Anzahl Rows pro GTFS-Tabelle
adminRouter.get('/gtfs-status', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const tables = ['gtfs_stops', 'gtfs_routes', 'gtfs_trips', 'gtfs_stop_times', 'gtfs_calendar', 'gtfs_stop_match'];
    const counts: Record<string, number> = {};

    for (const table of tables) {
      const rows = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${table}`);
      counts[table] = parseInt(rows[0]?.count || '0', 10);
    }

    res.json({ success: true, counts });
  } catch (error: any) {
    logger.error(`Admin GTFS status failed: ${error.message}`);
    res.status(500).json({ success: false, message: error.message || 'Status check failed' });
  }
});

export default adminRouter;
