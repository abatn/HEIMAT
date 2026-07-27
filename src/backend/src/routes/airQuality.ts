import { Router, Request, Response, NextFunction } from 'express';
import { airQualityService } from '../services/airQualityService';
import { logger } from '../utils/logger';

export const airQualityRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next); };

// ---------------------------------------------------------------------------
// GET /api/air-quality/current — Aktuelle Luftqualität für Koordinaten
// Query: lat, lng (beide erforderlich)
// ---------------------------------------------------------------------------

airQualityRouter.get('/current', asyncHandler(async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({
      status: 'error',
      message: 'lat und lng als Query-Parameter erforderlich (z.B. ?lat=52.52&lng=13.41)',
    });
    return;
  }

  try {
    const data = await airQualityService.getAirQuality(lat, lng);
    res.json({
      status: 'ok',
      airQuality: data.current,
      location: data.location,
      source: data.source,
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    logger.error(`Air quality fetch failed: ${errMsg}`);
    res.status(502).json({
      status: 'error',
      message: 'Luftqualitätsdaten konnten nicht abgerufen werden',
      detail: errMsg,
    });
  }
}));

// ---------------------------------------------------------------------------
// GET /api/air-quality/forecast — 24h-Stundenwerte + AQI-Verlauf
// Query: lat, lng
// ---------------------------------------------------------------------------

airQualityRouter.get('/forecast', asyncHandler(async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({
      status: 'error',
      message: 'lat und lng als Query-Parameter erforderlich',
    });
    return;
  }

  try {
    const data = await airQualityService.getAirQuality(lat, lng);
    res.json({
      status: 'ok',
      current: data.current,
      hourly: data.hourly,
      location: data.location,
      source: data.source,
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    logger.error(`Air quality forecast fetch failed: ${errMsg}`);
    res.status(502).json({
      status: 'error',
      message: 'Luftqualitäts-Vorhersage konnte nicht abgerufen werden',
      detail: errMsg,
    });
  }
}));

// ---------------------------------------------------------------------------
// GET /api/air-quality/status — Service-Status (z.B. für Health-Checks)
// ---------------------------------------------------------------------------

airQualityRouter.get('/status', asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'air-quality',
    source: 'Copernicus Atmosphere Monitoring Service (CAMS) via Open-Meteo',
    attribution: 'Generated using Copernicus Atmosphere Monitoring Service information (2025)',
    version: '1.0',
  });
}));
