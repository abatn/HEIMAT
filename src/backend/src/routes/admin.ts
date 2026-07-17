import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';
import { EFA_ENDPOINTS } from '../services/efaService';
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

// GET /api/admin/efa-status – Liste der verfügbaren EFA-Endpunkte
adminRouter.get('/efa-status', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const endpoints = Object.values(EFA_ENDPOINTS).map(e => ({ key: e.key, name: e.name }));
    res.json({ success: true, endpoints, count: endpoints.length });
  } catch (error: any) {
    logger.error(`Admin EFA status failed: ${error.message}`);
    res.status(500).json({ success: false, message: error.message || 'Status check failed' });
  }
});

export default adminRouter;
