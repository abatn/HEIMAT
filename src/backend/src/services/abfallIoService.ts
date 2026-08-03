// ---------------------------------------------------------------------------
// abfallIoService — Abfall.IO / AbfallPlus Adapter
//
// ARCHITEKTUR:
//   Portierung der Python-Logik aus hacs_waste_collection_schedule
//   (github.com/mampfes/hacs_waste_collection_schedule)
//
//   abfall.io ist ein Hosting-Provider für Abfallkalender-Hundreds
//   deutscher Kommunen. Jede Kommune hat eine eigene `service_id`.
//
//   API-Flow:
//     1. POST /api.abfall.io?key={service_id}&waction=init → Token + Hidden Inputs
//     2. POST /api.abfall.io?key={service_id}&waction=auswahl_bezirk_set → Bezirk
//     3. POST /api.abfall.io?key={service_id}&waction=auswahl_strasse_set → Strasse
//     4. POST /api.abfall.io?key={service_id}&waction=export_ics → iCal-Daten
//
//   Hinweis: Die API braucht f_id_kommune, f_id_strasse, f_id_strasse_hnr
//   die aus der HTML-Antwort geparst werden. Für MVP: Nur service_id +
//   Strasse/Hausnummer (ohne Bezirk-Auswahl).
//
// MOCK-POLICY: Keine Mocks. Echte HTTP-Calls gegen api.abfall.io.
// ---------------------------------------------------------------------------

import type { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { parseIcsCalendar, type IcsEvent } from '../lib/icalParser';

// ---------------------------------------------------------------------------
// Constants (from Python source)
// ---------------------------------------------------------------------------

const MODUS_KEY = 'd6c5855a62cf32a4dadbc2831f0f295f';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0',
  'Content-Type': 'application/x-www-form-urlencoded',
};

// ---------------------------------------------------------------------------
// SERVICE_MAP — Known municipalities with abfall.io service_ids
// Quelle: hacs_waste_collection_schedule (CC-BY-NC-SA)
// ---------------------------------------------------------------------------

export interface AbfallIoServiceEntry {
  title: string;
  serviceId: string;
  /** Optional: PLZ-Bereich für Quick-Matching */
  plzPrefix?: string[];
}

/**
 * Bekannte abfall.io Kommunen.
 * Für MVP: Top-20 nach Bevölkerung. Erweiterbar durch Hinzufügen.
 *
 * Mapping: PLZ-Prefix → service_id (erlaubt GPS→PLZ→Provider-Matching)
 */
export const ABFALL_IO_SERVICES: AbfallIoServiceEntry[] = [
  { title: 'ALBA Berlin', serviceId: '9583a2fa1df97ed95363382c73b41b1b', plzPrefix: ['10', '12', '13', '14'] },
  { title: 'Stadt Landshut', serviceId: 'bd0c2d0177a0849a905cded5cb734a6f', plzPrefix: ['84'] },
  { title: 'Ludwigshafen am Rhein', serviceId: '6efba91e69a5b454ac0ae3497978fe1d', plzPrefix: ['67'] },
  { title: 'EGST Steinfurt', serviceId: 'e21758b9c711463552fb9c70ac7d4273', plzPrefix: ['48'] },
  { title: 'Landkreis Bayreuth', serviceId: '951da001077dc651a3bf437bc829964e', plzPrefix: ['95'] },
  { title: 'Landkreis Calw', serviceId: '690a3ae4906c52b232c1322e2f88550c', plzPrefix: ['708'] },
  { title: 'AWB Freudenstadt', serviceId: '595f903540a36fe8610ec39aa3a06f6a', plzPrefix: ['722'] },
  { title: 'Göttinger Entsorgungsbetriebe', serviceId: '7dd0d724cbbd008f597d18fcb1f474cb', plzPrefix: ['37'] },
  { title: 'Landkreis Heilbronn', serviceId: '1a1e7b200165683738adddc4bd0199a2', plzPrefix: ['74'] },
  { title: 'Landkreis Kitzingen', serviceId: '594f805eb33677ad5bc645aeeeaf2623', plzPrefix: ['973'] },
  { title: 'Landkreis Landsberg am Lech', serviceId: '7df877d4f0e63decfb4d11686c54c5d6', plzPrefix: ['868', '869'] },
  { title: 'MüllALARM / Schönmackers', serviceId: 'e5543a3e190cb8d91c645660ad60965f', plzPrefix: [] },
  { title: 'Abfallbewirtschaftung Ostalbkreis', serviceId: '3ca331fb42d25e25f95014693ebcf855', plzPrefix: ['734'] },
  { title: 'Landkreis Oldenburg', serviceId: '27708a019a2e35de7eb4bbe7c851609f', plzPrefix: ['262'] },
  { title: 'Landkreis Ostallgäu', serviceId: '342cedd68ca114560ed4ca4b7c4e5ab6', plzPrefix: ['876'] },
  { title: 'Rhein-Neckar-Kreis', serviceId: '914fb9d000a9a05af4fd54cfba478860', plzPrefix: ['691', '692'] },
  { title: 'Landkreis Rotenburg (Wümme)', serviceId: '645adb3c27370a61f7eabbb2039de4f1', plzPrefix: ['273'] },
  { title: 'Landkreis Sigmaringen', serviceId: '39886c5699d14e040063c0142cd0740b', plzPrefix: ['724'] },
  { title: 'Landratsamt Traunstein', serviceId: '279cc5db4db838d1cfbf42f6f0176a90', plzPrefix: ['833'] },
  { title: 'Landratsamt Unterallgäu', serviceId: 'c22b850ea4eff207a273e46847e417c5', plzPrefix: ['868'] },
  { title: 'AWB Westerwaldkreis', serviceId: '248deacbb49b06e868d29cb53c8ef034', plzPrefix: ['564'] },
  { title: 'Landkreis Limburg-Weilburg', serviceId: '0ff491ffdf614d6f34870659c0c8d917', plzPrefix: ['655'] },
  { title: 'Landkreis Weißenburg-Gunzenhausen', serviceId: '31fb9c7d783a030bf9e4e1994c7d2a91', plzPrefix: ['917'] },
  { title: 'VIVO Landkreis Miesbach', serviceId: '4e33d4f09348fdcc924341bf2f27ec86', plzPrefix: ['836'] },
  { title: 'Team Orange (Landkreis Würzburg)', serviceId: '3701fd1ff111f63996ab46a448669ea3', plzPrefix: ['970'] },
  { title: 'Landkreis Cuxhaven', serviceId: '49fe8a63a056adbfc43f051f61dd4a44', plzPrefix: ['274'] },
  { title: 'Landkreis Rottweil', serviceId: 'd287412901d68d66825e588a60c94641', plzPrefix: ['786'] },
  { title: 'AWG Abfallwirtschaft Landkreis Calw', serviceId: '0813ea99f520c462373386564a99a51e', plzPrefix: ['708'] },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AbfallIoResult {
  serviceTitle: string;
  serviceId: string;
  events: IcsEvent[];
  source: string;
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AbfallIoService {
  private readonly http: AxiosInstance;

  constructor(http: AxiosInstance) {
    this.http = http;
  }

  /**
   * Find abfall.io service by PLZ prefix.
   * Returns null if no matching service found.
   */
  findServiceByPlz(plz: string): AbfallIoServiceEntry | null {
    const normalizedPlz = plz.trim();
    for (const service of ABFALL_IO_SERVICES) {
      if (service.plzPrefix?.some((prefix) => normalizedPlz.startsWith(prefix))) {
        return service;
      }
    }
    return null;
  }

  /**
   * Find abfall.io service by fuzzy title match.
   * Returns null if no matching service found.
   */
  findServiceByCity(cityName: string): AbfallIoServiceEntry | null {
    const normalized = cityName.toLowerCase().trim();
    for (const service of ABFALL_IO_SERVICES) {
      const titleLower = service.title.toLowerCase();
      // Check if city name is contained in service title or vice versa
      if (titleLower.includes(normalized) || normalized.includes(titleLower.split(' ')[0])) {
        return service;
      }
    }
    return null;
  }

  /**
   * Fetch waste calendar from abfall.io for a given service.
   *
   * @param serviceId The abfall.io service_id
   * @param street Optional street name
   * @param houseNr Optional house number
   * @returns Parsed iCal events
   */
  async fetchCalendar(
    serviceId: string,
    street?: string,
    houseNr?: string,
  ): Promise<AbfallIoResult> {
    const service = ABFALL_IO_SERVICES.find((s) => s.serviceId === serviceId);
    const serviceTitle = service?.title || 'Unknown';

    // Step 1: Init — get token + hidden inputs
    const initArgs = await this.stepInit(serviceId);

    // Step 2: Set street (if provided)
    if (street) {
      initArgs['f_id_strasse'] = street;
    }
    if (houseNr) {
      initArgs['f_id_strasse_hnr'] = houseNr;
    }

    // Step 3: Export iCal
    const icsData = await this.stepExportIcs(serviceId, initArgs);

    // Step 4: Parse iCal
    const parsed = parseIcsCalendar(icsData);

    const fetchedAt = new Date().toISOString();
    logger.info(`AbfallIoService: ${serviceTitle} — ${parsed.events.length} events fetched`);

    return {
      serviceTitle,
      serviceId,
      events: parsed.events,
      source: `abfall.io/${serviceId}`,
      fetchedAt,
    };
  }

  /**
   * Step 1: Initialize session — get token + hidden form inputs.
   */
  private async stepInit(serviceId: string): Promise<Record<string, string>> {
    const params = new URLSearchParams({
      key: serviceId,
      modus: MODUS_KEY,
      waction: 'init',
    });

    const response = await this.http.post('https://api.abfall.io', params, {
      headers: HEADERS,
      timeout: 15000,
    });

    const html = typeof response.data === 'string' ? response.data : String(response.data ?? '');
    return this.parseHiddenInputs(html);
  }

  /**
   * Step 3: Export iCal data.
   */
  private async stepExportIcs(
    serviceId: string,
    args: Record<string, string>,
  ): Promise<string> {
    // Set time range: now → +365 days
    const now = new Date();
    const date2 = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const formatDate = (d: Date) =>
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

    args['f_zeitraum'] = `${formatDate(now)}-${formatDate(date2)}`;
    args['f_abfallarten_index_max'] = '0';

    const params = new URLSearchParams({
      key: serviceId,
      modus: MODUS_KEY,
      waction: 'export_ics',
    });

    // Add all accumulated args
    for (const [k, v] of Object.entries(args)) {
      if (k !== 'key' && k !== 'modus' && k !== 'waction') {
        params.append(k, v);
      }
    }

    const response = await this.http.post('https://api.abfall.io', params, {
      headers: HEADERS,
      timeout: 30000,
      responseType: 'text',
    });

    let icsData = typeof response.data === 'string' ? response.data : String(response.data ?? '');

    // Remove HTML warnings (from Python source)
    icsData = icsData.replace(/<br.*|<b.*/g, '\r');

    return icsData;
  }

  /**
   * Parse hidden input fields from HTML response.
   * These contain the session token and other state.
   */
  private parseHiddenInputs(html: string): Record<string, string> {
    const args: Record<string, string> = {};
    // Match: <input type="hidden" name="XXX" value="YYY">
    const regex = /<input[^>]*type=["']hidden["'][^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["']/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      args[match[1]] = match[2];
    }
    return args;
  }
}
