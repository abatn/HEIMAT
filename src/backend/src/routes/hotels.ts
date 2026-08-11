/**
 * hotels.ts — Hotels & Unterkünfte API
 *
 * GET /api/hotels?lat=52.52&lng=13.41&radius=5
 *
 * Datenquelle: OpenStreetMap Overpass
 * KEINE hardcodierten Seiten — alles echte API-Calls.
 */

import { Router, Request, Response } from 'express';
import { HotelService } from '../services/hotelService';
import { logger } from '../utils/logger';

export const hotelsRouter = Router();
const hotelService = new HotelService();

hotelsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const latStr = req.query.lat as string;
    const lngStr = req.query.lng as string;
    if (!latStr || !lngStr || isNaN(parseFloat(latStr)) || isNaN(parseFloat(lngStr))) {
      return res.status(400).json({ error: 'lat und lng als Query-Parameter erforderlich' });
    }
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    const radius = parseFloat(req.query.radius as string) || 2;

    logger.info(`Hotels requested: lat=${lat}, lng=${lng}, radius=${radius}km`);

    const hotels = await hotelService.getNearbyHotels(lat, lng, radius);

    res.json({
      count: hotels.length,
      hotels,
      center: { lat, lng },
      radius,
    });
  } catch (error) {
    logger.error('Hotels error:', error);
    res.status(500).json({ error: 'Hotels konnten nicht geladen werden' });
  }
});
