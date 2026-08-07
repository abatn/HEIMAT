// ---------------------------------------------------------------------------  
// bsrService — BSR (Berliner Stadtreinigung) Adapter
//
// ARCHITEKTUR:
//   BSR eigene REST-API (umnewforms.bsr.de)
//   1. GET /adressen?filter=PLZ eq '...' and Strasse eq '...' and Hausnr eq '...'
//   2. GET /abfuhrEvents?filter=AddrKey eq '...' and DateFrom eq datetime'...'
//   3. ODER: GET /abfuhr/kalender/ics/{schedule_id}?year=...&month=...
//
// MOCK-POLICY: Keine Mocks. Echte HTTP-Calls gegen umnewforms.bsr.de
// ---------------------------------------------------------------------------

import type { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { parseIcsCalendar, type IcsEvent } from '../lib/icalParser';

// ---------------------------------------------------------------------------  
// Types
// ---------------------------------------------------------------------------

export interface BsrAddress {
  AddrKey: string;
  PLZ: string;
  Strasse: string;
  Hausnr: string;
  [key: string]: unknown;
}

export interface BsrAbfuhrEvent {
  AddrKey: string;
  DateFrom: string;
  DateTo: string;
  category: string;
  [key: string]: unknown;
}

export interface BsrResult {
  addrKey: string;
  street: string;
  houseNr: string;
  events: IcsEvent[];
  source: string;
  fetchedAt: string;
}

// ---------------------------------------------------------------------------  
// Constants
// ---------------------------------------------------------------------------

const BSR_BASE_URL = 'https://umnewforms.bsr.de/p/de.bsr.adressen.app';
const BSR_USER_AGENT = 'HEIMAT/2.0 (Open Source Super App)';

// Waste category mapping
const BSR_CATEGORY_MAP: Record<string, string> = {
  'BI': 'Biogut',
  'HM': 'Hausmüll',
  'LT': 'Laubtonne',
  'WS': 'Wertstoffe',
  'WB': 'Weihnachtsbaum',
};

// ---------------------------------------------------------------------------  
// Service
// ---------------------------------------------------------------------------

export class BsrService {
  constructor(private readonly http: AxiosInstance) {}

  /**
   * Find address by PLZ, street, and house number
   */
  async findAddress(plz: string, street: string, houseNr: string): Promise<BsrAddress | null> {
    const filter = `PLZ eq '${plz}' and Strasse eq '${street}' and Hausnr eq '${houseNr}'`;
    const url = `${BSR_BASE_URL}/adressen`;
    
    try {
      const response = await this.http.get(url, {
        params: { filter },
        headers: { 'User-Agent': BSR_USER_AGENT },
        timeout: 10000,
      });

      const data = response.data;
      if (Array.isArray(data) && data.length > 0) {
        return data[0] as BsrAddress;
      }
      return null;
    } catch (error) {
      logger.warn(`BSR: Address lookup failed: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Fetch waste collection events via iCal feed
   */
  async fetchCalendarViaIcal(
    scheduleId: string,
    year: number,
    month: number,
  ): Promise<IcsEvent[]> {
    const url = `${BSR_BASE_URL}/abfuhr/kalender/ics/${scheduleId}`;
    
    try {
      const response = await this.http.get(url, {
        params: { year, month },
        headers: {
          'User-Agent': BSR_USER_AGENT,
          'Accept': 'text/calendar',
        },
        responseType: 'text',
        timeout: 15000,
      });

      const icsData = typeof response.data === 'string' ? response.data : String(response.data ?? '');
      const parsed = parseIcsCalendar(icsData);
      return parsed.events;
    } catch (error) {
      logger.warn(`BSR: iCal fetch failed: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Fetch waste collection events via REST API
   */
  async fetchCalendarViaRest(
    scheduleId: string,
    year: number,
    month: number,
  ): Promise<IcsEvent[]> {
    const dateFrom = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`;
    const dateTo = `${year}-${String(month).padStart(2, '0')}-28T23:59:59`;
    
    const filter = `AddrKey eq '${scheduleId}' and DateFrom eq datetime'${dateFrom}' and DateTo eq datetime'${dateTo}'`;
    const url = `${BSR_BASE_URL}/abfuhrEvents`;
    
    try {
      const response = await this.http.get(url, {
        params: { filter },
        headers: { 'User-Agent': BSR_USER_AGENT },
        timeout: 15000,
      });

      const data = response.data;
      if (!Array.isArray(data)) {
        return [];
      }

      // Convert BSR events to IcsEvent format
      return data.map((event: BsrAbfuhrEvent) => ({
        start: event.DateFrom,
        end: event.DateTo,
        summary: BSR_CATEGORY_MAP[event.category] || event.category,
        category: event.category,
        description: `BSR Abfuhr: ${BSR_CATEGORY_MAP[event.category] || event.category}`,
      }));
    } catch (error) {
      logger.warn(`BSR: REST fetch failed: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Komplett-Flow: Adresse → Kalender
   */
  async fetchCalendar(
    plz: string,
    street: string,
    houseNr: string,
    weeks: number = 4,
  ): Promise<BsrResult> {
    logger.info(`BSR: Fetching calendar for ${street} ${houseNr}, ${plz} Berlin`);

    // 1. Adresse finden
    const address = await this.findAddress(plz, street, houseNr);
    if (!address) {
      throw new Error(`Adresse '${street} ${houseNr}, ${plz} Berlin' nicht bei BSR gefunden`);
    }

    const scheduleId = address.AddrKey;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // 2. Kalender laden (iCal bevorzugt, REST als Fallback)
    let events: IcsEvent[] = [];
    
    // Versuche iCal zuerst
    events = await this.fetchCalendarViaIcal(scheduleId, year, month);
    
    // Wenn iCal leer, versuche REST
    if (events.length === 0) {
      events = await this.fetchCalendarViaRest(scheduleId, year, month);
    }

    // Wenn immer noch leer, versuche nächsten Monat
    if (events.length === 0) {
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      events = await this.fetchCalendarViaIcal(scheduleId, nextYear, nextMonth);
      
      if (events.length === 0) {
        events = await this.fetchCalendarViaRest(scheduleId, nextYear, nextMonth);
      }
    }

    // 3. Nach Wochen filtern
    const cutoffMs = Date.now() + weeks * 7 * 24 * 60 * 60 * 1000;
    const filtered = events.filter((e) => {
      const t = Date.parse(e.start);
      return isFinite(t) && t <= cutoffMs;
    }).sort((a, b) => a.start.localeCompare(b.start));

    const fetchedAt = new Date().toISOString();
    logger.info(`BSR: ${filtered.length} events fetched for ${street} ${houseNr}`);

    return {
      addrKey: scheduleId,
      street: address.Strasse || street,
      houseNr: address.Hausnr || houseNr,
      events: filtered,
      source: `BSR (${scheduleId})`,
      fetchedAt,
    };
  }
}
