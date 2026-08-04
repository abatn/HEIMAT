/**
 * buergeramt.ts — Bürgerämter & Behörden API
 *
 * GET /api/buergeramt?lat=52.52&lng=13.41&radius=10
 *
 * Datenquelle: OpenStreetMap Nominatim
 * KEINE hardcodierten Seiten — alles echte API-Calls.
 */

import { Router, Request, Response } from 'express';
import { BuergeramtService } from '../services/buergeramtService';
import { logger } from '../utils/logger';

export const buergeramtRouter = Router();
const buergeramtService = new BuergeramtService();

buergeramtRouter.get('/', async (req: Request, res: Response) => {
  try {
    const latStr = req.query.lat as string;
    const lngStr = req.query.lng as string;
    if (!latStr || !lngStr || isNaN(parseFloat(latStr)) || isNaN(parseFloat(lngStr))) {
      return res.status(400).json({ error: 'lat und lng als Query-Parameter erforderlich' });
    }
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    const radius = parseFloat(req.query.radius as string) || 10;

    logger.info(`Bürgeramt requested: lat=${lat}, lng=${lng}, radius=${radius}km`);

    const aemter = await buergeramtService.getNearbyAemter(lat, lng, radius);

    res.json({
      count: aemter.length,
      aemter,
      center: { lat, lng },
      radius,
    });
  } catch (error) {
    logger.error('Bürgeramt error:', error);
    res.status(500).json({ error: 'Bürgerämter konnten nicht geladen werden' });
  }
});
