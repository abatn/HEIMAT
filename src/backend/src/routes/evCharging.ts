import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate';
import { evChargingService } from '../services/evChargingService';
import { evChargingStationsQuerySchema } from '../middleware/schemas';

export const evChargingRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next); };

evChargingRouter.get('/stations', validate(evChargingStationsQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const radiusKm = req.query.radius_km ? parseFloat(req.query.radius_km as string) : 5;
  const stations = await evChargingService.getNearbyStations(lat, lng, radiusKm);
  res.json({
    status: 'ok',
    stations,
    count: stations.length,
    radius_km: radiusKm,
    attribution: 'OpenStreetMap',
    license: 'ODbL-1.0',
  });
}));