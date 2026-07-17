import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { mobilityService } from '../services/mobilityService';
import { gtfsService } from '../services/gtfsService';
import { raptorService } from '../services/raptorService';

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

// GTFS: Nächste Abfahrten an einer Haltestelle
mobilityRouter.get('/departures', asyncHandler(async (req: Request, res: Response) => {
  const { stop, limit } = req.query;
  if (!stop) throw new AppError('Stop name is required', 400);
  const departures = await gtfsService.getDepartures(stop as string, limit ? parseInt(limit as string) : 10);
  res.json({ status: 'ok', departures, count: departures.length });
}));

// GTFS+RAPTOR: Verbindungssuche (Start → Ziel)
mobilityRouter.get('/journey', asyncHandler(async (req: Request, res: Response) => {
  const { from_lat, from_lng, to_lat, to_lng } = req.query;
  if (!from_lat || !from_lng || !to_lat || !to_lng) throw new AppError('All coordinates are required', 400);
  const fromLat = parseFloat(from_lat as string);
  const fromLng = parseFloat(from_lng as string);
  const toLat = parseFloat(to_lat as string);
  const toLng = parseFloat(to_lng as string);
  if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) throw new AppError('Invalid coordinates', 400);
  const journeys = await raptorService.findJourneys(fromLat, fromLng, toLat, toLng);
  res.json({ status: 'ok', journeys, count: journeys.length });
}));

// GTFS: Overpass-Stop mit GTFS-Stop matchen
mobilityRouter.get('/stops/match', asyncHandler(async (req: Request, res: Response) => {
  const { lat, lng, name } = req.query;
  if (!lat || !lng || !name) throw new AppError('lat, lng, and name are required', 400);
  const match = gtfsService.matchStops(parseFloat(lat as string), parseFloat(lng as string), name as string);
  res.json({ status: 'ok', match });
}));

// GTFS: Status
mobilityRouter.get('/gtfs/status', asyncHandler(async (req: Request, res: Response) => {
  const counts = await gtfsService.getCounts();
  res.json({
    status: 'ok',
    loaded: gtfsService.isLoaded(),
    stops: counts.stops,
    routes: counts.routes,
    trips: counts.trips,
    stop_times: counts.stop_times,
  });
}));
