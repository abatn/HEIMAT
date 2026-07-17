import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { mobilityService } from '../services/mobilityService';
import { efaService } from '../services/efaService';
import { logger } from '../utils/logger';

export const mobilityRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next); };

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

mobilityRouter.get('/stops/search', asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query;
  if (!q) throw new AppError('Search query is required', 400);
  const stops = await mobilityService.searchStops(q as string);
  res.json({ status: 'ok', stops, count: stops.length });
}));

mobilityRouter.get('/stops/:id', asyncHandler(async (req: Request, res: Response) => {
  const stop = await mobilityService.getStopById(req.params.id);
  res.json({ status: 'ok', stop });
}));

mobilityRouter.get('/route', asyncHandler(async (req: Request, res: Response) => {
  const { from_lat, from_lng, to_lat, to_lng } = req.query;
  if (!from_lat || !from_lng || !to_lat || !to_lng) throw new AppError('All coordinates are required', 400);
  const route = await mobilityService.getRoute({ lat: parseFloat(from_lat as string), lng: parseFloat(from_lng as string) }, { lat: parseFloat(to_lat as string), lng: parseFloat(to_lng as string) });
  res.json({ status: 'ok', route });
}));

mobilityRouter.get('/geocode', asyncHandler(async (req: Request, res: Response) => {
  const { address } = req.query;
  if (!address) throw new AppError('Address is required', 400);
  const results = await mobilityService.geocodeAddress(address as string);
  res.json({ status: 'ok', results });
}));

// EFA: Nächste Abfahrten an einer Haltestelle
mobilityRouter.get('/departures', asyncHandler(async (req: Request, res: Response) => {
  const { stop, stopId, limit } = req.query;
  if (!stop && !stopId) throw new AppError('Stop name or stopId is required', 400);
  try {
    // IFOPT-ID direkt nutzen, sonst Haltestelle über EFA suchen
    let id: string | undefined = stopId as string | undefined;
    let stopName = (stop as string) || (stopId as string) || '';
    if (!id && stop) {
      const found = await efaService.findStop(stop as string, 1);
      if (found.length > 0) { id = found[0].id; stopName = found[0].name; }
    }
    if (!id) { res.json({ status: 'ok', stop: stopName, departures: [], count: 0 }); return; }
    const limitNum = limit ? parseInt(limit as string) : 10;
    const dep = await efaService.getDepartures(id, limitNum);
    const departures = dep.map(d => ({
      line: d.line,
      direction: d.direction,
      mode: d.mode,
      plannedDeparture: d.plannedDeparture,
      realtimeDeparture: d.realtimeDeparture,
      delay: d.delayMinutes,
      platform: d.platform,
    }));
    res.json({ status: 'ok', stop: stopName, departures, count: departures.length });
  } catch (e) {
    logger.warn(`EFA departures fehlgeschlagen: ${e}`);
    res.json({ status: 'ok', departures: [], count: 0 });
  }
}));

// EFA: Verbindungssuche (Start → Ziel)
mobilityRouter.get('/journey', asyncHandler(async (req: Request, res: Response) => {
  const { from_lat, from_lng, to_lat, to_lng, from_id, to_id } = req.query;
  try {
    let fromId = from_id as string | undefined;
    let toId = to_id as string | undefined;

    // Koordinaten: nächste Haltestelle via Overpass suchen
    if (!fromId && from_lat && from_lng) {
      const fl = parseFloat(from_lat as string);
      const fg = parseFloat(from_lng as string);
      if (isNaN(fl) || isNaN(fg)) throw new AppError('Invalid from coordinates', 400);
      const stops = await mobilityService.getNearbyStops(fl, fg, 1000);
      if (stops.length > 0) fromId = stops[0].id;
    }
    if (!toId && to_lat && to_lng) {
      const tl = parseFloat(to_lat as string);
      const tg = parseFloat(to_lng as string);
      if (isNaN(tl) || isNaN(tg)) throw new AppError('Invalid to coordinates', 400);
      const stops = await mobilityService.getNearbyStops(tl, tg, 1000);
      if (stops.length > 0) toId = stops[0].id;
    }

    if (!fromId || !toId) throw new AppError('Start and destination are required (from_id/to_id or coordinates)', 400);

    const journeys = await efaService.getJourney(fromId, toId);
    res.json({ status: 'ok', journeys });
  } catch (e) {
    logger.warn(`EFA journey fehlgeschlagen: ${e}`);
    res.json({ status: 'ok', journeys: [] });
  }
}));
