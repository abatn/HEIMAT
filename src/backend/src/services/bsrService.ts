// ---------------------------------------------------------------------------  
// bsrService — BSR (Berliner Stadtreinigung) Adapter
//
// ARCHITEKTUR:
//   BSR ICS-Endpoint (umnewforms.bsr.de) — FUNKTIONIERT!
//   - GET /abfuhr/kalender/ics/{schedule_id}?year=YYYY&month=M
//   - Benötigt: schedule_id (24-stelliger Code von BSR-Website)
//   - User kann schedule_id direkt eingeben (App-UI) ODER
//     Backend versucht BSR-Website zu scrapen
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
   * Fetch schedule_id from BSR website by scraping the ICS download link.
   * This is a fallback — User sollte schedule_id direkt eingeben.
   */
  async findScheduleId(street: string, houseNr: string): Promise<string | null> {
    try {
      // BSR Abfuhrkalender-Formular: Straße + Hausnummer eingeben
      // Die Seite lädt dynamisch — wir versuchen den ICS-Link zu finden
      const searchUrl = `https://www.bsr.de/abfuhrkalender`;
      const response = await this.http.get(searchUrl, {
        headers: { 'User-Agent': BSR_USER_AGENT },
        timeout: 10000,
      });

      // Suche nach schedule_id Muster in der HTML-Antwort
      const html = typeof response.data === 'string' ? response.data : '';
      const match = html.match(/schedule_id[=\/]([A-Z0-9]{24})/i);
      if (match) {
        return match[1];
      }

      // Alternative: Suche nach AddrKey Muster
      const addrMatch = html.match(/AddrKey[=\/]([A-Z0-9]{24})/i);
      if (addrMatch) {
        return addrMatch[1];
      }

      logger.warn(`BSR: Could not find schedule_id for ${street} ${houseNr}`);
      return null;
    } catch (error) {
      logger.warn(`BSR: schedule_id lookup failed: ${(error as Error).message}`);
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
   * Komplett-Flow: schedule_id → Kalender
   * 
   * @param scheduleId 24-stelliger BSR-Schedule-Code (von User oder Website)
   * @param weeks Vorhersage-Fenster (1-8 Wochen)
   */
  async fetchCalendar(
    scheduleId: string,
    weeks: number = 4,
  ): Promise<BsrResult> {
    logger.info(`BSR: Fetching calendar for schedule_id=${scheduleId}`);

    if (!scheduleId || scheduleId.length < 20) {
      throw new Error(
        `Ungültige BSR schedule_id: '${scheduleId}'. ` +
        `Bitte gib deine 24-stellige schedule_id ein (findest du auf www.bsr.de/abfuhrkalender).`
      );
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // ICS-Endpoint funktioniert — REST-Endpoint ist kaputt
    let events = await this.fetchCalendarViaIcal(scheduleId, year, month);
    
    // Wenn leer, versuche nächsten Monat
    if (events.length === 0) {
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      events = await this.fetchCalendarViaIcal(scheduleId, nextYear, nextMonth);
    }

    // Nach Wochen filtern
    const cutoffMs = Date.now() + weeks * 7 * 24 * 60 * 60 * 1000;
    const filtered = events.filter((e) => {
      const t = Date.parse(e.start);
      return isFinite(t) && t <= cutoffMs;
    }).sort((a, b) => a.start.localeCompare(b.start));

    const fetchedAt = new Date().toISOString();
    logger.info(`BSR: ${filtered.length} events fetched for schedule_id=${scheduleId}`);

    return {
      addrKey: scheduleId,
      street: '',
      houseNr: '',
      events: filtered,
      source: `BSR (${scheduleId})`,
      fetchedAt,
    };
  }
}
