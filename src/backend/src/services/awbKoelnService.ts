/**
 * AWB Köln Service — Port der Python-Implementierung
 * Quelle: https://github.com/mampfes/hacs_waste_collection_schedule
 * Datei: custom_components/.../source/awbkoeln_de.py
 *
 * API Flow:
 *   1. GET https://www.awbkoeln.de/api/streets?street_name=...&building_number=... → street_code
 *   2. GET https://www.awbkoeln.de/api/calendar?street_code=...&building_number=... → events
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
  'grey': 'rest',
  'Restmüll': 'rest',
  'Biomüll': 'bio',
  'bio': 'bio',
  'Altpapier': 'paper',
  'paper': 'paper',
  'Gelber Sack': 'yellow',
  'yellow': 'yellow',
  'wertstoff': 'yellow',
  'Glas': 'glass',
  'glass': 'glass',
  'Elektroschrott': 'electronic',
  'Sperrmüll': 'bulky',
  'Weihnachtsbäume': 'garden',
};

export class AwbKoelnService {
  private readonly streetName: string;
  private readonly buildingNumber: string;

  constructor(streetName: string, buildingNumber: string) {
    this.streetName = streetName;
    this.buildingNumber = buildingNumber;
  }

  async fetchCalendar(weeks: number = 2): Promise<AwbKoelnResult> {
    try {
      // Step 1: Look up street_code via /api/streets
      const streetsResp = await axios.get('https://www.awbkoeln.de/api/streets', {
        params: {
          street_name: this.streetName,
          building_number: this.buildingNumber,
        },
        timeout: 15000,
        headers: { 'User-Agent': 'HEIMAT-2.0/1.0' },
      });

      const streetsData = streetsResp.data;
      if (!streetsData?.data || !Array.isArray(streetsData.data) || streetsData.data.length === 0) {
        return {
          status: 'error',
          events: [],
          message: `Straße "${this.streetName}" Nr. ${this.buildingNumber} nicht in Köln gefunden`,
        };
      }

      // Take first match
      const match = streetsData.data[0];
      const streetCode = parseInt(String(match.street_code), 10);
      const buildingNr = parseInt(String(match.building_number || this.buildingNumber), 10);

      if (!streetCode || !buildingNr) {
        return {
          status: 'error',
          events: [],
          message: `Straßencode konnte nicht ermittelt werden für "${this.streetName}"`,
        };
      }

      logger.info(`AWB Köln: street_code=${streetCode}, building_number=${buildingNr} für "${this.streetName} ${this.buildingNumber}"`);

      // Step 2: Fetch calendar with street_code
      const now = new Date();
      const endDate = new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);

      const params = {
        street_code: streetCode,
        building_number: buildingNr,
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

      logger.info(`AWB Köln: ${events.length} Events für "${this.streetName} ${this.buildingNumber}"`);

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
