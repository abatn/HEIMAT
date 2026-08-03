import { Router, Request, Response, NextFunction } from 'express';
import { airQualityService } from '../services/airQualityService';
import { logger } from '../utils/logger';
import type { AirQualityData } from '../services/airQualityService';

// ---------------------------------------------------------------------------
// Intelligent Air Quality Tips — Pure Rule-Engine
//
// EU AQI Scale:
//   0-20:  Gut 🟢 — Sport draußen uneingeschränkt möglich
//   20-40: Befriedigend 🟡 — empfindliche Personen beachten
//   40-60: Mässig 🟠 — empfindliche Personen einschränken
//   60-80: Schlecht 🔴 — Ausdauersport vermeiden
//   80-100: Sehr schlecht 🟤 — Aufenthalte draußen einschränken
//   100+:  Extrem ⚫ — Aufenthalte draußen vermeiden
// ---------------------------------------------------------------------------

interface AirQualityTip {
  icon: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
  category: 'health' | 'activity' | 'children' | 'elderly';
}

function generateAirQualityTips(data: AirQualityData): AirQualityTip[] {
  const tips: AirQualityTip[] = [];
  const aqi = data.current.europeanAqi;
  const pm25 = data.current.pm25;
  const pm10 = data.current.pm10;

  if (aqi == null) return tips;

  // AQI-basierte Health-Tipps
  if (aqi <= 20) {
    tips.push({ icon: '🌿', text: 'Ausgezeichnete Luftqualität! Perfekt für Sport und Aktivitäten draußen.', priority: 'low', category: 'activity' });
  } else if (aqi <= 40) {
    tips.push({ icon: '👍', text: 'Gute Luft. Empfindliche Personen können problemlos draußen sein.', priority: 'low', category: 'activity' });
  } else if (aqi <= 60) {
    tips.push({ icon: '⚠️', text: 'Mässige Luftqualität. Empfindliche Personen sollten längere Aufenthalte draußen vermeiden.', priority: 'medium', category: 'health' });
    tips.push({ icon: '🧒', text: 'Kinder und Asthmatiker: outdoor-Aktivitäten kürzen.', priority: 'medium', category: 'children' });
  } else if (aqi <= 80) {
    tips.push({ icon: '🔴', text: 'Schlechte Luft! Ausdauersport draußen vermeiden.', priority: 'high', category: 'activity' });
    tips.push({ icon: '🫁', text: 'Bei Atemwegsproblemen: Fenster geschlossen halten.', priority: 'high', category: 'health' });
  } else if (aqi <= 100) {
    tips.push({ icon: '🟤', text: 'Sehr schlechte Luft! Aufenthalte draußen einschränken.', priority: 'high', category: 'health' });
    tips.push({ icon: '👴', text: 'Ältere Menschen und Risikogruppen: drinnen bleiben.', priority: 'high', category: 'elderly' });
  } else {
    tips.push({ icon: '⚫', text: 'Extreme Luftverschmutzung! Aufenthalte draußen vermeiden.', priority: 'high', category: 'health' });
    tips.push({ icon: '🚨', text: 'Bei gesundheitlichen Beschwerden: Arzt aufsuchen.', priority: 'high', category: 'health' });
  }

  // PM2.5 spezifisch (kleine Partikel = tief in die Lunge)
  if (pm25 != null && pm25 > 25) {
    tips.push({ icon: '😷', text: 'Hohe Feinstaubbelastung (PM2.5) — Maske empfohlen bei Aufenthalten draußen.', priority: 'high', category: 'health' });
  }

  return tips.slice(0, 4);
}

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
    const tips = generateAirQualityTips(data);
    res.json({
      status: 'ok',
      airQuality: data.current,
      location: data.location,
      source: data.source,
      tips,
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
    const tips = generateAirQualityTips(data);
    res.json({
      status: 'ok',
      current: data.current,
      hourly: data.hourly,
      location: data.location,
      source: data.source,
      tips,
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
