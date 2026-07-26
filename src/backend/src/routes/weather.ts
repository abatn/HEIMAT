import { Router, Request, Response, NextFunction } from 'express';
import { weatherService } from '../services/weatherService';
import { logger } from '../utils/logger';

export const weatherRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next); };

// ---------------------------------------------------------------------------
// GET /api/weather/current — Aktuelle Wetterdaten für Koordinaten
// Query: lat, lng (beide erforderlich)
// ---------------------------------------------------------------------------

weatherRouter.get('/current', asyncHandler(async (req: Request, res: Response) => {
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
    const data = await weatherService.getWeather(lat, lng);
    res.json({
      status: 'ok',
      weather: data.current,
      location: data.location,
      source: data.source,
    });
  } catch (e: unknown) {
    logger.error(`Weather fetch failed: ${e}`);
    res.status(502).json({
      status: 'error',
      message: 'Wetterdaten konnten nicht abgerufen werden',
    });
  }
}));

// ---------------------------------------------------------------------------
// GET /api/weather/forecast — 7-Tage-Vorhersage + 24h-Stundenwerte
// Query: lat, lng
// ---------------------------------------------------------------------------

weatherRouter.get('/forecast', asyncHandler(async (req: Request, res: Response) => {
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
    const data = await weatherService.getWeather(lat, lng);
    res.json({
      status: 'ok',
      current: data.current,
      hourly: data.hourly,
      daily: data.daily,
      location: data.location,
      source: data.source,
    });
  } catch (e: unknown) {
    logger.error(`Weather forecast fetch failed: ${e}`);
    res.status(502).json({
      status: 'error',
      message: 'Wettervorhersage konnte nicht abgerufen werden',
    });
  }
}));

// ---------------------------------------------------------------------------
// GET /api/weather/status — Exchange-Status (z.B. für Health-Checks)
// ---------------------------------------------------------------------------

weatherRouter.get('/status', asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'weather',
    source: 'Deutscher Wetterdienst (DWD) via Open-Meteo',
    attribution: 'DWD Open Data (CC-BY 4.0)',
    version: '1.0',
  });
}));
