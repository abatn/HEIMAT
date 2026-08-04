/**
 * events.ts — Events & Veranstaltungen API
 *
 * GET /api/events?lat=52.52&lng=13.41&radius=10
 *
 * Datenquellen: Wikidata SPARQL + OSM Overpass
 * KEINE hardcodierten Seiten — alles echte API-Calls.
 */

import { Router, Request, Response } from 'express';
import { EventService } from '../services/eventService';
import { logger } from '../utils/logger';

export const eventsRouter = Router();
const eventService = new EventService();

eventsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const latStr = req.query.lat as string;
    const lngStr = req.query.lng as string;
    if (!latStr || !lngStr || isNaN(parseFloat(latStr)) || isNaN(parseFloat(lngStr))) {
      return res.status(400).json({ error: 'lat und lng als Query-Parameter erforderlich' });
    }
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    const radius = parseFloat(req.query.radius as string) || 10;

    logger.info(`Events requested: lat=${lat}, lng=${lng}, radius=${radius}km`);

    const events = await eventService.getNearbyEvents(lat, lng, radius);

    res.json({
      count: events.length,
      events,
      center: { lat, lng },
      radius,
    });
  } catch (error) {
    logger.error('Events error:', error);
    res.status(500).json({ error: 'Events konnten nicht geladen werden' });
  }
});
