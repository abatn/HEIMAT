/**
 * Stadtreinigung Hamburg Service — Port der Python-Implementierung
 * Quelle: https://github.com/mampfes/hacs_waste_collection_schedule
 * Datei: custom_components/.../source/stadtreinigung_hamburg.py
 *
 * API: GET https://backend.stadtreinigung.hamburg/kalender/abfuhrtermine.ics
 * Params: hnIds (house-number-ID)
 * Return: ICS-Datei
 */

import axios from 'axios';
import { parseIcsCalendar, type IcsEvent } from '../lib/icalParser';
import { logger } from '../utils/logger';

export interface StadtreinigungHhResult {
  status: 'ok' | 'error';
  events: IcsEvent[];
  city?: string;
  source?: string;
  message?: string;
}

export class StadtreinigungHhService {
  private readonly hnId: number;

  constructor(hnId: number) {
    this.hnId = hnId;
  }

  async fetchCalendar(weeks: number = 2): Promise<StadtreinigungHhResult> {
    try {
      const params = {
        hnIds: this.hnId,
        adresse: 'MeineAdresse',
      };

      const response = await axios.get(
        'https://backend.stadtreinigung.hamburg/kalender/abfuhrtermine.ics',
        {
          params,
          timeout: 15000,
          responseType: 'text',
          headers: { 'User-Agent': 'HEIMAT-2.0/1.0' },
        },
      );

      const icsText = typeof response.data === 'string' ? response.data : String(response.data);
      const parsed = parseIcsCalendar(icsText);

      // Filter by weeks
      const cutoffMs = Date.now() + weeks * 7 * 24 * 60 * 60 * 1000;
      const events = parsed.events.filter(e => {
        const t = Date.parse(e.start);
        return isFinite(t) && t <= cutoffMs;
      });

      logger.info(`Stadtreinigung HH: ${events.length} Events für hnId ${this.hnId}`);

      return {
        status: 'ok',
        events,
        city: 'Hamburg',
        source: 'Stadtreinigung Hamburg',
      };
    } catch (error: any) {
      logger.error(`Stadtreinigung HH error: ${error.message}`);
      return { status: 'error', events: [], message: error.message };
    }
  }
}
