import { Router, Request, Response, NextFunction } from 'express';
import { weatherService } from '../services/weatherService';
import { generateAlerts } from '../services/weatherAlertsService';
import { logger } from '../utils/logger';
import type { WeatherData } from '../services/weatherService';

// ---------------------------------------------------------------------------
// Intelligent Weather Tips — Pure Rule-Engine
//
// Erzeugt kontextbezogene Empfehlungen basierend auf Wetterdaten.
// Keine externen API-Calls, keine AI — reine Logik.
// ---------------------------------------------------------------------------

interface WeatherTip {
  icon: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
  category: 'activity' | 'health' | 'clothing' | 'transport';
}

function generateWeatherTips(data: WeatherData): WeatherTip[] {
  const tips: WeatherTip[] = [];
  const c = data.current;
  const temp = c.temperature;
  const wind = c.windSpeed;
  const rain = c.precipitation;
  // WMO Weather Codes: 50-67 = Regen, 70-77 = Schnee, 80-82 = Schauer
  const isRaining = c.weatherCode >= 50 && c.weatherCode <= 82;
  const uvIndex = c.uvIndex;

  // Temperatur-basierte Tipps
  if (temp < 0) {
    tips.push({ icon: '🥶', text: 'Eisig kalt! Warm anziehen, Mütze und Handschuhe nicht vergessen.', priority: 'high', category: 'clothing' });
  } else if (temp < 5) {
    tips.push({ icon: '🧣', text: 'Kalt! Jacke, Schal und ggf. Mütze empfohlen.', priority: 'high', category: 'clothing' });
  } else if (temp < 15) {
    tips.push({ icon: '🧥', text: 'Kühlere Temperaturen — eine leichte Jacke ist sinnvoll.', priority: 'medium', category: 'clothing' });
  } else if (temp > 30) {
    tips.push({ icon: '☀️', text: 'Heiß! Viel trinken und Sonnenschutz nicht vergessen.', priority: 'high', category: 'health' });
  } else if (temp > 25) {
    tips.push({ icon: '😎', text: 'Angenehm warm — perfekt für Aktivitäten draußen!', priority: 'low', category: 'activity' });
  }

  // Regen-Tipps
  if (isRaining) {
    tips.push({ icon: '☔', text: 'Es regnet gerade — Regenjacke oder Schirm mitnehmen!', priority: 'high', category: 'clothing' });
  } else if (rain > 0.5) {
    tips.push({ icon: '🌧️', text: 'Leichter Regen erwartet — Schirm einpacken.', priority: 'medium', category: 'clothing' });
  }

  // Wind-Tipps
  if (wind > 40) {
    tips.push({ icon: '💨', text: 'Starker Wind! Vorsicht bei Fahrrad und offenem Regenschirm.', priority: 'high', category: 'transport' });
  } else if (wind > 25) {
    tips.push({ icon: '🌬️', text: 'Windig — leichte Jacke schützt vor Windchill.', priority: 'medium', category: 'clothing' });
  }

  // Aktivitäts-Tipps
  if (!isRaining && temp >= 15 && temp <= 28 && wind < 25) {
    tips.push({ icon: '🚴', text: 'Perfektes Wetter für eine Runde draußen!', priority: 'low', category: 'activity' });
  }

  // UV-Tipp
  if (uvIndex != null && uvIndex > 6) {
    tips.push({ icon: '🧴', text: 'Hoher UV-Index — Sonnenschutz verwenden!', priority: 'medium', category: 'health' });
  }

  // Tageszeit-basierte Tipps
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 9 && !isRaining && temp >= 10) {
    tips.push({ icon: '🌅', text: 'Guter Morgen für eine Frühsport-Einheit!', priority: 'low', category: 'activity' });
  }

  return tips.slice(0, 5); // Max 5 Tipps für UI-Klarheit
}

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
    const tips = generateWeatherTips(data);
    res.json({
      status: 'ok',
      current: data.current,
      hourly: data.hourly,
      daily: data.daily,
      location: data.location,
      source: data.source,
      tips,
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
