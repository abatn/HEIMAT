/**
 * dailyBriefing.ts — Tages-Briefing Endpoint
 *
 * Kombiniert alle Service-Daten in einen einzigen intelligenten Briefing-Response.
 * GET /api/daily-briefing?lat=52.52&lng=13.41
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { weatherService } from '../services/weatherService';
import { airQualityService } from '../services/airQualityService';
import { WasteService } from '../services/wasteService';
import { ParkingService } from '../services/parkingService';
import { EvChargingService } from '../services/evChargingService';
import { logger } from '../utils/logger';

export const dailyBriefingRouter = Router();

// Module-level singletons (consistent with other route files)
const wasteService = new WasteService(axios);
const parkingService = new ParkingService();
const evChargingService = new EvChargingService();

interface DailyBriefing {
  greeting: string;
  timestamp: string;
  period: 'morning' | 'afternoon' | 'evening' | 'night';
  weather: {
    temperature: number;
    condition: string;
    tips: string[];
  } | null;
  airQuality: {
    aqi: number;
    level: string;
    tips: string[];
  } | null;
  waste: {
    available: boolean;
    nextEvent: string | null;
    category: string | null;
    tips: string[];
  };
  parking: {
    available: boolean;
    count: number;
    nearest: string | null;
  };
  evCharging: {
    available: boolean;
    count: number;
    nearest: string | null;
  };
  tips: string[];
  alerts: Array<{
    type: string;
    message: string;
    priority: 'high' | 'medium' | 'low';
    icon: string;
  }>;
}

function getGreeting(period: string): string {
  switch (period) {
    case 'morning': return 'Guten Morgen! ☀️';
    case 'afternoon': return 'Guten Tag! 👋';
    case 'evening': return 'Guten Abend! 🌙';
    case 'night': return 'Gute Nacht! 🌛';
    default: return 'Hallo! 👋';
  }
}

function getTimePeriod(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

dailyBriefingRouter.get('/', async (req: Request, res: Response) => {
  try {
    const latStr = req.query.lat as string;
    const lngStr = req.query.lng as string;
    if (!latStr || !lngStr || isNaN(parseFloat(latStr)) || isNaN(parseFloat(lngStr))) {
      return res.status(400).json({ error: 'lat und lng als Query-Parameter erforderlich' });
    }
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    const period = getTimePeriod();

    logger.info(`Daily Briefing requested: lat=${lat}, lng=${lng}, period=${period}`);

    // Parallel fetch all services
    const [weatherResult, airQualityResult, wasteResult, parkingResult, evChargingResult] = 
      await Promise.allSettled([
        weatherService.getWeather(lat, lng),
        airQualityService.getAirQuality(lat, lng),
        wasteService.getWasteCalendar(lat, lng, 1),
        parkingService.getNearbySpots(lat, lng, 2),
        evChargingService.getNearbyStations(lat, lng, 5),
      ]);

    // Process weather
    const weather = weatherResult.status === 'fulfilled' ? {
      temperature: weatherResult.value.current.temperature,
      condition: weatherResult.value.current.weatherText,
      tips: [], // Tips are generated in the route handler
    } : null;

    // Process air quality
    const airQuality = airQualityResult.status === 'fulfilled' ? {
      aqi: airQualityResult.value.current.europeanAqi ?? 0,
      level: airQualityResult.value.current.aqiLevel,
      tips: [],
    } : null;

    // Process waste
    const wasteData = wasteResult.status === 'fulfilled' ? wasteResult.value : null;
    const nextWasteEvent = wasteData?.events?.[0];
    const waste = {
      available: wasteData !== null && wasteData !== undefined,
      nextEvent: nextWasteEvent?.start ?? null,
      category: nextWasteEvent?.category ?? null,
      tips: nextWasteEvent 
        ? [`Müll: ${nextWasteEvent.category} am ${nextWasteEvent.start}`]
        : [],
    };

    // Process parking
    const parkingSpots = parkingResult.status === 'fulfilled' ? parkingResult.value : [];
    const parking = {
      available: parkingSpots.length > 0,
      count: parkingSpots.length,
      nearest: parkingSpots[0]?.name ?? null,
    };

    // Process EV charging
    const evStations = evChargingResult.status === 'fulfilled' ? evChargingResult.value : [];
    const evCharging = {
      available: evStations.length > 0,
      count: evStations.length,
      nearest: evStations[0]?.name ?? null,
    };

    // Generate weather tips
    const weatherTips: string[] = [];
    if (weather) {
      if (weather.temperature < 5) weatherTips.push('Kalt! Warm anziehen. 🥶');
      if (weather.temperature > 30) weatherTips.push('Heiß! Viel trinken. 💧');
      if (weather.condition.toLowerCase().includes('regen')) weatherTips.push('Regen! Regenjacke einpacken. ☔');
      if (weather.condition.toLowerCase().includes('schnee')) weatherTips.push('Schnee! Vorsicht auf den Straßen. ❄️');
    }

    // Generate air quality tips
    const airTips: string[] = [];
    if (airQuality) {
      if (airQuality.aqi > 50) airTips.push('Luftqualität mäßig — kein idealer Jogging-Tag');
      if (airQuality.aqi > 100) airTips.push('Luft schlecht — Fenster geschlossen halten!');
    }

    // Collect all tips
    const allTips: string[] = [...weatherTips, ...airTips, ...waste.tips];

    // Generate alerts
    const alerts: DailyBriefing['alerts'] = [];

    if (waste.nextEvent) {
      alerts.push({
        type: 'waste',
        message: `Mülltonne: ${waste.category}`,
        priority: 'high',
        icon: '🗑️',
      });
    }

    if (airQuality && airQuality.aqi > 50) {
      alerts.push({
        type: 'airquality',
        message: `Luftqualität: ${airQuality.level}`,
        priority: airQuality.aqi > 100 ? 'high' : 'medium',
        icon: '🌬️',
      });
    }

    if (weather && weather.temperature < 5) {
      alerts.push({
        type: 'weather',
        message: 'Kalt! Warm anziehen.',
        priority: 'medium',
        icon: '🥶',
      });
    }

    const briefing: DailyBriefing = {
      greeting: getGreeting(period),
      timestamp: new Date().toISOString(),
      period,
      weather,
      airQuality,
      waste,
      parking,
      evCharging,
      tips: allTips,
      alerts,
    };

    res.json(briefing);
  } catch (error) {
    logger.error('Daily Briefing error:', error);
    res.status(500).json({ error: 'Briefing konnte nicht geladen werden' });
  }
});
