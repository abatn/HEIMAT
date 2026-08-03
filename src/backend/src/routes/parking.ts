import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate';
import { parkingService } from '../services/parkingService';
import { parkingSpotsQuerySchema } from '../middleware/schemas';

export const parkingRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next); };

parkingRouter.get('/spots', validate(parkingSpotsQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const radiusKm = req.query.radius_km ? parseFloat(req.query.radius_km as string) : 2;
  const spots = await parkingService.getNearbySpots(lat, lng, radiusKm);
  res.json({
    status: 'ok',
    spots,
    count: spots.length,
    radius_km: radiusKm,
    attribution: 'OpenStreetMap',
    license: 'ODbL-1.0',
  });
}));
