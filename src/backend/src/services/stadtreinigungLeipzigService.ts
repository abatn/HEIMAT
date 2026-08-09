/**
 * Stadtreinigung Leipzig Service — Port der Python-Implementierung
 * Quelle: https://github.com/mampfes/hacs_waste_collection_schedule
 * Datei: custom_components/.../source/stadtreinigung_leipzig_de.py
 *
 * API Flow:
 *   1. GET https://stadtreinigung-leipzig.de/rest/Navision/Streets?search=...
 *   2. GET https://stadtreinigung-leipzig.de/wir-kommen-zu-ihnen/abfallkalender/ical.ics?position_nos=...
 */

import axios from 'axios';
import { parseIcsCalendar, type IcsEvent } from '../lib/icalParser';
import { logger } from '../utils/logger';

export interface StadtreinigungLeipzigResult {
  status: 'ok' | 'error';
  events: IcsEvent[];
  city?: string;
  source?: string;
  message?: string;
}

export class StadtreinigungLeipzigService {
  private readonly street: string;
  private readonly houseNumber: string;

  constructor(street: string, houseNumber: string) {
    this.street = street;
    this.houseNumber = houseNumber;
  }

  async fetchCalendar(weeks: number = 2): Promise<StadtreinigungLeipzigResult> {
    try {
      // Step 1: Get street + house number ID
      const streetsResp = await axios.get(
        'https://stadtreinigung-leipzig.de/rest/Navision/Streets',
        {
          params: { old_format: 1, search: this.street },
          timeout: 15000,
          headers: { 'User-Agent': 'HEIMAT-2.0/1.0' },
        },
      );

      const streetsData = streetsResp.data;
      if (!streetsData?.results || Object.keys(streetsData.results).length === 0) {
        return { status: 'error', events: [], message: `Straße "${this.street}" nicht gefunden` };
      }

      // Find the matching street — API may return exact match or fuzzy
      let streetEntry: Record<string, any> | null = null;
      let matchedStreet = this.street;

      // Try exact match first
      if (streetsData.results[this.street]) {
        streetEntry = streetsData.results[this.street];
        matchedStreet = this.street;
      } else {
        // Try case-insensitive match
        for (const key of Object.keys(streetsData.results)) {
          if (key.toLowerCase() === this.street.toLowerCase()) {
            streetEntry = streetsData.results[key];
            matchedStreet = key;
            break;
          }
        }
      }

      if (!streetEntry) {
        // Return available street names for debugging
        const available = Object.keys(streetsData.results).slice(0, 10);
        return {
          status: 'error',
          events: [],
          message: `Straße "${this.street}" nicht in der Datenbank. Verfügbar: ${available.join(', ')}`,
        };
      }

      // position_no can be an array like ["69194"] or a string
      const positionNoRaw = streetEntry[this.houseNumber];
      if (!positionNoRaw) {
        const availableHnrs = Object.keys(streetEntry).slice(0, 10);
        return {
          status: 'error',
          events: [],
          message: `Hausnummer "${this.houseNumber}" nicht gefunden. Verfügbar: ${availableHnrs.join(', ')}`,
        };
      }

      const positionNo = Array.isArray(positionNoRaw) ? positionNoRaw[0] : positionNoRaw;

      // Step 2: Get ICS calendar
      const icsResp = await axios.get(
        'https://stadtreinigung-leipzig.de/wir-kommen-zu-ihnen/abfallkalender/ical.ics',
        {
          params: {
            position_nos: positionNo,
            name: `${matchedStreet} ${this.houseNumber}`,
            mode: 'download',
          },
          timeout: 15000,
          responseType: 'text',
          headers: { 'User-Agent': 'HEIMAT-2.0/1.0' },
        },
      );

      const icsText = typeof icsResp.data === 'string' ? icsResp.data : String(icsResp.data);
      const parsed = parseIcsCalendar(icsText);

      // Filter by weeks
      const cutoffMs = Date.now() + weeks * 7 * 24 * 60 * 60 * 1000;
      const events = parsed.events.filter(e => {
        const t = Date.parse(e.start);
        return isFinite(t) && t <= cutoffMs;
      });

      logger.info(`Stadtreinigung Leipzig: ${events.length} Events für ${matchedStreet} ${this.houseNumber}`);

      return {
        status: 'ok',
        events,
        city: 'Leipzig',
        source: 'Stadtreinigung Leipzig',
      };
    } catch (error: any) {
      logger.error(`Stadtreinigung Leipzig error: ${error.message}`);
      return { status: 'error', events: [], message: error.message };
    }
  }
}
