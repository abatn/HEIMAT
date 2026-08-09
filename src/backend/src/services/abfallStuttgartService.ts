/**
 * Abfall Stuttgart Service — Korrekte Port nach Node.js
 * 
 * API Flow (2026-08-09 verifiziert):
 *   1. GET /lhs-services/aws/abfuhrtermine → Parse waste-type checkboxes
 *   2. GET /lhs-services/aws/strassennamen?street=<query> 
 *      + Header: X-Requested-With: XMLHttpRequest
 *      → JSON: { suggestions: [{ value: "Steinengarten, Gew.", data: "..." }] }
 *   3. GET /lhs-services/aws/hausnummern?streetnr=<query>&street=<street>
 *      + Header: X-Requested-With: XMLHttpRequest
 *      → JSON: { suggestions: [{ value: "7", data: "7" }] }
 *   4. POST /lhs-services/aws/abfuhrtermine (form-encoded)
 *      + Header: X-Requested-With: XMLHttpRequest
 *      → HTML mit awstable (waste-type headers + date rows)
 * 
 * WICHTIG: X-Requested-With: XMLHttpRequest Header ist PFLICHT
 * für die Autocomplete-Endpoints (sonst gibt es HTML statt JSON).
 * 
 * Quelle: github.com/mampfes/hacs_waste_collection_schedule/source/stuttgart_de.py
 * Verifiziert gegen: service.stuttgart.de am 2026-08-09
 */

import axios, { type AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../utils/logger';

export interface StuttgartEvent {
  date: string;       // ISO: YYYY-MM-DD
  summary: string;    // z.B. "Restabfall", "Bioabfall"
  wasteType: string;  // z.B. "rest", "bio"
}

export interface StuttgartResult {
  status: 'ok' | 'error';
  events: StuttgartEvent[];
  city?: string;
  source?: string;
  message?: string;
}

const WASTE_TYPE_MAP: Record<string, string> = {
  'Restabfall': 'rest',
  'Restmüll': 'rest',
  'Bioabfall': 'bio',
  'Biomüll': 'bio',
  'Altpapier': 'paper',
  'Gelber Sack': 'yellow',
  'Glas': 'glass',
  'Elektroschrott': 'electronic',
  'Sperrmüll': 'bulky',
  'Gartenabfall': 'garden',
  'Weihnachtsbäume': 'christmas',
};

const BASE_URL = 'https://service.stuttgart.de/lhs-services/aws';
const AJAX_HEADERS = {
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/json, text/javascript, */*',
};

export class AbfallStuttgartService {
  private readonly street: string;
  private readonly streetNr: string;
  private readonly http: AxiosInstance;

  constructor(street: string, streetNr: string, http?: AxiosInstance) {
    this.street = street;
    this.streetNr = streetNr;
    this.http = http || axios.create({
      timeout: 15000,
      headers: { 'User-Agent': 'HEIMAT-2.0/1.0' },
    });
  }

  async fetchCalendar(weeks: number = 2): Promise<StuttgartResult> {
    try {
      // Step 1: GET the form page to extract waste-type checkboxes
      const formResp = await this.http.get(`${BASE_URL}/abfuhrtermine`);
      const $form = cheerio.load(formResp.data);
      const wastetypes: string[] = [];
      $form('input[name="calendar[wastetype][]"]').each((_, el) => {
        const value = $form(el).attr('value');
        if (value) wastetypes.push(value);
      });

      if (wastetypes.length === 0) {
        logger.warn('AbfallStuttgart: No waste types found in form');
        wastetypes.push('restmuell', 'biomuell', 'altpapier', 'gelbersack');
      }

      // Step 2: Autocomplete street name
      const streetName = await this.lookupStreet(this.street);
      if (!streetName) {
        return {
          status: 'error',
          events: [],
          message: `Straße "${this.street}" nicht in Stuttgart gefunden`,
        };
      }

      // Step 3: Autocomplete house number
      const houseNr = this.streetNr
        ? await this.lookupHouseNr(streetName, this.streetNr)
        : this.streetNr;

      // Step 4: POST form with address + wastetypes
      const now = new Date();
      const dateFrom = this.formatGermanDate(now);
      const dateTo = this.formatGermanDate(new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000));

      const formData = new URLSearchParams();
      formData.append('calendar[street]', streetName);
      formData.append('calendar[streetnr]', houseNr || '');
      formData.append('calendar[datefrom]', dateFrom);
      formData.append('calendar[dateto]', dateTo);
      for (const wt of wastetypes) {
        formData.append('calendar[wastetype][]', wt);
      }
      formData.append('calendar[submit]', '');

      const resultResp = await this.http.post(
        `${BASE_URL}/abfuhrtermine`,
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...AJAX_HEADERS,
          },
        },
      );

      // Step 5: Parse HTML table
      const events = this.parseTable(resultResp.data);

      logger.info(`AbfallStuttgart: ${events.length} Events für ${streetName} ${houseNr}`);

      return {
        status: 'ok',
        events,
        city: 'Stuttgart',
        source: 'Abfall Stuttgart',
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`AbfallStuttgart error: ${msg}`);
      return { status: 'error', events: [], message: msg };
    }
  }

  /**
   * Autocomplete street name via /lhs-services/aws/strassennamen
   * Returns the canonical street name (e.g. "Steinengarten, Gew.")
   */
  private async lookupStreet(query: string): Promise<string | null> {
    try {
      // Try direct match first
      const resp = await this.http.get(`${BASE_URL}/strassennamen`, {
        params: { street: query },
        headers: AJAX_HEADERS,
      });

      const suggestions = resp.data?.suggestions || [];
      if (suggestions.length > 0) {
        return suggestions[0].data || suggestions[0].value;
      }

      // Try with shorter prefix (API seems to need >= 3 chars)
      if (query.length > 3) {
        const shortResp = await this.http.get(`${BASE_URL}/strassennamen`, {
          params: { street: query.substring(0, Math.max(3, query.length - 2)) },
          headers: AJAX_HEADERS,
        });
        const shortSuggestions = shortResp.data?.suggestions || [];
        // Find best match
        const match = shortSuggestions.find((s: any) =>
          s.data?.toLowerCase().includes(query.toLowerCase())
        );
        if (match) return match.data || match.value;
      }

      return null;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.warn(`AbfallStuttgart: Street lookup failed for "${query}": ${msg}`);
      return null;
    }
  }

  /**
   * Autocomplete house number via /lhs-services/aws/hausnummern
   */
  private async lookupHouseNr(street: string, query: string): Promise<string> {
    try {
      const resp = await this.http.get(`${BASE_URL}/hausnummern`, {
        params: { streetnr: query, street },
        headers: AJAX_HEADERS,
      });

      const suggestions = resp.data?.suggestions || [];
      if (suggestions.length > 0) {
        // Find exact or best match
        const exact = suggestions.find((s: any) => s.data === query);
        if (exact) return exact.data;
        return suggestions[0].data || suggestions[0].value;
      }

      return query; // Fallback to original input
    } catch (error: unknown) {
      logger.warn(`AbfallStuttgart: House number lookup failed: ${(error as Error).message}`);
      return query; // Fallback to original input
    }
  }

  /**
   * Parse the awstable HTML structure:
   *   <th>Restabfall</th>  ← header row (waste type)
   *   <td>14.08.2026</td>  ← date row
   *   <td>28.08.2026</td>  ← date row
   *   <th>Bioabfall</th>   ← next header
   *   ...
   */
  private parseTable(html: string): StuttgartEvent[] {
    const $ = cheerio.load(html);
    const events: StuttgartEvent[] = [];

    // Find the awstable
    const table = $('table.awstable, table[id="awstable"]').first();
    if (!table.length) {
      // Fallback: find any table with summary attribute
      const allTables = $('table[summary*="Abfuhrtermine"]');
      if (allTables.length === 0) {
        logger.warn('AbfallStuttgart: No awstable found in response');
        return [];
      }
    }

    let currentWasteType = '';

    // Iterate all rows in the table
    const targetTable = table.length ? table : $('table').first();
    targetTable.find('tr').each((_, row) => {
      const $row = $(row);

      // Check for header (th) — this is the waste type name
      const th = $row.find('th');
      if (th.length > 0) {
        const typeName = th.text().trim();
        if (typeName && WASTE_TYPE_MAP[typeName]) {
          currentWasteType = typeName;
        }
        return;
      }

      // Check for data cells (td) — these are the dates
      const tds = $row.find('td');
      if (tds.length > 0 && currentWasteType) {
        tds.each((_, td) => {
          const text = $(td).text().trim();
          const dateMatch = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
          if (dateMatch) {
            const [, day, month, year] = dateMatch;
            events.push({
              date: `${year}-${month}-${day}`,
              summary: currentWasteType,
              wasteType: WASTE_TYPE_MAP[currentWasteType] || 'other',
            });
          }
        });
      }
    });

    return events;
  }

  private formatGermanDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }
}
