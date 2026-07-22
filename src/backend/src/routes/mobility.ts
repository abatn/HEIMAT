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

// Nächste Abfahrten via db-vendo
mobilityRouter.get('/departures', asyncHandler(async (req: Request, res: Response) => {
  const { stop, stopId, duration } = req.query;
  if (!stop && !stopId) throw new AppError('Stop name or stopId is required', 400);

  try {
    let id: string | undefined = stopId as string | undefined;
    let stopName = (stop as string) || (stopId as string) || '';

    // Haltestelle über db-vendo suchen, falls keine ID angegeben
    if (!id && stop) {
      logger.info(`Departures: suche Haltestelle "${stop}"`);
      const found = await dbVendoService.searchStops(stop as string, 1);
      logger.info(`Departures: Suche ergab ${found.length} Treffer: ${found.map(s => `${s.name} (${s.id})`).join(', ')}`);
      if (found.length > 0) { id = found[0].id; stopName = found[0].name; }
    }

    if (!id) {
      logger.warn(`Departures: keine Haltestelle gefunden für "${stopName}"`);
      res.json({ status: 'ok', stop: stopName, departures: [], count: 0 });
      return;
    }

    const durationNum = duration ? parseInt(duration as string) : 10;
    const departures = await dbVendoService.getDepartures(id, durationNum);

    res.json({
      status: 'ok',
      stop: stopName,
      departures: departures.map(d => ({
        line: d.line,
        direction: d.direction,
        mode: d.mode,
        plannedDeparture: d.plannedDeparture,
        realtimeDeparture: d.realtimeDeparture,
        delay: d.delayMinutes,
        platform: d.platform,
      })),
      count: departures.length,
    });
  } catch (e: any) {
    logger.warn(`db-rest departures fehlgeschlagen: ${e.message}`);
    res.json({ status: 'ok', departures: [], count: 0 });
  }
}));

// Verbindungssuche via db-vendo
mobilityRouter.get('/journey', asyncHandler(async (req: Request, res: Response) => {
  const { from_lat, from_lng, to_lat, to_lng, from_id, to_id } = req.query;
  try {
    let fromId = from_id as string | undefined;
    let toId = to_id as string | undefined;

    // Koordinaten → db-vendo Haltestellen-Suche via nearby
    if (!fromId && from_lat && from_lng) {
      const fl = parseFloat(from_lat as string);
      const fg = parseFloat(from_lng as string);
      if (isNaN(fl) || isNaN(fg)) throw new AppError('Invalid from coordinates', 400);
      logger.info(`Journey: suche Start-Haltestelle bei ${fl},${fg}`);
      const found = await dbVendoService.searchStopsByCoords(fl, fg, 1);
      logger.info(`Journey: Start-Suche ergab ${found.length} Treffer: ${found.map(s => s.name).join(', ')}`);
      if (found.length > 0) fromId = found[0].id;
    }
    if (!toId && to_lat && to_lng) {
      const tl = parseFloat(to_lat as string);
      const tg = parseFloat(to_lng as string);
      if (isNaN(tl) || isNaN(tg)) throw new AppError('Invalid to coordinates', 400);
      logger.info(`Journey: suche Ziel-Haltestelle bei ${tl},${tg}`);
      const found = await dbVendoService.searchStopsByCoords(tl, tg, 1);
      logger.info(`Journey: Ziel-Suche ergab ${found.length} Treffer: ${found.map(s => s.name).join(', ')}`);
      if (found.length > 0) toId = found[0].id;
    }

    if (!fromId || !toId) {
      logger.warn(`Journey: keine Haltestellen gefunden. fromId=${fromId}, toId=${toId}`);
      throw new AppError('Start and destination are required (from_id/to_id or coordinates)', 400);
    }

    logger.info(`Journey: suche Verbindung von ${fromId} nach ${toId}`);
    const journeys = await dbVendoService.getJourneys(fromId, toId);
    logger.info(`Journey: ${journeys.length} Verbindungen gefunden`);
    res.json({ status: 'ok', journeys });
  } catch (e: any) {
    logger.warn(`db-rest journey fehlgeschlagen: ${e.message}`);
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
