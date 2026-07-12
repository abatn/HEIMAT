import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { mobilityService } from '../services/mobilityService';

export const mobilityRouter = Router();

const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Get nearby stops
mobilityRouter.get('/stops', asyncHandler(async (req: Request, res: Response) => {
  const { lat, lng, radius } = req.query;

  if (!lat || !lng) {
    throw new AppError('Latitude and longitude are required', 400);
  }

  const latNum = parseFloat(lat as string);
  const lngNum = parseFloat(lng as string);
  const radiusNum = radius ? parseFloat(radius as string) : 1000;

  if (isNaN(latNum) || isNaN(lngNum)) {
    throw new AppError('Invalid coordinates', 400);
  }

  const stops = await mobilityService.getNearbyStops(latNum, lngNum, radiusNum);

  res.json({
    status: 'ok',
    stops,
    count: stops.length,
  });
}));

// Get stop by ID
mobilityRouter.get('/stops/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const stop = await mobilityService.getStopById(id);

  res.json({
    status: 'ok',
    stop,
  });
}));

// Search stops
mobilityRouter.get('/stops/search', asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query;

  if (!q) {
    throw new AppError('Search query is required', 400);
  }

  const stops = await mobilityService.searchStops(q as string);

  res.json({
    status: 'ok',
    stops,
    count: stops.length,
  });
}));

// Get route
mobilityRouter.get('/route', asyncHandler(async (req: Request, res: Response) => {
  const { from_lat, from_lng, to_lat, to_lng } = req.query;

  if (!from_lat || !from_lng || !to_lat || !to_lng) {
    throw new AppError('All coordinates are required', 400);
  }

  const route = await mobilityService.getRoute(
    { lat: parseFloat(from_lat as string), lng: parseFloat(from_lng as string) },
    { lat: parseFloat(to_lat as string), lng: parseFloat(to_lng as string) }
  );

  res.json({
    status: 'ok',
    route,
  });
}));

// Geocoding
mobilityRouter.get('/geocode', asyncHandler(async (req: Request, res: Response) => {
  const { address } = req.query;

  if (!address) {
    throw new AppError('Address is required', 400);
  }

  const results = await mobilityService.geocodeAddress(address as string);

  res.json({
    status: 'ok',
    results,
  });
}));
