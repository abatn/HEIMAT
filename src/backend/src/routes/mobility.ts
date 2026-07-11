import { Router, Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler';
import { mobilityService } from '../services/mobilityService';

export const mobilityRouter = Router();

// Get transit connections
mobilityRouter.get('/connections', async (req: Request, res: Response) => {
  const { from, to, date } = req.query;

  if (!from || !to) {
    throw new AppError('From and to coordinates are required', 400);
  }

  const [fromLat, fromLng] = (from as string).split(',').map(Number);
  const [toLat, toLng] = (to as string).split(',').map(Number);

  if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) {
    throw new AppError('Invalid coordinates format. Use: lat,lng', 400);
  }

  const connections = await mobilityService.getConnections(
    { lat: fromLat, lng: fromLng },
    { lat: toLat, lng: toLng }
  );

  res.json({
    status: 'ok',
    connections,
    count: connections.length,
  });
});

// Get nearby stops
mobilityRouter.get('/stops', async (req: Request, res: Response) => {
  const { lat, lng, radius } = req.query;

  if (!lat || !lng) {
    throw new AppError('Latitude and longitude are required', 400);
  }

  const latNum = parseFloat(lat as string);
  const lngNum = parseFloat(lng as string);
  const radiusNum = radius ? parseFloat(radius as string) : 500;

  if (isNaN(latNum) || isNaN(lngNum)) {
    throw new AppError('Invalid coordinates', 400);
  }

  const stops = await mobilityService.getNearbyStops(latNum, lngNum, radiusNum);

  res.json({
    status: 'ok',
    stops,
    count: stops.length,
  });
});

// Get route
mobilityRouter.get('/route', async (req: Request, res: Response) => {
  const { from, to, mode } = req.query;

  if (!from || !to) {
    throw new AppError('From and to coordinates are required', 400);
  }

  const [fromLat, fromLng] = (from as string).split(',').map(Number);
  const [toLat, toLng] = (to as string).split(',').map(Number);

  if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) {
    throw new AppError('Invalid coordinates format. Use: lat,lng', 400);
  }

  const route = await mobilityService.getRoute(
    { lat: fromLat, lng: fromLng },
    { lat: toLat, lng: toLng },
    (mode as string) || 'driving'
  );

  res.json({
    status: 'ok',
    route,
  });
});

// Geocoding: Adresse in Koordinaten umwandeln
mobilityRouter.get('/geocode', async (req: Request, res: Response) => {
  const { address } = req.query;

  if (!address) {
    throw new AppError('Address is required', 400);
  }

  // Mock-Geocoding
  const results = [
    {
      name: address as string,
      lat: 52.5200 + Math.random() * 0.01,
      lng: 13.4050 + Math.random() * 0.01,
    },
  ];

  res.json({
    status: 'ok',
    results,
  });
});
