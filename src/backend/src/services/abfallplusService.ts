/**
 * AbfallPlus Service — Port der Python-Implementierung
 * Quelle: https://github.com/mampfes/hacs_waste_collection_schedule
 * Unterstützt 100+ Apps/Städte über k4systems API
 */

import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../utils/logger';

// API Konstanten (aus Python-Implementierung)
const API_BASE = 'https://app.abfallplus.de/{app_id}/';
const API_ASSISTANT = 'https://app.abfallplus.de/{app_id}/assist/';
const VERIFY_SSL = true;

const USER_AGENT = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const USER_AGENT_ASSISTANT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Unterstützte Apps (aus Python-Implementierung)
// Quelle: https://github.com/mampfes/hacs_waste_collection_schedule
export const SUPPORTED_APPS: Record<string, string[]> = {
  'de.albagroup.app': ['Berlin', 'Braunschweig', 'Havelland', 'Oberhavel', 'Ostprignitz-Ruppin', 'Tübingen'],
  'de.k4systems.abfallappka': ['Kreis Karlsruhe'],
  'de.k4systems.bonnorange': ['Bonn'],
  'de.k4systems.avea': ['Leverkusen'],
  'de.k4systems.abfallappol': ['Oldenburg'],
  'de.k4systems.wuerzburg': ['Würzburg'],
  'de.k4systems.abfallapp': ['Kreis Augsburg'],
  'de.k4systems.abfallapprv': ['Kreis Ravensburg'],
  'de.k4systems.avlserviceplus': ['Kreis Ludwigsburg'],
  'de.k4systems.abfallappes': ['Landkreis Esslingen'],
  'de.k4systems.awbgp': ['Kreis Göppingen'],
  'de.k4systems.abfallappbh': ['Kreis Breisgau-Hochschwarzwald'],
  'de.k4systems.awbrastatt': ['Kreis Rastatt'],
  'de.k4systems.abfalllkbt': ['Kreis Bayreuth'],
  'de.k4systems.abfallappfuerth': ['Kreis Fürth'],
  'de.k4systems.abfallappno': ['Neckar-Odenwald-Kreis'],
  'de.k4systems.abfallappsig': ['Kreis Sigmaringen'],
  'de.k4systems.abfallappmil': ['Kreis Miltenberg'],
  'de.k4systems.llabfallapp': ['Kreis Landsberg am Lech'],
  'de.k4systems.lkruelzen': ['Kreis Uelzen'],
  'de.k4systems.abfallappgap': ['Kreis Garmisch-Partenkirchen'],
  'de.k4systems.abfallappoal': ['Kreis Ostallgäu'],
  'de.k4systems.abfallappts': ['Kreis Traunstein'],
  'de.k4systems.abfallappvivo': ['Kreis Miesbach'],
  'de.k4systems.abfallscout': ['Kreis Bad Kissingen'],
  'de.k4systems.abfallappfds': ['Kreis Freudenstadt'],
  'de.k4systems.abfallappnf': ['Kreis Nordfriesland'],
  'de.k4systems.abfallappclp': ['Kreis Cloppenburg'],
  'de.k4systems.abfallappog': ['Ortenaukreis'],
  'de.k4systems.abfallappmol': ['Kreis Märkisch-Oderland'],
  'de.k4systems.abfallappbb': ['Landkreis Böblingen'],
  'de.k4systems.abfallappwug': ['Kreis Weißenburg-Gunzenhausen'],
  'de.k4systems.abfallappik': ['Ilm-Kreis'],
  'de.k4systems.abfallappcux': ['Kreis Cuxhaven'],
  'de.k4systems.abfallslk': ['Salzlandkreis'],
  'de.k4systems.abfallappgib': ['Kreis Wesermarsch'],
  'de.k4systems.abfallappvorue': ['Kreis Vorpommern-Rügen'],
  'de.k4systems.abfallappmyk': ['Kreis Mayen-Koblenz'],
  'de.k4systems.abfallappmetz': ['Metzingen'],
  'de.k4systems.abfallkreisrt': ['Kreis Reutlingen'],
  'de.abfallplus.tbrapp': ['Reutlingen'],
  'de.k4systems.abfallappsp': ['Spree-Neiße'],
  'de.k4systems.abfallappbk': ['Bad Kissingen'],
};

// Mapping von App-ID zu User-Agent
const MAP_APP_USERAGENTS: Record<string, string> = {
  'abfallH.ucom.de': 'Landkreis HN',
  'de.ahrweiler.meinawb': 'Abfall App',
  'de.abfallwecker': 'ABFALL+',
  'de.albagroup.app': 'Abfuhrtermine',
  'de.biberach.abfallapp': 'Abfall App',
  'de.cmcitymedia.hokwaste': 'Abfallinfo HOK',
  'de.data_at_work.aws': 'aws Schaumburg',
  'de.drekopf.abfallplaner': 'Abfallplaner',
  'de.edg.abfallapp': 'Abfall App',
  'de.gimik.apps.muellwecker_neuwied': 'Müllwecker',
  'de.idcontor.abfalllu': 'Abfall LU',
  'de.idcontor.abfallwbd': 'WBD App',
};

// Abfallarten die übersprungen werden
const ABFALLARTEN_H2_SKIP = [
  'Sonstiges',
  'Weihnachtsbäume',
];

// Waste-Type Mapping
const WASTE_TYPE_MAP: Record<string, string> = {
  'Restmüll': 'rest',
  'Biomüll': 'bio',
  'Altpapier': 'paper',
  'Gelber Sack': 'yellow',
  'Glas': 'glass',
  'Elektronik': 'electronic',
  'Sperrmüll': 'bulky',
  'Gartenabfälle': 'garden',
};

export interface AbfallPlusEvent {
  date: string;
  summary: string;
  wasteType: string;
}

export interface AbfallPlusResult {
  status: 'ok' | 'error';
  events: AbfallPlusEvent[];
  city?: string;
  source?: string;
  message?: string;
}

export class AbfallPlusService {
  private session: AxiosInstance;
  private appId: string;
  private client: string;

  constructor(appId: string) {
    this.appId = appId;
    this.client = this.generateClient();
    this.session = axios.create({
      timeout: 15000,
      headers: {
        'User-Agent': USER_AGENT,
        'x-abfallplus-client': this.client,
        'x-abfallplus-appid': appId,
      },
    });
  }

  private generateClient(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private getUrl(ending: string): string {
    return API_BASE.replace('{app_id}', this.appId) + ending;
  }

  private async request(ending: string, data?: Record<string, string>, method: 'get' | 'post' = 'post'): Promise<string> {
    const url = this.getUrl(ending);
    
    if (method === 'get') {
      const response = await this.session.get(url);
      return response.data;
    }
    
    const response = await this.session.post(url, new URLSearchParams(data || {}).toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
    });
    return response.data;
  }

  async initConnection(): Promise<string[]> {
    const data = {
      client: this.client,
      app_id: this.appId,
    };
    
    await this.request('config.xml', data);
    const loginHtml = await this.request('login/', data);
    
    const $ = cheerio.load(loginHtml);
    const steps: string[] = [];
    
    $('a[href*="#awk_assistent_step_standort_"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const step = href.split('#awk_assistent_step_standort_')[1];
      if (step) steps.push(step);
    });
    
    return steps;
  }

  async getBundeslaender(): Promise<Array<{id: string, name: string}>> {
    const html = await this.request('bundesland/', undefined, 'get');
    return this.extractOnclicks(html);
  }

  async selectBundesland(bundeslandName: string): Promise<string | null> {
    const bundeslaender = await this.getBundeslaender();
    const match = bundeslaender.find(b => 
      b.name.toLowerCase().includes(bundeslandName.toLowerCase())
    );
    return match?.id || null;
  }

  async getLandkreise(bundeslandId?: string): Promise<Array<{id: string, name: string}>> {
    const data: Record<string, string> = {};
    if (bundeslandId) data.id_bundesland = bundeslandId;
    
    const html = await this.request('landkreis/', data);
    return this.extractOnclicks(html);
  }

  async selectLandkreis(landkreisName: string, bundeslandId?: string): Promise<string | null> {
    const landkreise = await this.getLandkreise(bundeslandId);
    const match = landkreise.find(lk => 
      lk.name.toLowerCase().includes(landkreisName.toLowerCase())
    );
    return match?.id || null;
  }

  async getKommunen(bundeslandId?: string, landkreisId?: string): Promise<Array<{id: string, name: string}>> {
    const data: Record<string, string> = {};
    if (bundeslandId) data.id_bundesland = bundeslandId;
    if (landkreisId) data.id_landkreis = landkreisId;
    
    const html = await this.request('kommune/', data);
    return this.extractOnclicks(html);
  }

  async selectKommune(kommuneName: string, bundeslandId?: string, landkreisId?: string): Promise<string | null> {
    const kommunen = await this.getKommunen(bundeslandId, landkreisId);
    const match = kommunen.find(k => 
      k.name.toLowerCase().includes(kommuneName.toLowerCase())
    );
    return match?.id || null;
  }

  async getStreets(kommuneId: string, bezirkId?: string): Promise<Array<{id: string, name: string}>> {
    const data: Record<string, string> = {
      id_kommune: kommuneId,
      strasse_qry: '',
    };
    if (bezirkId) data.id_bezirk = bezirkId;
    
    const html = await this.request('strasse/', data);
    return this.extractOnclicks(html);
  }

  async selectStreet(streetName: string, kommuneId: string, bezirkId?: string): Promise<string | null> {
    const streets = await this.getStreets(kommuneId, bezirkId);
    const match = streets.find(s => 
      s.name.toLowerCase().includes(streetName.toLowerCase())
    );
    return match?.id || null;
  }

  async getHnrs(strasseId: string, kommuneId: string): Promise<Array<{id: string, name: string}>> {
    const data: Record<string, string> = {
      id_strasse: strasseId,
      id_kommune: kommuneId,
    };
    
    const html = await this.request('hnr/', data);
    return this.extractOnclicks(html, true);
  }

  async selectHnr(hnrName: string, strasseId: string, kommuneId: string): Promise<string | null> {
    const hnrs = await this.getHnrs(strasseId, kommuneId);
    
    // Versuche exakten Match
    let match = hnrs.find(h => 
      h.name.toLowerCase() === hnrName.toLowerCase()
    );
    
    // Fallback: "Alle Hausnummern"
    if (!match) {
      match = hnrs.find(h => 
        h.name.toLowerCase().includes('alle hausnummern')
      );
    }
    
    return match?.id || null;
  }

  async selectAllWasteTypes(strasseId: string, hnr: string, kommuneId: string): Promise<string[]> {
    const data: Record<string, string> = {
      f_id_strasse: strasseId,
      f_hnr: hnr,
      f_id_kommune: kommuneId,
    };
    
    const html = await this.request('abfallarten/', data);
    const $ = cheerio.load(html);
    const wasteTypes: string[] = [];
    
    $('input[name="f_id_abfallart[]"]').each((_, el) => {
      const value = $(el).val() as string;
      if (value) wasteTypes.push(value);
    });
    
    return wasteTypes;
  }

  async getCalendar(
    strasseId: string,
    hnr: string,
    kommuneId: string,
    wasteTypes: string[],
    dateFrom?: string,
    dateTo?: string
  ): Promise<AbfallPlusEvent[]> {
    const now = new Date();
    const from = dateFrom || `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
    const to = dateTo || `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear() + 1}`;
    
    const data: Record<string, string> = {
      f_id_strasse: strasseId,
      f_hnr: hnr,
      f_id_kommune: kommuneId,
      datefrom: from,
      dateto: to,
    };
    
    // Waste Types als Array
    wasteTypes.forEach((wt, i) => {
      data[`f_id_abfallart[${i}]`] = wt;
    });
    
    const html = await this.request('calendar/', data);
    return this.parseCalendarHtml(html);
  }

  private parseCalendarHtml(html: string): AbfallPlusEvent[] {
    const $ = cheerio.load(html);
    const events: AbfallPlusEvent[] = [];
    
    // Tabelle parsen
    $('table tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 2) {
        const dateStr = $(cells[0]).text().trim();
        const wasteType = $(cells[1]).text().trim();
        
        if (dateStr && wasteType) {
          // Datum parsen (DD.MM.YYYY)
          const dateMatch = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
          if (dateMatch) {
            const [, day, month, year] = dateMatch;
            events.push({
              date: `${year}-${month}-${day}`,
              summary: wasteType,
              wasteType: this.mapWasteType(wasteType),
            });
          }
        }
      }
    });
    
    return events;
  }

  private mapWasteType(wasteType: string): string {
    const lower = wasteType.toLowerCase();
    
    if (lower.includes('restmüll') || lower.includes('rest')) return 'rest';
    if (lower.includes('biomüll') || lower.includes('bio')) return 'bio';
    if (lower.includes('papier') || lower.includes('altpapier')) return 'paper';
    if (lower.includes('gelb') || lower.includes('sack')) return 'yellow';
    if (lower.includes('glas')) return 'glass';
    if (lower.includes('elektro')) return 'electronic';
    if (lower.includes('sperr')) return 'bulky';
    if (lower.includes('garten')) return 'garden';
    
    return 'other';
  }

  private extractOnclicks(html: string, isHnr: boolean = false): Array<{id: string, name: string}> {
    const $ = cheerio.load(html);
    const results: Array<{id: string, name: string}> = [];
    
    // onclick Attribute extrahieren
    $('[onclick]').each((_, el) => {
      const onclick = $(el).attr('onclick') || '';
      const match = onclick.match(/['"]([^'"]+)['"]/);
      if (match) {
        const id = match[1];
        const name = $(el).text().trim();
        if (id && name) {
          results.push({ id, name });
        }
      }
    });
    
    return results;
  }

  // Methode für wasteService.ts Integration
  async fetchCalendar(
    street?: string,
    houseNr?: string,
    weeks: number = 2
  ): Promise<AbfallPlusResult> {
    try {
      // 1. Verbindung initialisieren
      await this.initConnection();
      
      // 2. Kommunen holen (erste Kommune = Stadt)
      const kommunen = await this.getKommunen();
      if (kommunen.length === 0) {
        return {
          status: 'error',
          events: [],
          message: 'Keine Kommunen gefunden',
        };
      }
      
      const kommune = kommunen[0];
      
      // 3. Straße finden
      let strasseId: string | null = null;
      if (street) {
        strasseId = await this.selectStreet(street, kommune.id);
      }
      
      // 4. Hausnummer finden
      let hnr: string | null = null;
      if (strasseId && houseNr) {
        hnr = await this.selectHnr(houseNr, strasseId, kommune.id);
      }
      
      // 5. Alle Abfallarten auswählen
      if (strasseId) {
        const wasteTypes = await this.selectAllWasteTypes(strasseId, hnr || '', kommune.id);
        
        // 6. Kalender abrufen
        const now = new Date();
        const dateFrom = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
        const futureDate = new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
        const dateTo = `${String(futureDate.getDate()).padStart(2, '0')}.${String(futureDate.getMonth() + 1).padStart(2, '0')}.${futureDate.getFullYear()}`;
        
        const events = await this.getCalendar(strasseId, hnr || '', kommune.id, wasteTypes, dateFrom, dateTo);
        
        return {
          status: 'ok',
          events,
          city: kommune.name,
          source: 'AbfallPlus',
        };
      }
      
      return {
        status: 'error',
        events: [],
        message: 'Straße nicht gefunden',
      };
    } catch (error: any) {
      logger.error('AbfallPlus error:', error.message);
      return {
        status: 'error',
        events: [],
        message: error.message,
      };
    }
  }
}
