import { logger } from '../utils/logger';

const CACHE_TTL_DEPARTURES = 300;
const CACHE_TTL_JOURNEYS = 900;
const CACHE_TTL_LOCATIONS = 3600;

// Re-export normalized types (same shape as old dbRestService)
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
// In-memory cache
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
// Product colors
// ---------------------------------------------------------------------------

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
};

// ---------------------------------------------------------------------------
// db-vendo-client Service (ESM dynamic import from CommonJS)
// ---------------------------------------------------------------------------

let _client: any = null;

async function getClient(): Promise<any> {
  if (_client) return _client;
  try {
    const [{ createClient }, { profile }] = await Promise.all([
      import('db-vendo-client'),
      import('db-vendo-client/p/db/index.js'),
    ]);
    _client = createClient(profile, 'heimat-2.0-app');
    logger.info('db-vendo-client initialisiert (db profile)');
    return _client;
  } catch (err: any) {
    logger.error(`db-vendo-client Init fehlgeschlagen: ${err.message}`);
    throw err;
  }
}

export class DbVendoService {

  // ---- Search stops by name ----
  async searchStops(query: string, limit = 5): Promise<NormalizedStop[]> {
    const cacheKey = `loc:${query}:${limit}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    try {
      const client = await getClient();
      const results = await client.locations(query, {
        results: limit,
        stops: true,
        addresses: false,
        poi: false,
      });

      const stops: NormalizedStop[] = (results || [])
        .filter((item: any) => item.type === 'stop' || item.type === 'station')
        .map((item: any) => ({
          id: item.id,
          name: item.name || '',
          latitude: item.location?.latitude || 0,
          longitude: item.location?.longitude || 0,
        }));

      cacheSet(cacheKey, stops, CACHE_TTL_LOCATIONS);
      return stops;
    } catch (err: any) {
      logger.warn(`db-vendo searchStops fehlgeschlagen: ${err.message}`);
      return [];
    }
  }

  // ---- Search stops by coordinates (nearby) ----
  async searchStopsByCoords(lat: number, lng: number, limit = 5): Promise<NormalizedStop[]> {
    const cacheKey = `nearby:${lat}:${lng}:${limit}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    try {
      const client = await getClient();
      const results = await client.nearby({
        type: 'location',
        latitude: lat,
        longitude: lng,
      }, { results: limit, stops: true, poi: false });

      const stops: NormalizedStop[] = (results || [])
        .filter((item: any) => item.type === 'stop' || item.type === 'station')
        .map((item: any) => ({
          id: item.id,
          name: item.name || '',
          latitude: item.location?.latitude || lat,
          longitude: item.location?.longitude || lng,
        }));

      cacheSet(cacheKey, stops, CACHE_TTL_LOCATIONS);
      return stops;
    } catch (err: any) {
      logger.warn(`db-vendo searchStopsByCoords fehlgeschlagen: ${err.message}`);
      return [];
    }
  }

  // ---- Get departures at a stop ----
  async getDepartures(stopId: string, duration = 10): Promise<NormalizedDeparture[]> {
    const cacheKey = `dep:${stopId}:${duration}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    try {
      const client = await getClient();
      const results = await client.departures(stopId, {
        duration,
        results: 50,
      });

      const deps: NormalizedDeparture[] = (results || []).map((d: any) => ({
        stopId,
        stopName: d.stop?.name || d.origin?.name || '',
        line: d.line?.name || '',
        mode: d.line?.product || d.line?.mode || '',
        direction: d.direction || d.destination?.name || '',
        plannedDeparture: d.plannedWhen || d.when || '',
        realtimeDeparture: d.when,
        delayMinutes: d.delay ? Math.round(d.delay / 60) : 0,
        journeyId: d.tripId,
        platform: d.platform || d.plannedPlatform,
      }));

      cacheSet(cacheKey, deps, CACHE_TTL_DEPARTURES);
      return deps;
    } catch (err: any) {
      logger.warn(`db-vendo getDepartures fehlgeschlagen: ${err.message}`);
      return [];
    }
  }

  // ---- Journey planning (A → B) ----
  async getJourneys(fromId: string, toId: string, departure?: Date): Promise<NormalizedJourney[]> {
    const depStr = departure ? departure.toISOString() : 'now';
    const cacheKey = `jrn:${fromId}:${toId}:${depStr}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    try {
      const client = await getClient();
      const opts: any = {
        results: 3,
        stopovers: false,
        language: 'de',
      };
      if (departure) opts.departure = departure.toISOString();

      const data = await client.journeys(fromId, toId, opts);

      const journeys: NormalizedJourney[] = (data?.journeys || []).map((j: any) => {
        const legs = (j.legs || [])
          .filter((l: any) => !l.walking || (l.distance && l.distance > 200))
          .map((l: any) => ({
            mode: l.line?.product || l.line?.mode || (l.walking ? 'walk' : 'unknown'),
            line: l.line?.name,
            direction: l.direction,
            originName: l.origin?.name || '',
            destinationName: l.destination?.name || '',
            originPlannedDeparture: l.plannedDeparture,
            destinationPlannedArrival: l.plannedArrival,
            durationMinutes: l.duration ? Math.round(l.duration / 60) : 0,
            changeCount: 0,
            routeColor: PRODUCT_COLORS[l.line?.product || ''] || '#6B7280',
          }));

        const firstDep = j.legs?.[0]?.plannedDeparture || j.legs?.[0]?.departure || '';
        const lastArr = j.legs?.[j.legs.length - 1]?.plannedArrival || j.legs?.[j.legs.length - 1]?.arrival || '';
        const totalMin = legs.reduce((sum: number, l: any) => sum + l.durationMinutes, 0);
        const changes = Math.max(0, legs.filter((l: any) => l.mode !== 'walk').length - 1);

        return {
          durationMinutes: totalMin,
          legs,
          changes,
          plannedDeparture: firstDep,
          plannedArrival: lastArr,
        };
      });

      cacheSet(cacheKey, journeys, CACHE_TTL_JOURNEYS);
      return journeys;
    } catch (err: any) {
      logger.warn(`db-vendo getJourneys fehlgeschlagen: ${err.message}`);
      return [];
    }
  }

  // ---- Health check ----
  async healthCheck(): Promise<{ status: string; details: string }> {
    try {
      const client = await getClient();
      const r = await client.locations('Berlin Hbf', { results: 1, stops: true });
      return { status: 'ok', details: `db-vendo-client OK, Test: ${r[0]?.name || 'kein Ergebnis'}` };
    } catch (err: any) {
      return { status: 'error', details: err.message };
    }
  }
}

// Singleton
export const dbVendoService = new DbVendoService();
