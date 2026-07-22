import { logger } from '../utils/logger';

const CACHE_TTL_DEPARTURES = 300;
const CACHE_TTL_JOURNEYS = 900;
const CACHE_TTL_LOCATIONS = 3600;

const TRANSITOUS_BASE = 'https://api.transitous.org/api/v1';
const USER_AGENT = 'HEIMAT/2.0 (github.com/abatn/HEIMAT)';

export interface NormalizedStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface NormalizedDeparture {
  stopId: string;
  stopName: string;
  line: string;
  mode: string;
  direction: string;
  plannedDeparture: string;
  realtimeDeparture?: string;
  delayMinutes: number;
  journeyId?: string;
  platform?: string;
}

export interface NormalizedLeg {
  mode: string;
  line?: string;
  direction?: string;
  originName: string;
  destinationName: string;
  originPlannedDeparture?: string;
  destinationPlannedArrival?: string;
  durationMinutes: number;
  changeCount: number;
  routeColor?: string;
}

export interface NormalizedJourney {
  durationMinutes: number;
  legs: NormalizedLeg[];
  changes: number;
  plannedDeparture: string;
  plannedArrival: string;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry { data: any; expires: number; }
const memoryCache = new Map<string, CacheEntry>();

function cacheGet(key: string): any | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { memoryCache.delete(key); return null; }
  return entry.data;
}

function cacheSet(key: string, data: any, ttlSeconds: number): void {
  memoryCache.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
}

// ---------------------------------------------------------------------------
// Transitous API helpers
// ---------------------------------------------------------------------------

const MODE_MAP: Record<string, string> = {
  METRO: 'suburban',
  SUBURBAN: 'suburban',
  SUBWAY: 'subway',
  TRAM: 'tram',
  BUS: 'bus',
  REGIONAL_TRAIN: 'regional',
  REGIONAL_RAIL: 'regional',
  EXPRESS_TRAIN: 'express',
  HIGHSPEED_RAIL: 'express',
  LONG_DISTANCE: 'express',
  NIGHT_RAIL: 'regional',
  COACH: 'bus',
  FERRY: 'ferry',
  CABLE_CAR: 'cable',
  AERIAL_LIFT: 'cable',
  AIRPLANE: 'airplane',
  TAXI: 'taxi',
  CAR: 'taxi',
  WALK: 'walk',
  BIKE: 'bike',
  OTHER: 'suburban',
};

function mapMode(motisMode: string): string {
  return MODE_MAP[motisMode] || motisMode.toLowerCase();
}

const PRODUCT_COLORS: Record<string, string> = {
  bus: '#1B5E20',
  tram: '#E65100',
  subway: '#1565C0',
  suburban: '#2E7D32',
  regional: '#6A1B9A',
  express: '#B71C1C',
  ferry: '#00838F',
  taxi: '#F9A825',
  cable: '#4E342E',
  airplane: '#37474F',
  walk: '#9E9E9E',
  bike: '#4CAF50',
};

function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hour12: false });
}

async function transitousGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const url = `${TRANSITOUS_BASE}${path}?${qs}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`transitous ${path}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class DbVendoService {

  // ---- Search stops by name (uses plan with trivial route to discover stops) ----
  async searchStops(query: string, limit = 5): Promise<NormalizedStop[]> {
    const cacheKey = `loc:${query}:${limit}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    try {
      // Transitous has no text-search endpoint; use map/stops for Berlin area
      // For now return empty — the frontend uses coords-based search
      logger.warn(`transitous searchStops("${query}"): no text search available`);
      return [];
    } catch (err: any) {
      logger.warn(`transitous searchStops fehlgeschlagen: ${err.message}`);
      return [];
    }
  }

  // ---- Search stops by coordinates (nearby) using map/stops ----
  async searchStopsByCoords(lat: number, lng: number, limit = 5): Promise<NormalizedStop[]> {
    const cacheKey = `nearby:${lat}:${lng}:${limit}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    try {
      const delta = 0.005; // ~500m bounding box
      const minLat = (lat - delta).toFixed(4);
      const minLng = (lng - delta).toFixed(4);
      const maxLat = (lat + delta).toFixed(4);
      const maxLng = (lng + delta).toFixed(4);

      const stops = await transitousGet<any[]>('/map/stops', {
        min: `${minLat},${minLng}`,
        max: `${maxLat},${maxLng}`,
      });

      const result: NormalizedStop[] = (stops || [])
        .slice(0, limit)
        .map((s: any) => ({
          id: s.stopId || '',
          name: s.name || '',
          latitude: s.lat || 0,
          longitude: s.lon || 0,
        }));

      cacheSet(cacheKey, result, CACHE_TTL_LOCATIONS);
      return result;
    } catch (err: any) {
      logger.warn(`transitous searchStopsByCoords fehlgeschlagen: ${err.message}`);
      return [];
    }
  }

  // ---- Get departures at a stop ----
  async getDepartures(stopId: string, duration = 10): Promise<NormalizedDeparture[]> {
    const cacheKey = `dep:${stopId}:${duration}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    try {
      const data = await transitousGet<any>('/stoptimes', {
        stopId,
        n: '30',
        language: 'de',
      });

      const deps: NormalizedDeparture[] = (data.stopTimes || []).map((st: any) => {
        const delaySec = (st.place?.arrival && st.place?.scheduledArrival)
          ? (new Date(st.place.arrival).getTime() - new Date(st.place.scheduledArrival).getTime()) / 1000
          : 0;

        return {
          stopId,
          stopName: st.place?.name || '',
          line: st.routeShortName || st.headsign || '',
          mode: mapMode(st.mode || ''),
          direction: st.headsign || '',
          plannedDeparture: formatTime(st.place?.scheduledDeparture || st.place?.departure || ''),
          realtimeDeparture: formatTime(st.place?.departure || ''),
          delayMinutes: Math.round(delaySec / 60),
          journeyId: st.tripId || '',
          platform: st.place?.track || undefined,
        };
      });

      cacheSet(cacheKey, deps, CACHE_TTL_DEPARTURES);
      return deps;
    } catch (err: any) {
      logger.warn(`transitous getDepartures fehlgeschlagen: ${err.message}`);
      return [];
    }
  }

  // ---- Journey planning (A → B) using coordinates ----
  async getJourneys(
    fromIdOrLat: string,
    toIdOrLng: string,
    departure?: Date,
    fromLat?: number,
    fromLng?: number,
    toLat?: number,
    toLng?: number,
  ): Promise<NormalizedJourney[]> {
    // Support both old (id-based) and new (coord-based) call signatures
    const fLat = fromLat ?? parseFloat(fromIdOrLat);
    const fLng = fromLng ?? 0;
    const tLat = toLat ?? parseFloat(toIdOrLng);
    const tLng = toLng ?? 0;

    if (isNaN(fLat) || isNaN(tLat)) {
      logger.warn('transitous getJourneys: invalid coordinates');
      return [];
    }

    const depStr = departure ? departure.toISOString() : new Date().toISOString();
    const cacheKey = `jrn:${fLat}:${fLng}:${tLat}:${tLng}:${depStr}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    try {
      const params: Record<string, string> = {
        fromPlace: `${fLat},${fLng}`,
        toPlace: `${tLat},${tLng}`,
        numItineraries: '3',
        language: 'de',
        time: depStr,
      };

      const data = await transitousGet<any>('/plan', params);

      const journeys: NormalizedJourney[] = (data.itineraries || []).map((itin: any) => {
          const legs: NormalizedLeg[] = (itin.legs || [])
          .filter((l: any) => l.mode !== 'WALK' || (l.distance && l.distance > 200))
          .map((l: any) => ({
            mode: mapMode(l.mode || ''),
            line: (l.routeShortName && l.routeShortName !== '?') ? l.routeShortName : l.headsign || undefined,
            direction: l.headsign || undefined,
            originName: l.from?.name || '',
            destinationName: l.to?.name || '',
            originPlannedDeparture: formatTime(l.scheduledStartTime || ''),
            destinationPlannedArrival: formatTime(l.scheduledEndTime || ''),
            durationMinutes: l.duration ? Math.round(l.duration / 60) : 0,
            changeCount: 0,
            routeColor: l.routeColor ? `#${l.routeColor}` : PRODUCT_COLORS[mapMode(l.mode || '')] || '#6B7280',
          }));

        const firstDep = itin.legs?.[0]?.scheduledStartTime || itin.legs?.[0]?.startTime || '';
        const lastArr = itin.legs?.[itin.legs.length - 1]?.scheduledEndTime || itin.legs?.[itin.legs.length - 1]?.endTime || '';
        const totalMin = legs.reduce((sum: number, l: any) => sum + l.durationMinutes, 0);
        const changes = Math.max(0, legs.filter((l: any) => l.mode !== 'walk').length - 1);

        return {
          durationMinutes: totalMin || (itin.duration ? Math.round(itin.duration / 60) : 0),
          legs,
          changes,
          plannedDeparture: formatTime(firstDep),
          plannedArrival: formatTime(lastArr),
        };
      });

      cacheSet(cacheKey, journeys, CACHE_TTL_JOURNEYS);
      return journeys;
    } catch (err: any) {
      logger.warn(`transitous getJourneys fehlgeschlagen: ${err.message}`);
      return [];
    }
  }

  // ---- Health check ----
  async healthCheck(): Promise<{ status: string; details: string }> {
    try {
      const data = await transitousGet<any>('/map/stops', {
        min: '52.515,13.395',
        max: '52.525,13.405',
      });
      const count = Array.isArray(data) ? data.length : 0;
      return { status: 'ok', details: `transitous.org OK, ${count} stops near Berlin Mitte` };
    } catch (err: any) {
      const detail = err.message || String(err);
      return { status: 'error', details: detail };
    }
  }
}

export const dbVendoService = new DbVendoService();
