import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { logger } from '../utils/logger';

const EFA_TIMEOUT_MS = 8000;

// Leichtgewichtiger XML-Parser: Array-Konsistenz wahren (EFA liefert bei
// einem Element oft ein Objekt statt Array -> normalisieren).
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: true,
  parseAttributeValue: true,
  trimValues: true,
  isArray: (name: string) =>
    ['itdStop', 'itdDeparture', 'itdServingLine', 'itdLeg', 'itdPoint', 'stop', 'itdDate', 'itdTime'].includes(name),
});

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0');
}

function formatEfaDateTime(date: Date): { date: string; time: string } {
  return {
    date: `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`,
    time: `${pad(date.getHours())}${pad(date.getMinutes())}`,
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EfaStop {
  /** IFOPT-Haltestellen-ID, z.B. "de:09162:10" */
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Verkehrsverbund / Endpunkt-Key, der diese Haltestelle kennt */
  endpoint: string;
  /** Qualitaet der Treffergenauigkeit (0..100) */
  quality?: number;
}

export interface EfaDeparture {
  stopId: string;
  stopName: string;
  /** Linien-Kurzname, z.B. "S1", "U6", "Bus 100" */
  line: string;
  /** Produktart: bus, tram, subway, train, ferry, etc. */
  mode: string;
  direction: string;
  /** Geplante Abfahrt als ISO-String */
  plannedDeparture: string;
  /** Echte Abfahrt (bei Verspaetung abweichend) als ISO-String, falls vorhanden */
  realtimeDeparture?: string;
  /** Verspaetung in Minuten (0 = puenktlich) */
  delayMinutes: number;
  /** EVA-Nummer / Fahrt-ID, falls vorhanden */
  journeyId?: string;
  platform?: string;
  endpoint: string;
}

export interface EfaLeg {
  mode: string;
  line?: string;
  direction?: string;
  originName: string;
  destinationName: string;
  originPlannedDeparture?: string;
  destinationPlannedArrival?: string;
  /** Reine Fahrzeit in Minuten */
  durationMinutes: number;
  /** Anzahl Umstiege innerhalb dieses Teils (meist 0) */
  changeCount: number;
}

export interface EfaJourney {
  /** Gesamtdauer in Minuten */
  durationMinutes: number;
  legs: EfaLeg[];
  /** Anzahl der Umstiege */
  changes: number;
  /** Geplante Startzeit als ISO-String */
  plannedDeparture: string;
  /** Geplante Ankunft als ISO-String */
  plannedArrival: string;
  endpoint: string;
}

// ---------------------------------------------------------------------------
// EFA-Endpunkte (deutschlandweit flaechendeckend)
// ---------------------------------------------------------------------------

export interface EfaEndpoint {
  /** Eindeutiger Schluessel */
  key: string;
  /** Anzeigename des Verkehrsverbunds */
  name: string;
  /** EFA-Shortname fuer den einheitlichen Proxy dbf.finalrewind.org (z.B. 'VRR') */
  short: string;
  /** Ungefaehrer Mittelpunkt des Versorgungsgebiets [lat, lng] fuer Endpunkt-Wahl */
  center: [number, number];
}

export const EFA_ENDPOINTS: Record<string, EfaEndpoint> = {
  vbb:   { key: 'vbb',   name: 'VBB Berlin-Brandenburg',                  short: 'VBB',  center: [52.5200, 13.4050] },
  mvv:   { key: 'mvv',   name: 'MVV München',                            short: 'MVV',  center: [48.1374, 11.5755] },
  vrr:   { key: 'vrr',   name: 'VRR Rhein-Ruhr',                         short: 'VRR',  center: [51.2277, 6.7735] },
  vrs:   { key: 'vrs',   name: 'VRS Verkehrsverbund Rhein-Sieg',         short: 'VRS',  center: [50.9375, 6.9603] },
  vvs:   { key: 'vvs',   name: 'VVS Stuttgart',                          short: 'VVS',  center: [48.7758, 9.1829] },
  vgn:   { key: 'vgn',   name: 'VGN Nürnberg',                           short: 'VGN',  center: [49.4521, 11.0767] },
  kvv:   { key: 'kvv',   name: 'KVV Karlsruhe',                          short: 'KVV',  center: [49.0069, 8.4037] },
  nvv:   { key: 'nvv',   name: 'NVV Nordhessen',                         short: 'NVV',  center: [51.3127, 9.4797] },
  gvh:   { key: 'gvh',   name: 'GVH Hannover',                           short: 'GVH',  center: [52.3745, 9.7376] },
  hvv:   { key: 'hvv',   name: 'HVV Hamburg',                            short: 'HVV',  center: [53.5511, 9.9937] },
  madd:  { key: 'madd',  name: 'MDV Mitteldeutscher Verkehrsverbund',    short: 'MDV',  center: [51.3397, 12.3731] },
  vvo:   { key: 'vvo',   name: 'VVO Dresden',                            short: 'VVO',  center: [51.0504, 13.7373] },
  vrn:   { key: 'vrn',   name: 'VRN Verkehrsverbund Rhein-Neckar',       short: 'VRN',  center: [49.4875, 8.4660] },
  avv:   { key: 'avv',   name: 'AVV Augsburg',                           short: 'AVV',  center: [48.3705, 10.8978] },
  vmv:   { key: 'vmv',   name: 'VMV Vorpommern',                         short: 'VMV',  center: [54.0924, 13.3994] },
  vgs:   { key: 'vgs',   name: 'VGS Saarland',                           short: 'VGS',  center: [49.2403, 7.0028] },
  vbn:   { key: 'vbn',   name: 'VBN Verkehrsverbund Bremen/Niedersachsen', short: 'VBN', center: [53.0793, 8.8017] },
  ding:  { key: 'ding',  name: 'DING Donau-Iller',                       short: 'DING', center: [48.4000, 10.0000] },
  bsvg:  { key: 'bsvg',  name: 'BSVG Braunschweig',                      short: 'BSVG', center: [52.2700, 10.5200] },
  nvbw:  { key: 'nvbw',  name: 'NVBW Baden-Württemberg',                 short: 'NVBW', center: [48.7800, 9.1800] },
};

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Generischer EFA-Client (ein Verkehrsverbund)
// ---------------------------------------------------------------------------

export class EfaClient {
  constructor(
    public readonly endpoint: EfaEndpoint,
    private readonly timeoutMs: number = EFA_TIMEOUT_MS,
  ) {}

  private async request(path: string, params: Record<string, string | number>): Promise<any | null> {
    try {
      const response = await axios.get(`https://dbf.finalrewind.org/${path}`, {
        params: { efa: this.endpoint.short, ...params },
        timeout: this.timeoutMs,
        headers: { 'User-Agent': 'HEIMAT-App/1.0 (https://github.com/abatn/HEIMAT)' },
        responseType: 'text',
      });
      const xml = typeof response.data === 'string' ? response.data : String(response.data);
      return xmlParser.parse(xml);
    } catch (error: any) {
      const status = error?.response?.status;
      logger.warn(
        `EFA[${this.endpoint.key}] ${path} fehlgeschlagen (status ${status ?? 'timeout'}): ${error?.message || error}`,
      );
      return null;
    }
  }

  /** Haltestellensuche via XML_STOPFINDER_REQUEST */
  async findStop(queryStr: string, limit = 10): Promise<EfaStop[]> {
    const data = await this.request('XML_STOPFINDER_REQUEST', {
      type_sf: 'stop',
      name_sf: queryStr,
      limit: limit,
      doNotSearchForStops: 0,
      coordOutputFormat: 'WGS84',
    });
    const sf = data?.itdRequest?.itdStopFinderRequest;
    if (!sf) return [];
    const stops = toArray<any>(sf.itdStop);
    return stops
      .map((s: any): EfaStop | null => {
        const name = s?.name;
        const id = s?.['@_id'] ?? s?.id;
        const ref = s?.itdStopAlt?.findStop?.['@_id'] ?? s?.ref?.['@_id'];
        const stopId = id ?? ref;
        if (!name || !stopId) return null;
        const wgs = s?.itdCoordinate?.wgs84 ?? s?.wgs84;
        const lat = parseFloat(wgs?.['@_y'] ?? wgs?.y ?? s?.['@_y'] ?? 'NaN');
        const lng = parseFloat(wgs?.['@_x'] ?? wgs?.x ?? s?.['@_x'] ?? 'NaN');
        const quality = s?.['@_quality'] != null ? Number(s['@_quality']) : undefined;
        return {
          id: String(stopId),
          name,
          latitude: Number.isFinite(lat) ? lat : 0,
          longitude: Number.isFinite(lng) ? lng : 0,
          endpoint: this.endpoint.key,
          quality,
        };
      })
      .filter((s: EfaStop | null): s is EfaStop => s !== null);
  }

  /** Abfahrtsmonitor via XML_DM_REQUEST (departure board) */
  async getDepartures(stopId: string, limit = 10, date: Date = new Date()): Promise<EfaDeparture[]> {
    const { date: d, time: t } = formatEfaDateTime(date);
    const data = await this.request('XML_DM_REQUEST', {
      type_dm: 'dep',
      name_dm: stopId,
      itdDate: d,
      itdTime: t,
      limit: limit,
      useRealtime: 1,
      coordOutputFormat: 'WGS84',
    });
    const dm = data?.itdRequest?.itdDepartureMonitorRequest;
    if (!dm) return [];
    const departures = toArray<any>(dm.itdDeparture);
    return departures.map((dep: any): EfaDeparture => {
      const line = dep?.itdServingLine;
      const mode = this.normalizeMode(line?.['@_mot'] ?? line?.mot);
      const planned = this.buildIso(dep?.itdDateTime?.itdDate, dep?.itdDateTime?.itdTime);
      let realtime: string | undefined;
      let delay = 0;
      const rt = dep?.itdRTDateTime;
      if (rt?.itdDate && rt?.itdTime) {
        realtime = this.buildIso(rt.itdDate, rt.itdTime);
        if (planned && realtime) {
          delay = Math.round((new Date(realtime).getTime() - new Date(planned).getTime()) / 60000);
        }
      }
      return {
        stopId,
        stopName: dm.itdStop?.name ?? line?.['@_dest'] ?? '',
        line: line?.['@_number'] ?? line?.number ?? '',
        mode,
        direction: line?.['@_direction'] ?? line?.direction ?? '',
        plannedDeparture: planned ?? new Date().toISOString(),
        realtimeDeparture: realtime,
        delayMinutes: delay,
        journeyId: line?.['@_journeyId'] ?? line?.journeyId,
        platform: dep?.itdStop?.platformName?.['#text'] ?? dep?.platform,
        endpoint: this.endpoint.key,
      };
    });
  }

  /** Verbindungssuche via XML_TRIP_REQUEST2 */
  async getJourney(fromId: string, toId: string, date: Date = new Date()): Promise<EfaJourney[]> {
    const { date: d, time: t } = formatEfaDateTime(date);
    const data = await this.request('XML_TRIP_REQUEST2', {
      name_origin: fromId,
      name_destination: toId,
      type_origin: 'stop',
      type_destination: 'stop',
      itdDate: d,
      itdTime: t,
      useRealtime: 1,
      coordOutputFormat: 'WGS84',
    });
    const tr = data?.itdRequest?.itdTripRequest;
    if (!tr) return [];
    const trips = toArray<any>(tr.itdRouteList?.itdRoute);
    return trips.map((trip: any): EfaJourney => {
      const legs = toArray<any>(trip?.itdPartialRouteList?.itdPartialRoute);
      const mappedLegs: EfaLeg[] = legs.map((leg: any) => {
        const line = leg?.itdMeansOfTransport;
        const mode = this.normalizeMode(line?.['@_mot'] ?? line?.mot);
        const dep = this.buildIso(leg?.itdPoint?.[0]?.itdDateTime?.itdDate, leg?.itdPoint?.[0]?.itdDateTime?.itdTime);
        const arr = this.buildIso(leg?.itdPoint?.[1]?.itdDateTime?.itdDate, leg?.itdPoint?.[1]?.itdDateTime?.itdTime);
        let dur = 0;
        if (dep && arr) dur = Math.round((new Date(arr).getTime() - new Date(dep).getTime()) / 60000);
        return {
          mode,
          line: line?.['@_number'] ?? line?.number,
          direction: line?.['@_direction'] ?? line?.direction,
          originName: leg?.itdPoint?.[0]?.name ?? '',
          destinationName: leg?.itdPoint?.[1]?.name ?? '',
          originPlannedDeparture: dep,
          destinationPlannedArrival: arr,
          durationMinutes: dur,
          changeCount: Number(leg?.['@_changes'] ?? 0) || 0,
        };
      });
      const firstDep = mappedLegs[0]?.originPlannedDeparture;
      const lastArr = mappedLegs[mappedLegs.length - 1]?.destinationPlannedArrival;
      const totalDur = firstDep && lastArr
        ? Math.round((new Date(lastArr).getTime() - new Date(firstDep).getTime()) / 60000)
        : 0;
      return {
        durationMinutes: totalDur,
        legs: mappedLegs,
        changes: Number(trip?.['@_changes'] ?? mappedLegs.length - 1) || 0,
        plannedDeparture: firstDep ?? new Date().toISOString(),
        plannedArrival: lastArr ?? new Date().toISOString(),
        endpoint: this.endpoint.key,
      };
    });
  }

  private normalizeMode(mot: string | number | undefined): string {
    switch (String(mot)) {
      case '0': return 'train';
      case '1': return 'metro';
      case '2': return 'subway';
      case '3': return 'tram';
      case '4': return 'bus';
      case '5': return 'ferry';
      case '6': return 'cablecar';
      case '7': return 'other';
      case '8': return 'other';
      case '9': return 'taxi';
      case '10': return 'shuttle';
      default:
        if (typeof mot === 'string') {
          const m = mot.toLowerCase();
          if (m.includes('bus')) return 'bus';
          if (m.includes('tram')) return 'tram';
          if (m.includes('rail')) return 'train';
          if (m.includes('subway') || m.includes('u-bahn')) return 'subway';
          if (m.includes('ferry')) return 'ferry';
          return m;
        }
        return 'other';
    }
  }

  private buildIso(dateObj: any, timeObj: any): string | undefined {
    const y = dateObj?.['@_year'] ?? dateObj?.year;
    const mo = dateObj?.['@_month'] ?? dateObj?.month;
    const d = dateObj?.['@_day'] ?? dateObj?.day;
    const h = timeObj?.['@_hour'] ?? timeObj?.hour;
    const mi = timeObj?.['@_minute'] ?? timeObj?.minute;
    if (y == null || mo == null || d == null || h == null || mi == null) return undefined;
    const iso = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
    return Number.isNaN(iso.getTime()) ? undefined : iso.toISOString();
  }
}

// ---------------------------------------------------------------------------
// EfaService – Singleton mit automatischer Endpunkt-Wahl + Fallback-Kette
// ---------------------------------------------------------------------------

export class EfaService {
  private readonly clients: Map<string, EfaClient> = new Map();
  private readonly timeoutMs: number;

  constructor(timeoutMs: number = EFA_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs;
    for (const ep of Object.values(EFA_ENDPOINTS)) {
      this.clients.set(ep.key, new EfaClient(ep, this.timeoutMs));
    }
  }

  /** Wählt die nächsten Endpunkte basierend auf Lat/Lng (aufsteigend nach Distanz). */
  private nearestEndpoints(lat: number, lng: number, exclude: Set<string> = new Set()): EfaEndpoint[] {
    return Object.values(EFA_ENDPOINTS)
      .filter(ep => !exclude.has(ep.key))
      .map(ep => ({ ep, dist: haversineMeters(lat, lng, ep.center[0], ep.center[1]) }))
      .sort((a, b) => a.dist - b.dist)
      .map(x => x.ep);
  }

  /** Findet eine Haltestelle – probiert den nächsten Verbund, dann Nachbarn (Fallback). */
  async findStop(queryStr: string, limit = 10, lat?: number, lng?: number): Promise<EfaStop[]> {
    const ordered: EfaEndpoint[] = lat != null && lng != null
      ? this.nearestEndpoints(lat, lng)
      : Object.values(EFA_ENDPOINTS);

    for (const ep of ordered) {
      try {
        const results = await this.clients.get(ep.key)!.findStop(queryStr, limit);
        if (results.length > 0) return results;
      } catch (error) {
        logger.warn(`EFA[${ep.key}] findStop Exception: ${error}`);
      }
    }
    logger.warn(`EFA: Keine Haltestelle fuer "${queryStr}" in einem Verbund gefunden`);
    return [];
  }

  /** Liefert Abfahrten an einer bekannten Haltestelle (endpunkt-spezifisch). */
  async getDepartures(stopId: string, limit = 10, endpoint?: string): Promise<EfaDeparture[]> {
    const key = endpoint && this.clients.has(endpoint) ? endpoint : this.guessEndpointFromStopId(stopId);
    const client = key ? this.clients.get(key) : undefined;
    if (!client) {
      logger.warn(`EFA: Kein gueltiger Endpunkt fuer Stop ${stopId} (endpoint=${endpoint ?? 'auto'})`);
      return [];
    }
    try {
      return await client.getDepartures(stopId, limit);
    } catch (error) {
      logger.warn(`EFA[${key}] getDepartures Exception: ${error}`);
      return [];
    }
  }

  /** Verbindungssuche – nutzt denselben Verbund fuer Start und Ziel. */
  async getJourney(fromId: string, toId: string, endpoint?: string): Promise<EfaJourney[]> {
    const key = endpoint && this.clients.has(endpoint) ? endpoint : this.guessEndpointFromStopId(fromId);
    const client = key ? this.clients.get(key) : undefined;
    if (!client) {
      logger.warn(`EFA: Kein gueltiger Endpunkt fuer Journey von ${fromId} (endpoint=${endpoint ?? 'auto'})`);
      return [];
    }
    try {
      const journeys = await client.getJourney(fromId, toId);
      if (journeys.length > 0) return journeys;
      // Fallback: falls der Verbund keine Verbindung findet, probiere Nachbarverbund
      if (!endpoint) {
        const neighbors = Object.values(EFA_ENDPOINTS).filter(ep => ep.key !== key).slice(0, 5);
        for (const ep of neighbors) {
          try {
            const alt = await this.clients.get(ep.key)!.getJourney(fromId, toId);
            if (alt.length > 0) return alt;
          } catch { /* weiter */ }
        }
      }
      return [];
    } catch (error) {
      logger.warn(`EFA[${key}] getJourney Exception: ${error}`);
      return [];
    }
  }

  private guessEndpointFromStopId(_stopId: string): string | undefined {
    // Stop-IDs kommen nun vom finalrewind.org-Proxy; ein zuverlaessiger
    // IFOPT-Prefix-Match ist hier nicht moeglich. Daher kein automatisches
    // Mapping -> es wird ein expliziter `endpoint`-Parameter erwartet (bzw.
    // bei findStop wird automatisch der naechste Verbund probiert).
    return undefined;
  }
}

export const efaService = new EfaService();
