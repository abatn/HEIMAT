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
    const lat = parseFloat(req.query.lat as string) || 52.52;
    const lng = parseFloat(req.query.lng as string) || 13.41;
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
