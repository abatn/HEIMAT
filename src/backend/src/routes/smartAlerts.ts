/**
 * smartAlerts.ts — Intelligente Erinnerungen & Benachrichtigungen
 *
 * Generiert proaktive Alerts basierend auf:
 * - Tageszeit (Morgen: Müll, Tag: Parken, Abend: Rückweg)
 * - Wetter (Regen, Kälte, Hitze)
 * - Luftqualität (Sport-Empfehlung)
 * - Abfallkalender (Mülltonne raus)
 * - ÖPNV-Status (Verspätungen)
 *
 * GET /api/smart-alerts?lat=52.52&lng=13.41
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { weatherService } from '../services/weatherService';
import { airQualityService } from '../services/airQualityService';
import { WasteService } from '../services/wasteService';
import { logger } from '../utils/logger';

export const smartAlertsRouter = Router();

interface SmartAlert {
  id: string;
  type: 'waste' | 'weather' | 'airquality' | 'transit' | 'parking' | 'reminder';
  priority: 'high' | 'medium' | 'low';
  icon: string;
  title: string;
  message: string;
  action: string | null;
  expiresAt: string | null;
}

smartAlertsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const latStr = req.query.lat as string;
    const lngStr = req.query.lng as string;
    if (!latStr || !lngStr || isNaN(parseFloat(latStr)) || isNaN(parseFloat(lngStr))) {
      return res.status(400).json({ error: 'lat und lng als Query-Parameter erforderlich' });
    }
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    const hour = new Date().getHours();

    logger.info(`Smart Alerts requested: lat=${lat}, lng=${lng}, hour=${hour}`);

    const alerts: SmartAlert[] = [];

    // Fetch services in parallel
    const [weatherResult, airQualityResult, wasteResult] = await Promise.allSettled([
      weatherService.getWeather(lat, lng),
      airQualityService.getAirQuality(lat, lng),
      new WasteService(axios.create()).getWasteCalendar(lat, lng, 2),
    ]);

    // Weather alerts
    if (weatherResult.status === 'fulfilled') {
      const weather = weatherResult.value;
      const temp = weather.current.temperature;
      const condition = weather.current.weatherText.toLowerCase();

      if (temp < 0) {
        alerts.push({
          id: 'weather-freezing',
          type: 'weather',
          priority: 'high',
          icon: '🥶',
          title: 'Frostwarnung',
          message: 'Temperaturen unter 0°C. Warme Kleidung und Eisdickicht beachten.',
          action: null,
          expiresAt: null,
        });
      }

      if (temp > 35) {
        alerts.push({
          id: 'weather-heat',
          type: 'weather',
          priority: 'high',
          icon: '🥵',
          title: 'Hitzewarnung',
          message: 'Über 35°C. Viel trinken, Mittagssonne meiden.',
          action: null,
          expiresAt: null,
        });
      }

      if (condition.includes('regen') || condition.includes('schauer')) {
        alerts.push({
          id: 'weather-rain',
          type: 'weather',
          priority: 'medium',
          icon: '☔',
          title: 'Regen erwartet',
          message: 'Regenjacke oder Regenschirm mitnehmen.',
          action: null,
          expiresAt: null,
        });
      }

      if (condition.includes('schnee')) {
        alerts.push({
          id: 'weather-snow',
          type: 'weather',
          priority: 'medium',
          icon: '❄️',
          title: 'Schneefall',
          message: 'Vorsicht auf Straßen und Gehwegen. Extra Zeit einplanen.',
          action: null,
          expiresAt: null,
        });
      }
    }

    // Air quality alerts
    if (airQualityResult.status === 'fulfilled') {
      const aq = airQualityResult.value;
      const aqi = aq.current.europeanAqi ?? 0;

      if (aqi > 80) {
        alerts.push({
          id: 'airquality-bad',
          type: 'airquality',
          priority: 'high',
          icon: '🌬️',
          title: 'Schlechte Luftqualität',
          message: 'AQI über 80. Kein Sport im Freien empfohlen. Fenster geschlossen halten.',
          action: null,
          expiresAt: null,
        });
      } else if (aqi > 50) {
        alerts.push({
          id: 'airquality-moderate',
          type: 'airquality',
          priority: 'low',
          icon: '🌬️',
          title: 'Luftqualität mäßig',
          message: 'AQI zwischen 50-80. Leichter Sport möglich.',
          action: null,
          expiresAt: null,
        });
      }

      // Good air quality = sports recommendation
      if (aqi <= 20 && hour >= 6 && hour <= 20) {
        alerts.push({
          id: 'airquality-good-sport',
          type: 'airquality',
          priority: 'low',
          icon: '🏃',
          title: 'Perfekt zum Joggen!',
          message: 'Sehr gute Luftqualität. Ideal für Sport im Freien.',
          action: null,
          expiresAt: null,
        });
      }
    }

    // Waste alerts
    if (wasteResult.status === 'fulfilled') {
      const waste = wasteResult.value;
      const nextEvent = waste.events?.[0];

      if (nextEvent) {
        const eventDate = new Date(nextEvent.start);
        const now = new Date();
        const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntil <= 1) {
          alerts.push({
            id: 'waste-tomorrow',
            type: 'waste',
            priority: 'high',
            icon: '🗑️',
            title: 'Mülltonne raus!',
            message: `${nextEvent.category || 'Müll'}: ${daysUntil === 0 ? 'HEUTE' : 'MORGEN'} rausstellen.`,
            action: null,
            expiresAt: eventDate.toISOString(),
          });
        } else if (daysUntil <= 3) {
          alerts.push({
            id: 'waste-upcoming',
            type: 'waste',
            priority: 'medium',
            icon: '🗑️',
            title: 'Müll in ${daysUntil} Tagen',
            message: `${nextEvent.category || 'Müll'}: In ${daysUntil} Tagen.`,
            action: null,
            expiresAt: eventDate.toISOString(),
          });
        }
      }
    }

    // Time-based reminders
    if (hour === 7) {
      alerts.push({
        id: 'morning-briefing',
        type: 'reminder',
        priority: 'medium',
        icon: '🌅',
        title: 'Guten Morgen!',
        message: 'Schau in dein Tages-Dashboard für alle Infos.',
        action: 'daily-briefing',
        expiresAt: null,
      });
    }

    if (hour === 17) {
      alerts.push({
        id: 'evening-commute',
        type: 'reminder',
        priority: 'low',
        icon: '🏠',
        title: 'Feierabend?',
        message: 'ÖPNV-Verbindungen und Parkplätze in deiner Nähe prüfen.',
        action: 'mobility',
        expiresAt: null,
      });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    res.json({
      count: alerts.length,
      alerts,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Smart Alerts error:', error);
    res.status(500).json({ error: 'Alerts konnten nicht geladen werden' });
  }
});
