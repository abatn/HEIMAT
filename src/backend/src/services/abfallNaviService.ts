// ---------------------------------------------------------------------------
// abfallNaviService — AbfallNavi (Bund/RegioIT) Adapter
//
// ARCHITEKTUR:
//   Staatliche API des Bundes (abfallnavi.api.bund.dev)
//   19 Regionen in Deutschland, kostenlose OpenAPI
//
//   API-Flow (laut openapi.yaml):
//     1. GET /orte → Orte im System
//     2. GET /orte/{ortId}/strassen → Straßen im Ort
//     3. GET /strassen/{strassenId} → Hausnummern
//     4. GET /fraktionen → Müllsorten
//     5. GET /hausnummern/{id}/termine → Abholtermine pro Hausnummer
//     5b. GET /strassen/{id}/termine → Abholtermine pro Straße
//   WICHTIG: /haus/{id}/termine EXISTIERT NICHT — 0 Bytes Response!
//   Korrekter Endpoint: /hausnummern/{id}/termine
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
  /** Datum im Format 'YYYY-MM-DD' */
  datum: string;
  /** Bezirk mit Fraktions-Zuordnung */
  bezirk?: {
    id: number;
    name: string;
    gueltigAb: string;
    fraktionId: number;
  };
  jahr?: number;
  info?: string | null;
  // Legacy-Felder (kommen nicht von der API, aber für Kompatibilität)
  fraktion?: AbfallNaviFraktion;
  abholdatum?: string;
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
   * WICHTIG: Korrekter Endpoint ist /hausnummern/{id}/termine (NICHT /haus/)
   * Quelle: abfallnavi.api.bund.dev/openapi.yaml → termineProHaussnummer
   */
  async getTermine(regionKey: string, hausId: number): Promise<AbfallNaviTermin[]> {
    const region = ABFALL_NAVI_REGIONS.find(r => r.key === regionKey);
    if (!region) {
      throw new Error(`Region '${regionKey}' nicht gefunden`);
    }

    const response = await this.http.get<AbfallNaviTermin[]>(`${region.baseUrl}/hausnummern/${hausId}/termine`);
    return response.data;
  }

  /**
   * Hole Termine für eine Straße (Alternative zu /hausnummern/)
   * Quelle: abfallnavi.api.bund.dev/openapi.yaml → termineProStrasse
   */
  async getTermineStrasse(regionKey: string, strassenId: number): Promise<AbfallNaviTermin[]> {
    const region = ABFALL_NAVI_REGIONS.find(r => r.key === regionKey);
    if (!region) {
      throw new Error(`Region '${regionKey}' nicht gefunden`);
    }

    const response = await this.http.get<AbfallNaviTermin[]>(`${region.baseUrl}/strassen/${strassenId}/termine`);
    return response.data;
  }

  /**
   * Konvertiere Termine zu IcsEvent[]
   * API-Response-Format: { id, datum: 'YYYY-MM-DD', bezirk: { id, name, fraktionId }, jahr, info }
   * Fraktion-ID-Mapping (Nürnberg-Beispiel):
   *   0 = Restabfall, 1 = Bioabfall, 2 = Papiertonne, 3 = Gelbe Tonne
   */
  private readonly fraktionMap: Record<number, string> = {
    0: 'Restabfall',
    1: 'Bioabfall',
    2: 'Papiertonne',
    3: 'Gelbe Tonne',
    4: 'Papiertonne 1100',
  };

  convertToEvents(termine: AbfallNaviTermin[]): IcsEvent[] {
    return termine.map(termin => {
      // Bevorzuge bezirk.fraktionId für korrekte Müllsorten-Zuordnung
      const fraktionId = termin.bezirk?.fraktionId ?? 0;
      const fraktionName = this.fraktionMap[fraktionId] 
        || termin.fraktion?.name 
        || `Müllart ${fraktionId}`;
      
      return {
        start: `${termin.datum}T06:00:00`,
        summary: fraktionName,
        category: fraktionName.toLowerCase(),
        description: termin.info || `Müllabfuhr: ${fraktionName}`,
      };
    });
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

    // 2. Straßen holen (mit Retry bei leerer Antwort — manche Orte haben mehrere
    //    Straßendaten-Sets, z.B. Aachen hat Ort-ID 6484847 = 0 Strassen,
    //    aber Ort-ID 11578729 = 1369 Strassen)
    let strassen = await this.getStrassen(regionKey, ort.id);
    
    // Fallback: Wenn erste Orte-Liste 0 Strassen liefert, versuche alle Orte
    if (strassen.length === 0 && orte.length > 1) {
      logger.warn(`AbfallNavi: ${region.name} Ort ${ort.id} hat 0 Strassen, versuche weitere Orte`);
      for (const altOrt of orte.slice(1)) {
        strassen = await this.getStrassen(regionKey, altOrt.id);
        if (strassen.length > 0) break;
      }
    }
    
    if (strassen.length === 0) {
      throw new Error(`Keine Straßen für Region '${regionKey}' gefunden`);
    }
    
    // Straße finden (case-insensitive, fuzzy match)
    const streetLower = street.toLowerCase().trim();
    const strasse = strassen.find(s => {
      const nameLower = s.name.toLowerCase().trim();
      // Exakter Teilstring-Match
      if (nameLower.includes(streetLower) || streetLower.includes(nameLower)) return true;
      // Umlaut-Normalisierung: ü→ue, ö→oe, ä→ae, ß→ss
      const normalized = nameLower.replace(/ü/g, 'ue').replace(/ö/g, 'oe').replace(/ä/g, 'ae').replace(/ß/g, 'ss');
      const searchNorm = streetLower.replace(/ü/g, 'ue').replace(/ö/g, 'oe').replace(/ä/g, 'ae').replace(/ß/g, 'ss');
      return normalized.includes(searchNorm) || searchNorm.includes(normalized);
    });
    if (!strasse) {
      throw new Error(`Straße '${street}' in ${region.name} nicht gefunden`);
    }

    // 3. Hausnummern separat laden
    // WICHTIG: /orte/{ortId}/strassen liefert KEIN hausNrList!
    // Erst /strassen/{id} (oder /strassen/{id}/termine) liefert Hausnummern.
    let hausnummern = strasse.hausNrList;
    if (!hausnummern || hausnummern.length === 0) {
      hausnummern = await this.getHausnummern(regionKey, strasse.id);
    }
    
    if (!hausnummern || hausnummern.length === 0) {
      throw new Error(`Keine Hausnummern für '${street}' in ${region.name} gefunden`);
    }

    // 4. Hausnummer finden
    const haus = hausnummern.find(h => h.nr === houseNr);
    if (!haus) {
      // Wenn keine Hausnummer gefunden, nehme die erste
      const fallbackHaus = hausnummern[0];
      logger.warn(`Hausnummer '${houseNr}' nicht gefunden, verwende '${fallbackHaus.nr}'`);
      
      // 5. Termine für Fallback-Haus holen
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

    // 5. Termine holen (hausnummern-basiert)
    let termine = await this.getTermine(regionKey, haus.id);
    
    // Fallback: Wenn hausnummern-basierte Termine leer sind, nutze strassen-basiert
    if (termine.length === 0) {
      logger.info(`AbfallNavi: ${region.name} hausnummern-Termine leer, versuche strassen-basiert`);
      termine = await this.getTermineStrasse(regionKey, strasse.id);
    }
    
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
