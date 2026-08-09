/**
 * AWB Köln Service — Port der Python-Implementierung
 * Quelle: https://github.com/mampfes/hacs_waste_collection_schedule
 * Datei: custom_components/.../source/awbkoeln_de.py
 *
 * API: GET https://www.awbkoeln.de/api/calendar
 * Params: street_code, building_number, start_year, start_month, end_year, end_month
 * Return: JSON { data: [{ year, month, day, type }] }
 */

import axios from 'axios';
import { logger } from '../utils/logger';

export interface AwbKoelnEvent {
  date: string;     // 'YYYY-MM-DD'
  summary: string;  // Waste type name
  wasteType: string; // Mapped type
}

export interface AwbKoelnResult {
  status: 'ok' | 'error';
  events: AwbKoelnEvent[];
  city?: string;
  source?: string;
  message?: string;
}

const WASTE_TYPE_MAP: Record<string, string> = {
  'Restmüll': 'rest',
  'Biomüll': 'bio',
  'Altpapier': 'paper',
  'Gelber Sack': 'yellow',
  'Glas': 'glass',
  'Elektroschrott': 'electronic',
  'Sperrmüll': 'bulky',
  'Weihnachtsbäume': 'garden',
};

export class AwbKoelnService {
  private readonly streetCode: number;
  private readonly buildingNumber: number;

  constructor(streetCode: number, buildingNumber: number) {
    this.streetCode = streetCode;
    this.buildingNumber = buildingNumber;
  }

  async fetchCalendar(weeks: number = 2): Promise<AwbKoelnResult> {
    try {
      const now = new Date();
      const endDate = new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);

      const params = {
        street_code: this.streetCode,
        building_number: this.buildingNumber,
        start_year: now.getFullYear(),
        start_month: now.getMonth() + 1,
        end_year: endDate.getFullYear(),
        end_month: endDate.getMonth() + 1,
      };

      const response = await axios.get('https://www.awbkoeln.de/api/calendar', {
        params,
        timeout: 15000,
        headers: { 'User-Agent': 'HEIMAT-2.0/1.0' },
      });

      const data = response.data;
      if (!data?.data || !Array.isArray(data.data)) {
        return { status: 'error', events: [], message: 'Unerwartete API-Antwort' };
      }

      const events: AwbKoelnEvent[] = data.data.map((d: any) => {
        const dateStr = `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
        const typeName = d.type || 'Unbekannt';
        return {
          date: dateStr,
          summary: typeName,
          wasteType: WASTE_TYPE_MAP[typeName] || 'other',
        };
      });

      logger.info(`AWB Köln: ${events.length} Events für Straße ${this.streetCode}, Nr. ${this.buildingNumber}`);

      return {
        status: 'ok',
        events,
        city: 'Köln',
        source: 'AWB Köln',
      };
    } catch (error: any) {
      logger.error(`AWB Köln error: ${error.message}`);
      return { status: 'error', events: [], message: error.message };
    }
  }
}
