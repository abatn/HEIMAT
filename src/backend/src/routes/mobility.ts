import { Router, Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler';

export const mobilityRouter = Router();

// Get transit connections
mobilityRouter.get('/connections', async (req: Request, res: Response) => {
  const { from, to, date } = req.query;

  if (!from || !to) {
    throw new AppError('From and to coordinates are required', 400);
  }

  // TODO: Integrate with OpenRouteService / GTFS
  res.json({
    status: 'ok',
    connections: [],
    message: 'Transit connection search - coming soon',
  });
});

// Get nearby stops
mobilityRouter.get('/stops', async (req: Request, res: Response) => {
  const { lat, lng, radius } = req.query;

  if (!lat || !lng) {
    throw new AppError('Latitude and longitude are required', 400);
  }

  // TODO: Query GTFS stops
  res.json({
    status: 'ok',
    stops: [],
    message: 'Nearby stops - coming soon',
  });
});

// Get route
mobilityRouter.get('/route', async (req: Request, res: Response) => {
  const { from, to, mode } = req.query;

  if (!from || !to) {
    throw new AppError('From and to coordinates are required', 400);
  }

  // TODO: Integrate with OpenRouteService
  res.json({
    status: 'ok',
    route: null,
    message: 'Route calculation - coming soon',
  });
});
