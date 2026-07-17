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

// GET /api/admin/efa-selftest – testet jeden Endpunkt mit findStop + ersten Departures
adminRouter.get('/efa-selftest', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { efaService } = await import('../services/efaService');
    const axios = (await import('axios')).default;
    const query = (req.query.q as string) || 'Hauptbahnhof';
    const results: any[] = [];
    for (const ep of Object.values(EFA_ENDPOINTS)) {
      const t0 = Date.now();
      let rawStatus = 'n/a';
      try {
        const raw = await axios.get(ep.baseUrl, { timeout: 5000, validateStatus: () => true, headers: { 'User-Agent': 'HEIMAT/1.0' } });
        rawStatus = `HTTP ${raw.status}`;
      } catch (e: any) {
        rawStatus = `ERR: ${e?.code || e?.message || e}`;
      }
      try {
        const stops = await efaService.findStop(query, 3, ep.center[0], ep.center[1]);
        let deps = 0;
        if (stops.length > 0) {
          const d = await efaService.getDepartures(stops[0].id, 3, ep.key);
          deps = d.length;
        }
        results.push({ key: ep.key, name: ep.name, ms: Date.now() - t0, rawBase: rawStatus, stops: stops.length, departures: deps, sampleStop: stops[0]?.name || null });
      } catch (e: any) {
        results.push({ key: ep.key, name: ep.name, ms: Date.now() - t0, rawBase: rawStatus, error: e?.message || String(e) });
      }
    }
    res.json({ success: true, query, results });
  }
});

// GET /api/admin/net-test – prüft Erreichbarkeit generischer ÖPNV-Kandidaten von Render aus
adminRouter.get('/net-test', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const axios = (await import('axios')).default;
    const candidates = [
      'https://v6.vbb.bahn.de/efa/XML_STOPFINDER_REQUEST?type_sf=stop&name_sf=Hauptbahnhof&limit=1',
      'https://v6.bvg.transport.rest/stops/nearby?latitude=52.52&longitude=13.40',
      'https://v6.vbb.transport.rest/stops/nearby?latitude=52.52&longitude=13.40',
      'https://api.deutschebahn.com/freeplan/v1/location?query=Hauptbahnhof',
      'https://vrrf.finalrewind.org/XML_DM_REQUEST?type_dm=stop&name_dm=Hauptbahnhof&limit=1',
      'https://www.vrr.de/efa/XML_STOPFINDER_REQUEST?type_sf=stop&name_sf=Hauptbahnhof&limit=1',
      'https://efa.vrr.de/standard/XML_STOPFINDER_REQUEST?type_sf=stop&name_sf=Hauptbahnhof&limit=1',
      'https://www.vrs.de/viso/XML_STOPFINDER_REQUEST?type_sf=stop&name_sf=Hauptbahnhof&limit=1',
      'https://netex.ivb.no/geocoder/2.0/Autocomplete?text=Hauptbahnhof',
      'https://www2.vvs.de/viso/XML_STOPFINDER_REQUEST?type_sf=stop&name_sf=Hauptbahnhof&limit=1',
      'https://www.openstreetmap.org/api/0.6/map?bbox=13.39,52.51,13.41,52.53',
      'https://overpass-api.de/api/interpreter?data=%5Bout%5D%3B',
    ];
    const out: any[] = [];
    for (const url of candidates) {
      const t0 = Date.now();
      try {
        const r = await axios.get(url, { timeout: 8000, validateStatus: () => true, headers: { 'User-Agent': 'HEIMAT/1.0' } });
        out.push({ url, status: r.status, ms: Date.now() - t0, len: (r.data?.length || 0) });
      } catch (e: any) {
        out.push({ url, error: e?.code || e?.message || String(e), ms: Date.now() - t0 });
      }
    }
    res.json({ success: true, results: out });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'net test failed' });
  }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'selftest failed' });
  }
});

export default adminRouter;
