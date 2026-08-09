// ---------------------------------------------------------------------------  
// stuttgartService — Stuttgart (Abfallwirtschaft Stuttgart) Adapter
//
// ARCHITEKTUR:
//   Stuttgart API (service.stuttgart.de) — HTML-Scraping
//   - GET /lhs-services/aws/abfuhrtermine → Mülltypen (Checkbox-Values)
//   - POST /lhs-services/aws/abfuhrtermine mit street + streetnr → Termine als HTML
//   - HTML parsen → IcsEvent[]
//
// MOCK-POLICY: Keine Mocks. Echte HTTP-Calls gegen service.stuttgart.de
// ---------------------------------------------------------------------------

import type { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { type IcsEvent } from '../lib/icalParser';

// ---------------------------------------------------------------------------  
// Types
// ---------------------------------------------------------------------------

export interface StuttgartResult {
  street: string;
  houseNr: string;
  events: IcsEvent[];
  source: string;
  fetchedAt: string;
}

// ---------------------------------------------------------------------------  
// Constants
// ---------------------------------------------------------------------------

const STUTTGART_BASE_URL = 'https://service.stuttgart.de/lhs-services/aws';
const STUTTGART_USER_AGENT = 'HEIMAT/2.0 (Open Source Super App)';

// Mülltypen die von der API zurückgegeben werden
const STUTTGART_WASTE_TYPES = [
  'restmuell',
  'biomuell',
  'altpapier',
  'gelbersack',
];

// Mapping für Anzeige
const STUTTGART_CATEGORY_MAP: Record<string, string> = {
  'restmuell': 'Restmüll',
  'biomuell': 'Biomüll',
  'altpapier': 'Altpapier',
  'gelbersack': 'Gelber Sack',
};

// ---------------------------------------------------------------------------  
// HTML-Parser (einfach, robust)
// ---------------------------------------------------------------------------

/**
 * Einfacher HTML-Parser für Stuttgart-Tabellen
 * Extrahiert Termine aus der HTML-Antwort
 */
function parseStuttgartHtml(html: string): { date: string; category: string }[] {
  const entries: { date: string; category: string }[] = [];
  
  // Suche nach Tabelle mit id="awstable"
  const tableMatch = html.match(/<table[^>]*id="awstable"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) {
    return entries;
  }
  
  const tableHtml = tableMatch[1];
  
  // Extrahiere alle Zeilen
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const rowHtml = rowMatch[1];
    
    // Extrahiere alle Zellen
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cellMatch;
    
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      // HTML-Tags entfernen und Text extrahieren
      const text = cellMatch[1].replace(/<[^>]*>/g, '').trim();
      cells.push(text);
    }
    
    // Erwartetes Format: [Wochentag, Datum, Intervall, Mülltyp]
    if (cells.length >= 4) {
      const dateStr = cells[1]; // z.B. "14.08.2026"
      const category = cells[3]; // z.B. "Restmüll"
      
      // Datum parsen: "14.08.2026" → "2026-08-14T06:00:00"
      const dateParts = dateStr.split('.');
      if (dateParts.length === 3) {
        const [day, month, year] = dateParts;
        const isoDate = `${year}-${month}-${day}T06:00:00`;
        
        entries.push({
          date: isoDate,
          category: category,
        });
      }
    }
  }
  
  return entries;
}

// ---------------------------------------------------------------------------  
// Service
// ---------------------------------------------------------------------------

export class StuttgartService {
  constructor(private readonly http: AxiosInstance) {}

  /**
   * Hole Mülltypen von der API
   */
  async getWasteTypes(): Promise<string[]> {
    try {
      const response = await this.http.get(`${STUTTGART_BASE_URL}/abfuhrtermine`, {
        headers: { 'User-Agent': STUTTGART_USER_AGENT },
        timeout: 10000,
      });
      
      const html = typeof response.data === 'string' ? response.data : '';
      
      // Extrahiere Checkbox-Values
      const wasteTypes: string[] = [];
      const regex = /name="calendar\[wastetype\]\[\]"[^>]*value="([^"]+)"/gi;
      let match;
      
      while ((match = regex.exec(html)) !== null) {
        wasteTypes.push(match[1]);
      }
      
      return wasteTypes.length > 0 ? wasteTypes : STUTTGART_WASTE_TYPES;
    } catch (error) {
      logger.warn(`Stuttgart: Failed to get waste types: ${(error as Error).message}`);
      return STUTTGART_WASTE_TYPES;
    }
  }

  /**
   * Komplett-Flow: Straße + Hausnummer → Termine
   */
  async fetchCalendar(
    street: string,
    houseNr: string,
    weeks: number = 4,
  ): Promise<StuttgartResult> {
    logger.info(`Stuttgart: Fetching calendar for ${street} ${houseNr}`);

    // 1. Mülltypen holen
    const wasteTypes = await this.getWasteTypes();

    // 2. Zeitraum berechnen
    const now = new Date();
    const dateFrom = now.toISOString().split('T')[0].split('-').reverse().join('.');
    const dateTo = `31.01.${now.getFullYear() + 1}`;

    // 3. POST-Request mit street + streetnr
    const params = new URLSearchParams();
    params.append('calendar[street]', street);
    params.append('calendar[streetnr]', houseNr);
    params.append('calendar[datefrom]', dateFrom);
    params.append('calendar[dateto]', dateTo);
    
    for (const wasteType of wasteTypes) {
      params.append('calendar[wastetype][]', wasteType);
    }
    
    params.append('calendar[submit]', '');

    try {
      const response = await this.http.post(
        `${STUTTGART_BASE_URL}/abfuhrtermine`,
        params.toString(),
        {
          headers: {
            'User-Agent': STUTTGART_USER_AGENT,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 15000,
        },
      );

      const html = typeof response.data === 'string' ? response.data : String(response.data ?? '');
      
      // 4. HTML parsen
      const parsed = parseStuttgartHtml(html);
      
      // 5. In IcsEvent[] konvertieren
      const events: IcsEvent[] = parsed.map(entry => ({
        start: entry.date,
        summary: entry.category,
        category: entry.category.toLowerCase(),
        description: `Stuttgart Abfuhr: ${entry.category}`,
      }));

      // 6. Nach Wochen filtern
      const cutoffMs = Date.now() + weeks * 7 * 24 * 60 * 60 * 1000;
      const filtered = events.filter(e => {
        const t = Date.parse(e.start);
        return isFinite(t) && t <= cutoffMs;
      }).sort((a, b) => a.start.localeCompare(b.start));

      const fetchedAt = new Date().toISOString();
      logger.info(`Stuttgart: ${filtered.length} events fetched for ${street} ${houseNr}`);

      return {
        street,
        houseNr,
        events: filtered,
        source: `Stuttgart (${street} ${houseNr})`,
        fetchedAt,
      };
    } catch (error) {
      logger.error(`Stuttgart: Failed to fetch calendar: ${(error as Error).message}`);
      throw error;
    }
  }
}
