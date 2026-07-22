import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { mobilityService } from '../services/mobilityService';
import { dbVendoService } from '../services/dbVendoService';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

export const mobilityRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next); };

// ---------------------------------------------------------------------------
// Overpass-based endpoints (lokale Haltestellen, Routing)
// ---------------------------------------------------------------------------

mobilityRouter.get('/stops', asyncHandler(async (req: Request, res: Response) => {
  const { lat, lng, radius } = req.query;
  if (!lat || !lng) throw new AppError('Latitude and longitude are required', 400);
  const latNum = parseFloat(lat as string);
  const lngNum = parseFloat(lng as string);
  const radiusNum = radius ? parseFloat(radius as string) : 1000;
  if (isNaN(latNum) || isNaN(lngNum)) throw new AppError('Invalid coordinates', 400);
  const stops = await mobilityService.getNearbyStops(latNum, lngNum, radiusNum);
  res.json({ status: 'ok', stops, count: stops.length });
}));

// Haltestellen-Suche via db-vendo (MUST be before /stops/:id!)
mobilityRouter.get('/stops/search', asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query;
  if (!q) throw new AppError('Search query is required', 400);
  const stops = await dbVendoService.searchStops(q as string, 5);
  res.json({ status: 'ok', stops, count: stops.length });
}));

mobilityRouter.get('/stops/:id', asyncHandler(async (req: Request, res: Response) => {
  const stop = await mobilityService.getStopById(req.params.id);
  res.json({ status: 'ok', stop });
}));

mobilityRouter.get('/route', asyncHandler(async (req: Request, res: Response) => {
  const { from_lat, from_lng, to_lat, to_lng } = req.query;
  if (!from_lat || !from_lng || !to_lat || !to_lng) throw new AppError('All coordinates are required', 400);
  const route = await mobilityService.getRoute(
    { lat: parseFloat(from_lat as string), lng: parseFloat(from_lng as string) },
    { lat: parseFloat(to_lat as string), lng: parseFloat(to_lng as string) },
  );
  res.json({ status: 'ok', route });
}));

mobilityRouter.get('/geocode', asyncHandler(async (req: Request, res: Response) => {
  const { address } = req.query;
  if (!address) throw new AppError('Address is required', 400);
  const results = await mobilityService.geocodeAddress(address as string);
  res.json({ status: 'ok', results });
}));

// Nächste Abfahrten via transitous.org
mobilityRouter.get('/departures', asyncHandler(async (req: Request, res: Response) => {
  const { stopId, lat, lng, duration } = req.query;

  try {
    let id = stopId as string | undefined;

    // Ohne stopId: Haltestellen in der Nähe suchen und erste nehmen
    if (!id && lat && lng) {
      const nearby = await dbVendoService.searchStopsByCoords(
        parseFloat(lat as string), parseFloat(lng as string), 1,
      );
      if (nearby.length > 0) id = nearby[0].id;
    }

    if (!id) {
      logger.warn(`Departures: keine Haltestelle gefunden (lat=${lat}, lng=${lng})`);
      res.json({ status: 'ok', departures: [], count: 0 });
      return;
    }

    const durationNum = duration ? parseInt(duration as string) : 10;
    const departures = await dbVendoService.getDepartures(id, durationNum);

    res.json({
      status: 'ok',
      departures: departures.map(d => ({
        line: d.line,
        direction: d.direction,
        mode: d.mode,
        plannedDeparture: d.plannedDeparture,
        realtimeDeparture: d.realtimeDeparture,
        delay: d.delayMinutes,
        platform: d.platform,
        stopName: d.stopName,
      })),
      count: departures.length,
    });
  } catch (e: any) {
    logger.warn(`departures fehlgeschlagen: ${e.message}`);
    res.json({ status: 'ok', departures: [], count: 0 });
  }
}));

// Verbindungssuche via transitous.org
mobilityRouter.get('/journey', asyncHandler(async (req: Request, res: Response) => {
  const { from_lat, from_lng, to_lat, to_lng } = req.query;
  try {
    const fl = parseFloat(from_lat as string);
    const fg = parseFloat(from_lng as string);
    const tl = parseFloat(to_lat as string);
    const tg = parseFloat(to_lng as string);

    if (isNaN(fl) || isNaN(fg) || isNaN(tl) || isNaN(tg)) {
      throw new AppError('All coordinates (from_lat, from_lng, to_lat, to_lng) are required', 400);
    }

    logger.info(`Journey: transitous.org ${fl},${fg} → ${tl},${tg}`);
    const journeys = await dbVendoService.getJourneys('', '', undefined, fl, fg, tl, tg);
    logger.info(`Journey: ${journeys.length} Verbindungen gefunden`);
    res.json({ status: 'ok', journeys });
  } catch (e: any) {
    logger.warn(`journey fehlgeschlagen: ${e.message}`);
    res.json({ status: 'ok', journeys: [] });
  }
}));

// ---------------------------------------------------------------------------
// ML: Delay-Logging Endpoint
// ---------------------------------------------------------------------------

mobilityRouter.post('/log-delay', asyncHandler(async (req: Request, res: Response) => {
  const { tripId, line, stopId, stopName, scheduledDeparture, actualDeparture, delayMinutes } = req.body;

  if (!tripId || !line || !scheduledDeparture) {
    throw new AppError('tripId, line, and scheduledDeparture are required', 400);
  }

  try {
    // In delay_logs Tabelle speichern (ML-Training)
    const query = `
      INSERT INTO delay_logs (trip_id, line, stop_id, stop_name, scheduled_departure, actual_departure, delay_minutes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    const values = [
      tripId,
      line,
      stopId || '',
      stopName || '',
      scheduledDeparture,
      actualDeparture || scheduledDeparture,
      delayMinutes || 0,
    ];

    await pool.query(query, values);

    logger.info(`DELAY_LOG: trip=${tripId} line=${line} delay=${delayMinutes}min`);
    res.json({ status: 'ok', logged: true });
  } catch (e: any) {
    logger.warn(`Delay-Logging fehlgeschlagen: ${e.message}`);
    res.json({ status: 'ok', logged: false });
  }
}));
