/**
 * Abfall Stuttgart Service — Port der Python-Implementierung
 * Quelle: https://github.com/mampfes/hacs_waste_collection_schedule
 * Datei: custom_components/.../source/stuttgart_de.py
 *
 * API Flow:
 *   1. GET https://service.stuttgart.de/lhs-services/aws/abfuhrtermine → wastetypes
 *   2. POST https://service.stuttgart.de/lhs-services/aws/abfuhrtermine → HTML table
 *   3. Parse table rows → events
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../utils/logger';

export interface AbfallStuttgartEvent {
  date: string;
  summary: string;
  wasteType: string;
}

export interface AbfallStuttgartResult {
  status: 'ok' | 'error';
  events: AbfallStuttgartEvent[];
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
};

export class AbfallStuttgartService {
  private readonly street: string;
  private readonly streetNr: string;

  constructor(street: string, streetNr: string) {
    this.street = street;
    this.streetNr = streetNr;
  }

  async fetchCalendar(weeks: number = 2): Promise<AbfallStuttgartResult> {
    try {
      // Step 1: Get waste types
      const typesResp = await axios.get(
        'https://service.stuttgart.de/lhs-services/aws/abfuhrtermine',
        { timeout: 15000, headers: { 'User-Agent': 'HEIMAT-2.0/1.0' } },
      );

      const $types = cheerio.load(typesResp.data);
      const wastetypes: string[] = [];
      $types('input[name="calendar[wastetype][]"]').each((_, el) => {
        const value = $types(el).attr('value');
        if (value) wastetypes.push(value);
      });

      // Step 2: POST with address + wastetypes
      const now = new Date();
      const formData = new URLSearchParams();
      formData.append('calendar[street]', this.street);
      formData.append('calendar[streetnr]', this.streetNr);
      formData.append('calendar[datefrom]', now.toLocaleDateString('de-DE'));
      formData.append('calendar[dateto]', `31.01.${now.getFullYear() + 1}`);

      for (const wt of wastetypes) {
        formData.append('calendar[wastetype][]', wt);
      }
      formData.append('calendar[submit]', '');

      const resultResp = await axios.post(
        'https://service.stuttgart.de/lhs-services/aws/abfuhrtermine',
        formData.toString(),
        {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'HEIMAT-2.0/1.0',
          },
        },
      );

      // Step 3: Parse HTML table
      const $ = cheerio.load(resultResp.data);
      const events: AbfallStuttgartEvent[] = [];

      $('table#awstable tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
          const typeName = $(cells[0]).text().trim();
          const dateStr = $(cells[1]).text().trim();

          // Parse DD.MM.YYYY
          const dateMatch = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
          if (dateMatch && typeName) {
            const [, day, month, year] = dateMatch;
            events.push({
              date: `${year}-${month}-${day}`,
              summary: typeName,
              wasteType: WASTE_TYPE_MAP[typeName] || 'other',
            });
          }
        }
      });

      logger.info(`Abfall Stuttgart: ${events.length} Events für ${this.street} ${this.streetNr}`);

      return {
        status: 'ok',
        events,
        city: 'Stuttgart',
        source: 'Abfall Stuttgart',
      };
    } catch (error: any) {
      logger.error(`Abfall Stuttgart error: ${error.message}`);
      return { status: 'error', events: [], message: error.message };
    }
  }
}
