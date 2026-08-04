// ---------------------------------------------------------------------------
// abfallNaviService — AbfallNavi (Bund/RegioIT) Adapter
//
// ARCHITEKTUR:
//   Staatliche API des Bundes (abfallnavi.api.bund.dev)
//   19 Regionen in Deutschland, kostenlose OpenAPI
//
//   API-Flow:
//     1. GET /orte → Orte im System
//     2. GET /orte/{ortId}/strassen → Straßen im Ort
//     3. GET /strassen/{strassenId} → Hausnummern
//     4. GET /fraktionen → Müllsorten
//     5. GET /termine → Abholtermine
//
// MOCK-POLICY: Keine Mocks. Echte HTTP-Calls gegen abfallnavi.api.bund.dev
// ---------------------------------------------------------------------------

import type { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { parseIcsCalendar, type IcsEvent } from '../lib/icalParser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AbfallNaviOrt {
  id: number;
  name: string;
}

export interface AbfallNaviStrasse {
  id: number;
  name: string;
  staticId: string;
  hausNrList?: AbfallNaviHausNr[];
}

export interface AbfallNaviHausNr {
  id: number;
  nr: string;
  plz: string;
  staticId: string;
  gueltigBis: string | null;
}

export interface AbfallNaviFraktion {
  id: number;
  name: string;
  farbe: string;
  aktiv: boolean;
}

export interface AbfallNaviTermin {
  id: number;
  datum: string;
  fraktion: AbfallNaviFraktion;
  abholdatum: string;
  tonnen?: string[];
}

export interface AbfallNaviResult {
  region: string;
  regionName: string;
  street: string;
  houseNr: string;
  events: IcsEvent[];
  source: string;
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Known Regions
// Quelle: abfallnavi.api.bund.dev/openapi.yaml
// ---------------------------------------------------------------------------

export interface AbfallNaviRegion {
  key: string;
  name: string;
  baseUrl: string;
}

export const ABFALL_NAVI_REGIONS: AbfallNaviRegion[] = [
  { key: 'aachen', name: 'Aachen', baseUrl: 'https://aachen-abfallapp.regioit.de/abfall-app-aachen/rest' },
  { key: 'zew2', name: 'AWA Entsorgungs GmbH', baseUrl: 'https://zew2-abfallapp.regioit.de/abfall-app-zew2/rest' },
  { key: 'aw-bgl2', name: 'Bergisch Gladbach', baseUrl: 'https://aw-bgl2-abfallapp.regioit.de/abfall-app-aw-bgl2/rest' },
  { key: 'bav', name: 'Bergischer Abfallwirtschaftverbund', baseUrl: 'https://bav-abfallapp.regioit.de/abfall-app-bav/rest' },
  { key: 'din', name: 'Dinslaken', baseUrl: 'https://din-abfallapp.regioit.de/abfall-app-din/rest' },
  { key: 'dorsten', name: 'Dorsten', baseUrl: 'https://dorsten-abfallapp.regioit.de/abfall-app-dorsten/rest' },
  { key: 'gt2', name: 'Gütersloh', baseUrl: 'https://gt2-abfallapp.regioit.de/abfall-app-gt2/rest' },
  { key: 'hlv', name: 'Halver', baseUrl: 'https://hlv-abfallapp.regioit.de/abfall-app-hlv/rest' },
  { key: 'coe', name: 'Kreis Coesfeld', baseUrl: 'https://coe-abfallapp.regioit.de/abfall-app-coe/rest' },
  { key: 'krhs', name: 'Kreis Heinsberg', baseUrl: 'https://krhs-abfallapp.regioit.de/abfall-app-krhs/rest' },
  { key: 'pi', name: 'Kreis Pinneberg', baseUrl: 'https://pi-abfallapp.regioit.de/abfall-app-pi/rest' },
  { key: 'krwaf', name: 'Kreis Warendorf', baseUrl: 'https://krwaf-abfallapp.regioit.de/abfall-app-krwaf/rest' },
  { key: 'lindlar', name: 'Lindlar', baseUrl: 'https://lindlar-abfallapp.regioit.de/abfall-app-lindlar/rest' },
  { key: 'stl', name: 'Lüdenscheid', baseUrl: 'https://stl-abfallapp.regioit.de/abfall-app-stl/rest' },
  { key: 'nds', name: 'Norderstedt', baseUrl: 'https://nds-abfallapp.regioit.de/abfall-app-nds/rest' },
  { key: 'nuernberg', name: 'Nürnberg', baseUrl: 'https://nuernberg-abfallapp.regioit.de/abfall-app-nuernberg/rest' },
  { key: 'roe', name: 'Roetgen', baseUrl: 'https://roe-abfallapp.regioit.de/abfall-app-roe/rest' },
  { key: 'solingen', name: 'Solingen', baseUrl: 'https://solingen-abfallapp.regioit.de/abfall-app-solingen/rest' },
  { key: 'wml2', name: 'EGW Westmünsterland', baseUrl: 'https://wml2-abfallapp.regioit.de/abfall-app-wml2/rest' },
];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AbfallNaviService {
  constructor(private readonly http: AxiosInstance) {}

  /**
   * Hole Orte für eine Region
   */
  async getOrte(regionKey: string): Promise<AbfallNaviOrt[]> {
    const region = ABFALL_NAVI_REGIONS.find(r => r.key === regionKey);
    if (!region) {
      throw new Error(`Region '${regionKey}' nicht gefunden`);
    }

    const response = await this.http.get<AbfallNaviOrt[]>(`${region.baseUrl}/orte`);
    return response.data;
  }

  /**
   * Hole Straßen für einen Ort
   */
  async getStrassen(regionKey: string, ortId: number): Promise<AbfallNaviStrasse[]> {
    const region = ABFALL_NAVI_REGIONS.find(r => r.key === regionKey);
    if (!region) {
      throw new Error(`Region '${regionKey}' nicht gefunden`);
    }

    const response = await this.http.get<AbfallNaviStrasse[]>(`${region.baseUrl}/orte/${ortId}/strassen`);
    return response.data;
  }

  /**
   * Hole Hausnummern für eine Straße
   */
  async getHausnummern(regionKey: string, strassenId: number): Promise<AbfallNaviHausNr[]> {
    const region = ABFALL_NAVI_REGIONS.find(r => r.key === regionKey);
    if (!region) {
      throw new Error(`Region '${regionKey}' nicht gefunden`);
    }

    const response = await this.http.get<AbfallNaviStrasse>(`${region.baseUrl}/strassen/${strassenId}`);
    return response.data.hausNrList || [];
  }

  /**
   * Hole Fraktionen (Müllsorten) für eine Region
   */
  async getFraktionen(regionKey: string): Promise<AbfallNaviFraktion[]> {
    const region = ABFALL_NAVI_REGIONS.find(r => r.key === regionKey);
    if (!region) {
      throw new Error(`Region '${regionKey}' nicht gefunden`);
    }

    const response = await this.http.get<AbfallNaviFraktion[]>(`${region.baseUrl}/fraktionen`);
    return response.data;
  }

  /**
   * Hole Termine für eine Hausnummer
   */
  async getTermine(regionKey: string, hausId: number): Promise<AbfallNaviTermin[]> {
    const region = ABFALL_NAVI_REGIONS.find(r => r.key === regionKey);
    if (!region) {
      throw new Error(`Region '${regionKey}' nicht gefunden`);
    }

    const response = await this.http.get<AbfallNaviTermin[]>(`${region.baseUrl}/haus/${hausId}/termine`);
    return response.data;
  }

  /**
   * Konvertiere Termine zu WasteCalendarEvent[]
   */
  convertToEvents(termine: AbfallNaviTermin[]): IcsEvent[] {
    return termine.map(termin => ({
      start: termin.datum || termin.abholdatum,
      summary: termin.fraktion?.name || 'Müllabfuhr',
      category: termin.fraktion?.name,
      description: `Müllabfuhr: ${termin.fraktion?.name}`,
    }));
  }

  /**
   * Komplett-Flow: Region + Straße + Hausnummer → Termine
   */
  async fetchCalendar(
    regionKey: string,
    street: string,
    houseNr: string,
    weeks: number = 4,
  ): Promise<AbfallNaviResult> {
    const region = ABFALL_NAVI_REGIONS.find(r => r.key === regionKey);
    if (!region) {
      throw new Error(`Region '${regionKey}' nicht gefunden`);
    }

    logger.info(`AbfallNavi: Fetching calendar for ${region.name}, ${street} ${houseNr}`);

    // 1. Orte holen
    const orte = await this.getOrte(regionKey);
    if (orte.length === 0) {
      throw new Error(`Keine Orte für Region '${regionKey}' gefunden`);
    }
    const ort = orte[0]; // Normalerweise nur ein Ort pro Region

    // 2. Straßen holen
    const strassen = await this.getStrassen(regionKey, ort.id);
    
    // Straße finden (case-insensitive)
    const strasse = strassen.find(s => 
      s.name.toLowerCase().includes(street.toLowerCase())
    );
    if (!strasse) {
      throw new Error(`Straße '${street}' in ${region.name} nicht gefunden`);
    }

    // 3. Hausnummer finden
    const haus = strasse.hausNrList?.find(h => h.nr === houseNr);
    if (!haus) {
      // Wenn keine Hausnummer gefunden, nehme die erste
      const fallbackHaus = strasse.hausNrList?.[0];
      if (!fallbackHaus) {
        throw new Error(`Keine Hausnummern für '${street}' in ${region.name} gefunden`);
      }
      logger.warn(`Hausnummer '${houseNr}' nicht gefunden, verwende '${fallbackHaus.nr}'`);
      
      // 4. Termine für Fallback-Haus holen
      const termine = await this.getTermine(regionKey, fallbackHaus.id);
      const events = this.convertToEvents(termine);

      return {
        region: regionKey,
        regionName: region.name,
        street: strasse.name,
        houseNr: fallbackHaus.nr,
        events,
        source: 'AbfallNavi (Bund)',
        fetchedAt: new Date().toISOString(),
      };
    }

    // 4. Termine holen
    const termine = await this.getTermine(regionKey, haus.id);
    const events = this.convertToEvents(termine);

    return {
      region: regionKey,
      regionName: region.name,
      street: strasse.name,
      houseNr: haus.nr,
      events,
      source: 'AbfallNavi (Bund)',
      fetchedAt: new Date().toISOString(),
    };
  }
}
