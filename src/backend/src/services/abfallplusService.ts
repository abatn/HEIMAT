/**
 * AbfallPlus Service — Port der Python-Implementierung
 * Quelle: https://github.com/mampfes/hacs_waste_collection_schedule
 * Datei: custom_components/waste_collection_schedule/service/AppAbfallplusDe.py
 *
 * Korrekte API-URLs:
 *   API_BASE      = https://app.abfallplus.de/{endpoint}
 *   API_ASSISTANT = https://app.abfallplus.de/assistent/{endpoint}
 *
 * Flow: init_connection → bundesland → landkreis → kommune → strasse → hnr
 *       → abfallarten → ueberpruefen → finish → version.xml → struktur.xml.zip
 */

import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../utils/logger';

/** Generate UUID v4 (no external dependency — avoids jest ESM transform issues) */
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------------------------------------------------------------------------
// API Konstanten (exakt wie im Python-Code)
// ---------------------------------------------------------------------------

// Korrekte URLs: app_id ist ein POST-Parameter, KEIN URL-Teil!
// API_BASE      = https://app.abfallplus.de/{endpoint}
// API_ASSISTANT = https://app.abfallplus.de/assistent/{endpoint}
const API_BASE = 'https://app.abfallplus.de/{}';
const API_ASSISTANT = 'https://app.abfallplus.de/assistent/{}';

const USER_AGENT = 'Android / {appName} 8.1.1 (1915081010) / DM=unknown;DT=vbox86p;SN=Google;SV=8.1.0 (27);MF=unknown';
const USER_AGENT_ASSISTANT = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Abfallwecker';

const ABFALLARTEN_H2_SKIP = ['Sondermüll', 'Giftmobil'];

// Mapping von App-ID zu User-Agent AppName
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
  'de.k4systems.abfallappbb': 'Abfall-App',
  'de.k4systems.abfallappbh': 'Abfall App',
  'de.k4systems.abfallappbk': 'AbfallApp BK',
  'de.k4systems.abfallappclp': 'Abfall App CLP',
  'de.k4systems.abfallappcux': 'Abfall LK Cux',
  'de.k4systems.abfallappes': 'Abfall-App',
  'de.k4systems.abfallappfds': 'Abfall App FDS',
  'de.k4systems.abfallappfuerth': 'Abfall-App',
  'de.k4systems.abfallappgap': 'Abfall App',
  'de.k4systems.abfallappgib': 'Abfall App',
  'de.k4systems.abfallappik': 'AbfallApp IK',
  'de.k4systems.abfallappka': 'Abfall App KA',
  'de.k4systems.abfallappla': 'Abfall App',
  'de.k4systems.abfallapploe': 'Abfall-App',
  'de.k4systems.abfallappmetz': 'Abfall App',
  'de.k4systems.abfallappmil': 'AbfallApp MIL',
  'de.k4systems.abfallappmol': 'AbfallApp MOL',
  'de.k4systems.abfallappmyk': 'AbfallApp Myk',
  'de.k4systems.abfallappnf': 'Abfall-AppNF',
  'de.k4systems.abfallappno': 'Abfall-App',
  'de.k4systems.abfallappoal': 'Ostallgäu',
  'de.k4systems.abfallappog': 'Ortenaukreis',
  'de.k4systems.abfallappol': 'Abfall App OL',
  'de.k4systems.abfallapp': 'AbfallApp',
  'de.k4systems.abfallapprv': 'Abfall App RV',
  'de.k4systems.abfallappsig': 'AbfallSIG',
  'de.k4systems.abfallappts': 'AbfallApp TS',
  'de.k4systems.abfallappvivo': 'Abfall App',
  'de.k4systems.abfallappvorue': 'Abfall App',
  'de.k4systems.abfallappwug': 'AbfallApp WUG',
  'de.k4systems.abfallappzak': 'Abfall App',
  'de.k4systems.abfallhr': 'Abfall HR',
  'de.k4systems.abfallinfoapp': 'Abfallinfoapp',
  'de.k4systems.abfallinfocw': 'AbfallinfoCW',
  'de.k4systems.abfallkreisrt': 'AbfallKreisRT',
  'de.k4systems.abfalllkbt': 'Abfall LK BT',
  'de.k4systems.abfalllkbz': 'Abfall LK BZ',
  'de.k4systems.abfalllkswp': 'Abfall LKSWP',
  'de.k4systems.abfallmsp': 'Abfall MSP',
  'de.k4systems.abfallsbk': 'Abfall SBK',
  'de.k4systems.abfallscout': 'Abfall-Scout',
  'de.k4systems.abfallslk': 'Abfall SLK',
  'de.k4systems.abfallwelt': 'abfallwelt',
  'de.k4systems.abfallzak': 'Abfall ZAK',
  'de.k4systems.aevapp': 'AEV-App',
  'de.k4systems.asf': 'ASF',
  'de.k4systems.asoapp': 'ASO-App',
  'de.k4systems.athosmobil': 'ATHOS mobil',
  'de.k4systems.avea': 'AVEA-App',
  'de.k4systems.avlserviceplus': 'AVL Service+',
  'de.k4systems.awa': 'Abfallplaner',
  'de.k4systems.awbemsland': 'AWB Emsland',
  'de.k4systems.awbgp': 'AWB-GP',
  'de.k4systems.awbrastatt': 'AWB Rastatt',
  'de.k4systems.awgbassum': 'AWG Bassum',
  'de.k4systems.awistasta': 'Awista-STA',
  'de.k4systems.awrplus': 'AWR+',
  'de.k4systems.awvapp': 'AWV App',
  'de.k4systems.bawnapp': 'BAWNapp',
  'de.k4systems.bonnorange': 'Abfallplaner',
  'de.k4systems.egst': 'EGST',
  'de.k4systems.hebhagen': 'HEB Hagen',
  'de.k4systems.kufiapp': 'KUFI App',
  'de.k4systems.landshutlk': 'Abfall App',
  'de.k4systems.leipziglk': 'LK Leipzig',
  'de.k4systems.lkemmendingen': 'LK Emmendingen',
  'de.k4systems.lkgoettingen': 'LK Göttingen',
  'de.k4systems.lkgr': 'LK GR',
  'de.k4systems.lkruelzen': 'Abfall App',
  'de.k4systems.lkmabfallplus': 'Abfall App',
  'de.k4systems.llabfallapp': 'LL Abfall App',
  'de.k4systems.meinawblm': 'Mein AWB LM',
  'de.k4systems.muellalarm': 'MüllALARM',
  'de.k4systems.neustadtaisch': 'Abfall-App',
  'de.k4systems.regioentsorgung': 'RE-entsorgt',
  'de.k4systems.teamorange': 'team orange',
  'de.k4systems.udb': 'Müllabfuhr',
  'de.k4systems.unterallgaeu': 'Unterallgäu',
  'de.k4systems.wabapp': 'WAB-App',
  'de.k4systems.willkommen': 'Will Kommen',
  'de.k4systems.wuerzburg': 'Stadtreiniger',
  'de.k4systems.zakb': 'zakb',
  'de.k4systems.zawdw': 'ZAW DW',
  'de.ucom.abfallavr': 'AVR Abfall',
  'de.ucom.abfallebe': 'Wir räumen ab!',
  'de.zawsr': 'ZAW-SR',
};

// ---------------------------------------------------------------------------
// Supported Apps (aus Python-Implementierung)
// ---------------------------------------------------------------------------

export const SUPPORTED_APPS: Record<string, string[]> = {
  'de.albagroup.app': ['Berlin', 'Braunschweig', 'Havelland', 'Oberhavel', 'Ostprignitz-Ruppin', 'Tübingen'],
  'de.k4systems.abfallinfocw': ['Kreis Calw'],
  'de.k4systems.abfallinfoapp': ['Kreis Euskirchen', 'Bad Münstereifel'],
  'de.k4systems.abfallappes': ['Landkreis Esslingen'],
  'de.k4systems.egst': ['Kreis Steinfurt'],
  'de.idcontor.abfallwbd': ['Duisburg'],
  'de.ucom.abfallavr': ['Rhein-Neckar-Kreis'],
  'de.k4systems.abfallapprv': ['Kreis Ravensburg'],
  'de.k4systems.avlserviceplus': ['Kreis Ludwigsburg'],
  'de.k4systems.abfallapp': ['Kreis Augsburg'],
  'de.k4systems.abfallappvorue': ['Kreis Vorpommern-Rügen'],
  'de.k4systems.abfallappfds': ['Kreis Freudenstadt'],
  'de.k4systems.abfallscout': ['Kreis Bad Kissingen'],
  'de.k4systems.avea': ['Leverkusen'],
  'de.k4systems.abfalllkswp': ['Kreis Südwestpfalz'],
  'de.k4systems.awbemsland': ['Kreis Emsland'],
  'de.k4systems.abfallappclp': ['Kreis Cloppenburg'],
  'de.k4systems.abfallappnf': ['Kreis Nordfriesland'],
  'de.k4systems.abfallappog': ['Ortenaukreis'],
  'de.k4systems.abfallappmol': ['Kreis Märkisch-Oderland'],
  'de.k4systems.abfalllkbz': ['Kreis Bautzen'],
  'de.k4systems.abfallappbb': ['Landkreis Böblingen'],
  'de.k4systems.abfallappla': ['Landshut'],
  'de.k4systems.abfallappwug': ['Kreis Weißenburg-Gunzenhausen'],
  'de.k4systems.abfallappik': ['Ilm-Kreis'],
  'de.k4systems.leipziglk': ['Landkreis Leipzig'],
  'de.k4systems.abfallappbk': ['Bad Kissingen'],
  'de.cmcitymedia.hokwaste': ['Hohenlohekreis'],
  'de.abfallwecker': ['Tuttlingen', 'Prignitz', 'Osterode am Harz', 'Nordsachsen'],
  'de.k4systems.abfallappka': ['Kreis Karlsruhe'],
  'de.k4systems.lkgoettingen': ['Kreis Göttingen'],
  'de.k4systems.abfallappcux': ['Kreis Cuxhaven'],
  'de.k4systems.abfallslk': ['Salzlandkreis'],
  'de.k4systems.abfallappzak': ['ZAK Kempten'],
  'de.zawsr': ['ZAW-SR'],
  'de.k4systems.teamorange': ['Kreis Würzburg'],
  'de.k4systems.abfallappvivo': ['Kreis Miesbach'],
  'de.k4systems.lkgr': ['Landkreis Görlitz'],
  'de.k4systems.zawdw': ['AWG Donau-Wald'],
  'de.k4systems.abfallappgib': ['Kreis Wesermarsch'],
  'de.k4systems.wuerzburg': ['Würzburg'],
  'de.k4systems.abfallappgap': ['Kreis Garmisch-Partenkirchen'],
  'de.k4systems.bonnorange': ['Bonn'],
  'de.gimik.apps.muellwecker_neuwied': ['Kreis Neuwied'],
  'abfallH.ucom.de': ['Kreis Heilbronn'],
  'de.k4systems.abfallappts': ['Kreis Traunstein'],
  'de.k4systems.awa': ['Augsburg'],
  'de.k4systems.abfallappfuerth': ['Kreis Fürth'],
  'de.k4systems.abfallwelt': ['Kreis Kitzingen'],
  'de.k4systems.lkemmendingen': ['Kreis Emmendingen'],
  'de.k4systems.abfallkreisrt': ['Kreis Reutlingen'],
  'de.abfallplus.tbrapp': ['Reutlingen'],
  'de.k4systems.abfallappmetz': ['Metzingen'],
  'de.k4systems.abfallappmyk': ['Kreis Mayen-Koblenz'],
  'de.k4systems.abfallappoal': ['Kreis Ostallgäu'],
  'de.k4systems.abfalllkbt': ['Kreis Bayreuth'],
  'de.k4systems.awvapp': ['Kreis Vechta'],
  'de.k4systems.awbgp': ['Kreis Göppingen'],
  'de.k4systems.abfallhr': ['ALF Lahn-Fulda'],
  'de.k4systems.abfallappbh': ['Kreis Breisgau-Hochschwarzwald'],
  'de.k4systems.awgbassum': ['Kreis Diepholz'],
  'de.data_at_work.aws': ['Kreis Schaumburg'],
  'de.k4systems.hebhagen': ['Hagen'],
  'de.k4systems.meinawblm': ['Kreis Limburg-Weilburg'],
  'de.k4systems.abfallmsp': ['Landkreis Main-Spessart'],
  'de.k4systems.asoapp': ['Kreis Osterholz'],
  'de.k4systems.awistasta': ['Kreis Starnberg'],
  'de.ucom.abfallebe': ['Essen'],
  'de.k4systems.bawnapp': ['Kreis Nienburg / Weser'],
  'de.k4systems.abfallappol': ['Oldenburg'],
  'de.k4systems.awbrastatt': ['Kreis Rastatt'],
  'de.k4systems.abfallappmil': ['Kreis Miltenberg'],
  'de.k4systems.abfallsbk': ['Schwarzwald-Baar-Kreis'],
  'de.k4systems.wabapp': ['Westerwaldkreis'],
  'de.k4systems.llabfallapp': ['Kreis Landsberg am Lech'],
  'de.k4systems.lkruelzen': ['Kreis Uelzen'],
  'de.k4systems.abfallzak': ['Zollernalbkreis'],
  'de.k4systems.abfallappno': ['Neckar-Odenwald-Kreis'],
  'de.k4systems.abfallappsig': ['Kreis Sigmaringen'],
  'de.k4systems.asf': ['Freiburg im Breisgau'],
  'de.k4systems.unterallgaeu': ['Unterallgäu'],
  'de.k4systems.landshutlk': ['Kreis Landshut'],
  'de.k4systems.zakb': ['Kreis Bergstraße'],
  'de.k4systems.awrplus': ['Kreis Rotenburg (Wümme)'],
  'de.k4systems.lkmabfallplus': ['München Landkreis'],
  'de.idcontor.abfalllu': ['Ludwigshafen'],
  'de.ahrweiler.meinawb': ['Kreis Ahrweiler'],
  'de.edg.abfallapp': ['Dortmund'],
  'de.biberach.abfallapp': ['Kreis Biberach'],
  'de.abfallplus.abfallappver': ['Kreis Verden'],
  'de.abfallplus.abfallappwt': ['Kreis Waldshut'],
  'de.abfallplus.gfaabfallinfo': ['Kreis Lüneburg'],
  'de.abfallplus.abfalllkrw': ['Kreis Rottweil'],
  'de.cmcitymedia.shawaste': ['Kreis Schwäbisch-Hall'],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AbfallPlusEvent {
  date: string;       // 'YYYY-MM-DD'
  summary: string;    // Waste type name
  wasteType: string;  // Mapped type (rest, bio, paper, etc.)
}

export interface AbfallPlusResult {
  status: 'ok' | 'error';
  events: AbfallPlusEvent[];
  city?: string;
  source?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Oonclick-Parsing (exakt wie im Python-Code)
// ---------------------------------------------------------------------------

interface OnclickItem {
  id: string;
  name: string;
  extra?: Record<string, any>;
}

/**
 * Parse onclick attributes from HTML <a> tags.
 * Python: extract_onclicks() — parsed JSON aus onclick="..." Attributen.
 */
function extractOnclicks(html: string, hnr: boolean = false): OnclickItem[] {
  const $ = cheerio.load(html);
  const results: OnclickItem[] = [];

  $('a[onclick]').each((_, el) => {
    let onclick = $(el).attr('onclick') || '';
    // Python: onclick.replace("('#f_ueberspringen').val('0')", "")
    onclick = onclick.replace("(\'#f_ueberspringen\').val(\'0\')", '');

    const startIdx = onclick.indexOf('(') + 1;
    let endIdx = onclick.indexOf('})') + 1;
    if (endIdx <= 0) {
      endIdx = onclick.indexOf(')\'');
    }
    if (endIdx <= 0) {
      endIdx = onclick.indexOf(')"');
    }

    if (startIdx > 0 && endIdx > startIdx) {
      let jsonStr = onclick.substring(startIdx, endIdx);
      // Python: .replace('"', '\\"').replace("'", '"')
      jsonStr = jsonStr.replace(/"/g, '\\"').replace(/'/g, '"');
      // Clean whitespace
      jsonStr = jsonStr.replace(/\t/g, '').replace(/\r\n/g, '').replace(/\n/g, '');

      try {
        const parsed = JSON.parse(`[${jsonStr}]`);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          const item: OnclickItem = {
            id: String(parsed[0]),
            name: String(parsed[1]),
          };
          // For hnr: extract .val(number) if present
          if (hnr) {
            const valMatch = onclick.match(/\.val\((\d+)\)/);
            if (valMatch) {
              item.id = valMatch[1];
            }
          }
          // Store extra data from position [5] if it's an object
          if (parsed.length > 5 && typeof parsed[5] === 'object') {
            item.extra = parsed[5];
          }
          results.push(item);
        }
      } catch {
        logger.warn(`AbfallPlus: Failed to parse onclick: ${onclick.substring(0, 100)}`);
      }
    }
  });

  return results;
}

/**
 * Case-insensitive string comparison with Umlaut normalization (Python: compare()).
 * 'Auf dem Huegel' matcht 'Auf dem Hügel' via ae→ä, ue→ü, oe→ö normalization.
 */
function normalizeGerman(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize('NFC')
    .replace(/ae/g, 'ä').replace(/oe/g, 'ö').replace(/ue/g, 'ü')
    .replace(/\s/g, '');
}

function compare(a: string, b: string, removeSpace: boolean = false): boolean {
  const aa = removeSpace ? a.replace(/\s/g, '') : a;
  const bb = removeSpace ? b.replace(/\s/g, '') : b;
  return normalizeGerman(aa) === normalizeGerman(bb);
}

// ---------------------------------------------------------------------------
// AbfallPlusService
// ---------------------------------------------------------------------------

export class AbfallPlusService {
  private readonly appId: string;
  private readonly client: string;
  private session: AxiosInstance;
  private cookies: Record<string, string> = {};

  // IDs aus init_connection
  private bundeslandId: string | null = null;
  private landkreisId: string | null = null;
  private kommuneId: string | null = null;
  private regionId: string | null = null;
  private bezirkId = '';
  private strasseId: string | null = null;
  private fIdStrasse: string | null = null;
  private hnr: string | null = null;
  private hnrsNeeded = false;
  private fIdAbfallart: string[] = [];
  private needsSubtitle: string[] = [];
  private bezirkNeeded = false;

  // Search parameters
  private bundeslandSearch: string | null = null;
  private landkreisSearch: string | null = null;
  private regionSearch: string | null = null;
  private strasseSearch: string | null = null;
  private hnrSearch: string | null = null;
  private bezirkSearch: string | null = null;

  constructor(appId: string) {
    this.appId = appId;
    this.client = uuidv4();
    this.session = axios.create({
      timeout: 20000,
      maxRedirects: 5,
    });
  }

  // ---------------------------------------------------------------------------
  // HTTP Request (exakt wie Python: _request())
  // ---------------------------------------------------------------------------

  private async request(
    urlEnding: string,
    base: 'api_base' | 'api_assistant' = 'api_assistant',
    data?: Record<string, string>,
    method: 'get' | 'post' = 'post',
  ): Promise<string> {
    // Korrekte URL: app_id ist POST-Parameter, NICHT URL-Teil
    const baseUrl = base === 'api_base'
      ? `https://app.abfallplus.de/${urlEnding}`
      : `https://app.abfallplus.de/assistent/${urlEnding}`;

    const headers: Record<string, string> = {};

    if (base === 'api_assistant') {
      headers['User-Agent'] = USER_AGENT_ASSISTANT;
      headers['Accept'] = '*/*';
      headers['Origin'] = 'https://app.abfallplus.de';
      headers['X-Requested-With'] = 'XMLHttpRequest';
      headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
      headers['Referer'] = 'https://app.abfallplus.de/login/';
      headers['Accept-Encoding'] = 'gzip, deflate, br';
      headers['Accept-Language'] = 'de-DE,de;q=0.9';
    } else {
      const appName = MAP_APP_USERAGENTS[this.appId] || '%';
      headers['User-Agent'] = USER_AGENT.replace('{appName}', appName);
      headers['x-abfallplus-client'] = this.client;
      headers['x-abfallplus-appid'] = this.appId;
    }

    if (urlEnding.includes('config.xml')) {
      headers['Accept-Encoding'] = 'gzip, deflate, br';
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else {
      // Python: time.sleep(1) between requests (except config.xml)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Cookies senden (Python: requests.Session() managed Cookies automatisch)
    const cookieStr = Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    if (cookieStr) {
      headers['Cookie'] = cookieStr;
    }

    try {
      let response;
      if (method === 'get') {
        response = await this.session.get(baseUrl, { headers });
      } else {
        const postData = data ? new URLSearchParams(data).toString() : '';
        response = await this.session.post(baseUrl, postData, { headers });
      }

      // Update cookies from response (Python: requests.Session())
      const setCookies = response.headers['set-cookie'];
      if (setCookies && Array.isArray(setCookies)) {
        for (const cookie of setCookies) {
          const [nameValue] = cookie.split(';');
          const eqIdx = nameValue.indexOf('=');
          if (eqIdx > 0) {
            const name = nameValue.substring(0, eqIdx).trim();
            const value = nameValue.substring(eqIdx + 1).trim();
            if (name && value) {
              this.cookies[name] = value;
            }
          }
        }
      }

      return typeof response.data === 'string' ? response.data : String(response.data);
    } catch (error: any) {
      logger.error(`AbfallPlus request failed: ${baseUrl} — ${error.message}`);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Step 1: init_connection()
  // ---------------------------------------------------------------------------

  async initConnection(): Promise<string[]> {
    const data = {
      client: this.client,
      app_id: this.appId,
    };

    // Python: config.xml (base=API_BASE)
    await this.request('config.xml', 'api_base', data);

    // Python: login/ (base=API_BASE)
    const loginHtml = await this.request('login/', 'api_base', data);

    // Parse login HTML for hidden inputs
    const $ = cheerio.load(loginHtml);

    $('input[type="hidden"]').each((_, el) => {
      const name = $(el).attr('name') || '';
      const value = $(el).attr('value') || '';
      if (name === 'f_id_bundesland') this.bundeslandId = value;
      else if (name === 'f_id_landkreis') this.landkreisId = value;
      else if (name === 'f_id_kommune') this.kommuneId = value;
    });

    // Parse navigation steps
    const steps: string[] = [];
    $('a[href*="#awk_assistent_step_standort_"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const step = href.split('#awk_assistent_step_standort_')[1];
      if (step) steps.push(step);
    });

    this.bezirkNeeded = steps.includes('bezirk');
    return steps;
  }

  // ---------------------------------------------------------------------------
  // Step 2: Bundesland
  // ---------------------------------------------------------------------------

  async getBundeslaender(): Promise<Array<{ id: string; name: string }>> {
    const html = await this.request('bundesland/', 'api_assistant', undefined, 'get');
    return extractOnclicks(html).map(a => ({ id: a.id, name: a.name }));
  }

  async selectBundesland(name?: string): Promise<void> {
    if (name) this.bundeslandSearch = name;
    if (!this.bundeslandSearch) return;

    const bundeslaender = await this.getBundeslaender();
    for (const bl of bundeslaender) {
      if (compare(bl.name, this.bundeslandSearch)) {
        this.bundeslandId = bl.id;
        return;
      }
    }
    logger.warn(`AbfallPlus: Bundesland "${this.bundeslandSearch}" nicht gefunden`);
  }

  // ---------------------------------------------------------------------------
  // Step 3: Landkreis
  // ---------------------------------------------------------------------------

  async getLandkreise(regionKeyName: string = 'landkreis'): Promise<Array<{ id: string; name: string; extra?: Record<string, any> }>> {
    const data: Record<string, string> = {};
    if (this.bundeslandId) data.id_bundesland = this.bundeslandId;

    const html = await this.request(`${regionKeyName}/`, 'api_assistant', data);
    const items = extractOnclicks(html);

    // Python: Extract set_id_bundesland, set_id_landkreis from onclick data
    for (const item of items) {
      if (item.extra) {
        if (item.extra.set_id_bundesland) this.bundeslandId = item.extra.set_id_bundesland;
        if (item.extra.set_id_landkreis) this.landkreisId = item.extra.set_id_landkreis;
      }
    }

    // Python: if landkreis empty, try "region"
    if (regionKeyName === 'landkreis' && items.length === 0) {
      return this.getLandkreise('region');
    }

    return items;
  }

  async selectLandkreis(name?: string): Promise<void> {
    if (name) this.landkreisSearch = name;
    if (!this.landkreisSearch) return;

    const landkreise = await this.getLandkreise();
    for (const lk of landkreise) {
      if (compare(lk.name, this.landkreisSearch)) {
        this.landkreisId = lk.id;
        return;
      }
    }
    logger.warn(`AbfallPlus: Landkreis "${this.landkreisSearch}" nicht gefunden`);
  }

  // ---------------------------------------------------------------------------
  // Step 4: Kommune
  // ---------------------------------------------------------------------------

  async getKommunen(regionKeyName: string = 'kommune'): Promise<Array<{
    id: string; name: string;
    bundeslandId?: string; landkreisId?: string; kommuneId?: string;
  }>> {
    const data: Record<string, string> = {};
    if (this.bundeslandId) data.id_bundesland = this.bundeslandId;
    if (this.landkreisId) data.id_landkreis = this.landkreisId;

    const html = await this.request(`${regionKeyName}/`, 'api_assistant', data);
    const items = extractOnclicks(html);

    return items.map(a => ({
      id: a.id,
      name: a.name,
      bundeslandId: a.extra?.set_id_bundesland,
      landkreisId: a.extra?.set_id_landkreis,
      kommuneId: a.extra?.set_id_kommune,
    }));
  }

  async selectKommune(name?: string): Promise<void> {
    if (name) this.regionSearch = name;
    if (!this.regionSearch) return;

    const kommunen = await this.getKommunen();
    for (const k of kommunen) {
      if (compare(k.name, this.regionSearch)) {
        if (k.bundeslandId) this.bundeslandId = k.bundeslandId;
        if (k.landkreisId) this.landkreisId = k.landkreisId;
        this.regionId = k.id;
        this.kommuneId = k.kommuneId || k.id;
        return;
      }
    }
    logger.warn(`AbfallPlus: Kommune "${this.regionSearch}" nicht gefunden`);
  }

  // ---------------------------------------------------------------------------
  // Step 5: Straße
  // ---------------------------------------------------------------------------

  async getStreets(): Promise<Array<{
    id: string; name: string;
    kommuneId?: string; bezirkId?: string; hnrsNeeded: boolean;
  }>> {
    const data: Record<string, string> = {
      id_landkreis: this.landkreisId || '',
      id_bezirk: this.bezirkId || '',
      id_kommune: this.kommuneId || '',
      id_kommune_qry: this.kommuneId || '',
      strasse_qry: this.strasseSearch || '',
    };

    const html = await this.request('strasse/', 'api_assistant', data);
    const items = extractOnclicks(html);

    return items.map(a => ({
      id: a.id,
      name: a.name,
      kommuneId: a.extra?.set_id_kommune,
      bezirkId: a.extra?.set_id_bezirk,
      hnrsNeeded: (a.extra?.step_follow_data as any)?.step_akt !== 'strasse',
    }));
  }

  async selectStreet(name?: string): Promise<void> {
    if (name) this.strasseSearch = name;

    const streets = await this.getStreets();

    // Python: if no search and only 1 street → use it
    if (!this.strasseSearch && streets.length === 1) {
      this.strasseSearch = streets[0].name;
    }
    if (!this.strasseSearch && streets.length === 0) {
      return;
    }

    for (const s of streets) {
      if (compare(s.name, this.strasseSearch || '')) {
        this.fIdStrasse = this.strasseId = s.id;
        if (s.kommuneId) this.kommuneId = s.kommuneId;
        if (s.bezirkId) this.bezirkId = s.bezirkId;
        this.hnrsNeeded = s.hnrsNeeded;
        return;
      }
    }
    logger.warn(`AbfallPlus: Straße "${this.strasseSearch}" nicht gefunden`);
  }

  // ---------------------------------------------------------------------------
  // Step 6: Hausnummer
  // ---------------------------------------------------------------------------

  async getHnrs(): Promise<Array<{ id: string; name: string; fIdStrasse?: string }>> {
    const data: Record<string, string> = {
      id_landkreis: this.landkreisId || '',
      id_kommune: this.kommuneId || '',
      id_bezirk: this.bezirkId || '',
      id_strasse: this.strasseId || '',
    };

    const html = await this.request('hnr/', 'api_assistant', data);
    const items = extractOnclicks(html, true);

    return items.map(a => ({
      id: a.id,
      name: decodeURIComponent(a.id).split('|')[0],
      fIdStrasse: a.extra?.f_id_strasse,
    }));
  }

  async selectHnr(name?: string): Promise<void> {
    if (name) this.hnrSearch = name;

    const hnrs = await this.getHnrs();

    // Python: if no search and only 1 hnr → use it
    if (!this.hnrSearch && hnrs.length === 1) {
      this.hnrSearch = hnrs[0].name;
    }
    if (!this.hnrSearch && hnrs.length === 0) {
      return;
    }

    for (const h of hnrs) {
      if (compare(h.name, this.hnrSearch || '', true)) {
        this.hnr = h.id;
        if (h.fIdStrasse) this.fIdStrasse = h.fIdStrasse;
        return;
      }
    }

    // Python: fallback to "Alle Hausnummern"
    for (const h of hnrs) {
      if (compare(h.name, 'Alle Hausnummern', true)) {
        this.hnr = h.id;
        if (h.fIdStrasse) this.fIdStrasse = h.fIdStrasse;
        return;
      }
    }
    logger.warn(`AbfallPlus: Hausnummer "${this.hnrSearch}" nicht gefunden`);
  }

  // ---------------------------------------------------------------------------
  // Step 7: Alle Abfallarten auswählen
  // ---------------------------------------------------------------------------

  async selectAllWasteTypes(): Promise<void> {
    const data: Record<string, string> = {
      f_id_region: this.regionId || '',
      f_id_bundesland: this.bundeslandId || '',
      f_id_landkreis: this.landkreisId || '',
      f_id_kommune: this.kommuneId || '',
      f_id_bezirk: '',
      f_id_strasse: this.fIdStrasse || '',
      f_hnr: this.hnr || '',
      f_kdnr: '',
    };

    const html = await this.request('abfallarten/', 'api_assistant', data);
    const $ = cheerio.load(html);

    // Python: Handle ABFALLARTEN_H2_SKIP (Sondermüll, Giftmobil)
    for (const toSkip of ABFALLARTEN_H2_SKIP) {
      const h2 = $(`h2:contains("${toSkip}")`);
      const parentDiv = h2.closest('div');
      if (parentDiv.length) {
        parentDiv.find('input[name="f_id_abfallart[]"]').each((_, el) => {
          const id = ($(el).attr('id') || '').split('_').pop() || '';
          if (id && !this.fIdAbfallart.includes(id)) {
            this.fIdAbfallart.push(id);
            this.needsSubtitle.push(id);
          }
        });
        parentDiv.remove();
      }
    }

    // Python: Select all waste types with value == "0" or any value
    $('input[name="f_id_abfallart[]"]').each((_, el) => {
      const value = $(el).attr('value') || '';
      const id = ($(el).attr('id') || '').split('_').pop() || '';

      if (value === '0') {
        if (id && !this.fIdAbfallart.includes(id)) {
          this.fIdAbfallart.push(id);
          this.needsSubtitle.push(id);
        }
        return;
      }

      if (value && !this.fIdAbfallart.includes(value)) {
        this.fIdAbfallart.push(value);
      }
    });

    this.fIdAbfallart = [...new Set(this.fIdAbfallart)];
    this.needsSubtitle = [...new Set(this.needsSubtitle)];
  }

  // ---------------------------------------------------------------------------
  // Step 8: Validierung (ueberpruefen + finish)
  // ---------------------------------------------------------------------------

  async validate(): Promise<void> {
    const baseData: Record<string, string> = {
      f_id_bundesland: this.bundeslandId || '',
      f_id_landkreis: this.landkreisId || '',
      f_id_kommune: this.kommuneId || '',
      f_id_bezirk: '',
      f_id_strasse: this.fIdStrasse || '',
      f_hnr: this.hnr || '',
      f_kdnr: '',
      f_uhrzeit_tag: '86400|0',
      f_uhrzeit_stunden: '54000',
      f_uhrzeit_minuten: '600',
      f_anonym: '1',
      f_ausgangspunkt: '1',
      f_ueberspringen: '0',
    };

    // Python: f_id_abfallart[] is an array
    const data: Record<string, string> = { ...baseData };
    for (let i = 0; i < this.fIdAbfallart.length; i++) {
      data[`f_id_abfallart[${i}]`] = this.fIdAbfallart[i];
    }

    await this.request('ueberpruefen/', 'api_assistant', data);

    // Python: finish/ with f_datenschutz timestamp
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    data.f_datenschutz = timestamp;

    await this.request('finish/', 'api_assistant', data);
  }

  // ---------------------------------------------------------------------------
  // Step 9: Kalender abrufen (version.xml + struktur.xml.zip)
  // ---------------------------------------------------------------------------

  async getCollections(): Promise<AbfallPlusEvent[]> {
    // Python: version.xml twice, then struktur.xml.zip
    const data = {
      client: this.client,
      app_id: this.appId,
    };

    await this.request('version.xml', 'api_base', data);
    await this.request('version.xml', 'api_base', { ...data, renew: '1' });

    // Python: struktur.xml.zip contains the calendar data
    const xml = await this.request('struktur.xml.zip', 'api_base', data);

    return this.parseXmlCalendar(xml);
  }

  /**
   * Parse struktur.xml.zip response (XML format).
   * Python: BeautifulSoup(r.text, "xml") — parses categories + dates.
   */
  private parseXmlCalendar(xml: string): AbfallPlusEvent[] {
    const $ = cheerio.load(xml, { xmlMode: true });
    const events: AbfallPlusEvent[] = [];

    // Parse categories
    const categories: Record<string, string> = {};
    $('key:contains("categories")').next('array').find('dict').each((_, dict) => {
      const catId = $(dict).find('key:contains("id")').next('string').text();
      let name = $(dict).find('key:contains("name")').next('string').text()
        .replace('![CDATA[', '').replace(']]', '').trim();
      const subtitleTag = $(dict).find('key:contains("subtitle")').next('string');
      const subtitle = subtitleTag.length > 0
        ? subtitleTag.text().replace('![CDATA[', '').replace(']]', '').trim()
        : '';

      // Python: If subtitle needed or duplicate name, append subtitle
      if (subtitle && (this.needsSubtitle.includes(catId) || Object.values(categories).filter(n => n === name).length > 0)) {
        name += ' - ' + subtitle;
      }

      categories[catId] = name;
    });

    // Parse dates
    $('key:contains("dates")').next('array').find('dict').each((_, dict) => {
      const categoryId = $(dict).find('key:contains("category_id")').next('string').text();
      const pickupDateStr = $(dict).find('key:contains("pickup_date")').next('string').text();

      const categoryName = categories[categoryId] || `Unknown (${categoryId})`;

      // Parse ISO date: '2024-01-15T08:00:00+01:00'
      const dateMatch = pickupDateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        const [, year, month, day] = dateMatch;
        events.push({
          date: `${year}-${month}-${day}`,
          summary: categoryName,
          wasteType: this.mapWasteType(categoryName),
        });
      }
    });

    return events;
  }

  private mapWasteType(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('restmüll') || lower.includes('rest')) return 'rest';
    if (lower.includes('biomüll') || lower.includes('bio')) return 'bio';
    if (lower.includes('papier') || lower.includes('altpapier') || lower.includes('blaue tonne')) return 'paper';
    if (lower.includes('gelb') || lower.includes('sack') || lower.includes('wertstoff')) return 'yellow';
    if (lower.includes('glas')) return 'glass';
    if (lower.includes('elektro')) return 'electronic';
    if (lower.includes('sperr')) return 'bulky';
    if (lower.includes('garten')) return 'garden';
    return 'other';
  }

  // ---------------------------------------------------------------------------
  // Public API: fetchCalendar() — kompletter Flow
  // ---------------------------------------------------------------------------

  async fetchCalendar(
    street?: string,
    houseNr?: string,
    weeks: number = 2,
    bundesland?: string,
    landkreis?: string,
    kommune?: string,
  ): Promise<AbfallPlusResult> {
    try {
      // Step 1: Init
      await this.initConnection();
      logger.info(`AbfallPlus: init_connection OK, steps=${this.bezirkNeeded ? 'bezirk' : 'no-bezirk'}`);

      // Step 2: Bundesland (if needed)
      if (bundesland) await this.selectBundesland(bundesland);

      // Step 3: Landkreis (if needed)
      if (landkreis) await this.selectLandkreis(landkreis);

      // Step 4: Kommune (city)
      // Bonn: Kommune = erster Buchstabe der Straße (A, B, C, ...)
      if (kommune) {
        await this.selectKommune(kommune);
      } else if (street) {
        // Auto-Select: Erster Buchstabe der Straße als Kommune
        const firstLetter = street.trim().charAt(0).toUpperCase();
        if (firstLetter >= 'A' && firstLetter <= 'Z') {
          await this.selectKommune(firstLetter);
        }
      }

      // Step 5: Straße (client-side match mit Umlaut-Normalisierung)
      if (street) {
        this.strasseSearch = street;
        const allStreets = await this.getStreets();
        const match = allStreets.find(s => compare(s.name, street));
        if (match) {
          this.fIdStrasse = this.strasseId = match.id;
          if (match.kommuneId) this.kommuneId = match.kommuneId;
          if (match.bezirkId) this.bezirkId = match.bezirkId;
          this.hnrsNeeded = match.hnrsNeeded;
        }
      } else {
        // Kein Street: Alle Straßen laden und "Alle Straßen" wählen
        const allStreets = await this.getStreets();
        if (allStreets.length === 1) {
          this.fIdStrasse = this.strasseId = allStreets[0].id;
        }
      }

      // Step 6: Hausnummer
      if (houseNr) {
        this.hnrSearch = houseNr;
        const allHnrs = await this.getHnrs();
        const match = allHnrs.find(h => compare(h.name, houseNr, true));
        if (match) {
          this.hnr = match.id;
          if (match.fIdStrasse) this.fIdStrasse = match.fIdStrasse;
        }
      } else if (this.hnrsNeeded) {
        const allHnrs = await this.getHnrs();
        if (allHnrs.length === 1) {
          this.hnr = allHnrs[0].id;
        } else {
          // Fallback: "Alle Hausnummern"
          const alleHnr = allHnrs.find(h => compare(h.name, 'Alle Hausnummern', true));
          if (alleHnr) this.hnr = alleHnr.id;
        }
      }

      // Step 7: Alle Abfallarten
      await this.selectAllWasteTypes();
      logger.info(`AbfallPlus: wasteTypes=${this.fIdAbfallart.length}`);

      // Step 8: Validierung
      await this.validate();
      logger.info('AbfallPlus: validate OK');

      // Step 9: Kalender abrufen
      const events = await this.getCollections();
      logger.info(`AbfallPlus: ${events.length} events fetched`);

      return {
        status: 'ok',
        events,
        city: this.kommuneId || this.regionSearch || 'unknown',
        source: 'AbfallPlus',
      };
    } catch (error: any) {
      logger.error(`AbfallPlus error: ${error.message}`);
      return {
        status: 'error',
        events: [],
        message: error.message,
      };
    }
  }
}
