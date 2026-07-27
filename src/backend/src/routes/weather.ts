import { Router, Request, Response, NextFunction } from 'express';
import { weatherService } from '../services/weatherService';
import { generateAlerts } from '../services/weatherAlertsService';
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
    const errMsg = e instanceof Error ? e.message : String(e);
    logger.error(`Weather fetch failed: ${errMsg}`);
    res.status(502).json({
      status: 'error',
      message: 'Wetterdaten konnten nicht abgerufen werden',
      detail: errMsg,
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
    const errMsg = e instanceof Error ? e.message : String(e);
    logger.error(`Weather forecast fetch failed: ${errMsg}`);
    res.status(502).json({
      status: 'error',
      message: 'Wettervorhersage konnte nicht abgerufen werden',
      detail: errMsg,
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

// ---------------------------------------------------------------------------
// GET /api/weather/alerts — Rule-Engine Unwetter-Früherkennung
//
// Phase E Forecast-Schicht (Phase 1 nach AI-Implementierungsplan.md):
// Pure Rule-Engine on top of Open-Meteo Data. KEIN Cloud-AI.
// STURM (>50 km/h) + EXTREMREGEN (prob>80% AND mm>5) + DAUERREGEN (3-Tage-Sliding).
//
// Query: lat, lng (beide erforderlich).
// Response: { status, alerts[], generatedAt, source, attribution }
//
// Architektur: alerts-service nimmt forecast als INPUT — kein doppelter
// Open-Meteo-Fetch. weatherService.getWeather() hat bereits 5-Min Cache.
// ---------------------------------------------------------------------------

weatherRouter.get('/alerts', asyncHandler(async (req: Request, res: Response) => {
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
    // Single Source of Truth: weatherService hat bereits gecachte Daten.
    // alerts-service ist pure-function, kein doppelter HTTP-Call.
    const forecast = await weatherService.getWeather(lat, lng);
    const alerts = generateAlerts(forecast);

    res.json({
      status: 'ok',
      alerts,
      generatedAt: new Date().toISOString(),
      source: 'rule-engine-v1',
      attribution: 'DWD Open Data via Open-Meteo (CC-BY 4.0)',
    });
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    logger.error(`Weather alerts fetch failed: ${errMsg}`);
    res.status(502).json({
      status: 'error',
      message: 'Unwetter-Alerts konnten nicht berechnet werden',
      detail: errMsg,
    });
  }
}));
