import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

const DB_REST_TIMEOUT_MS = 10000;
const CACHE_TTL_DEPARTURES = 300; // 5 minutes
const CACHE_TTL_JOURNEYS = 900;   // 15 minutes
const CACHE_TTL_LOCATIONS = 3600; // 1 hour

// ---------------------------------------------------------------------------
// Types (mapped from db-rest / hafas-client format)
// ---------------------------------------------------------------------------

export interface DbRestStop {
  type: string;
  id: string;
  name: string;
  location?: {
    type: string;
    id: string;
    latitude: number;
    longitude: number;
  };
  products?: Record<string, boolean>;
  station?: {
    type: string;
    id: string;
    name: string;
  };
}

export interface DbRestDeparture {
  tripId?: string;
  direction?: string;
  line?: {
    type: string;
    id: string;
    name: string;
    product?: string;
    mode?: string;
    operator?: { type: string; id: string; name: string };
  };
  departure?: string;
  plannedDeparture?: string;
  delay?: number | null;
  departurePlatform?: string;
  plannedDeparturePlatform?: string;
  remarks?: any[];
  origin?: DbRestStop;
  destination?: DbRestStop;
}

export interface DbRestLeg {
  tripId?: string;
  direction?: string;
  line?: {
    type: string;
    id: string;
    name: string;
    product?: string;
    mode?: string;
  };
  origin: DbRestStop;
  destination: DbRestStop;
  departure?: string;
  plannedDeparture?: string;
  departureDelay?: number | null;
  arrival?: string;
  plannedArrival?: string;
  arrivalDelay?: number | null;
  departurePlatform?: string;
  arrivalPlatform?: string;
  walking?: boolean;
  distance?: number;
  duration?: number;
}

export interface DbRestJourney {
  type: string;
  legs: DbRestLeg[];
  price?: { amount?: number; currency?: string; hint?: string };
  refreshToken?: string;
}

// Normalized types for HEIMAT (same as EFA types for compatibility)

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
// Simple in-memory cache (fallback when Redis is not available)
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
// db-rest Service
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

export class DbRestService {
  private client: AxiosInstance;
  private redisUrl?: string;

  constructor(baseUrl?: string, redisUrl?: string) {
    const url = baseUrl || process.env.DB_REST_URL || 'http://localhost:3001';
    this.redisUrl = redisUrl || process.env.REDIS_URL;
    this.client = axios.create({
      baseURL: url,
      timeout: DB_REST_TIMEOUT_MS,
      headers: { 'Accept': 'application/json', 'Accept-Charset': 'utf-8' },
    });
    logger.info(`db-rest Service initialisiert: ${url}`);
  }

  // ---- Search stops by name ----
  async searchStops(query: string, limit = 5): Promise<NormalizedStop[]> {
    const cacheKey = `loc:${query}:${limit}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await this.client.get('/locations', {
        params: { query, poi: false, addresses: false, results: limit },
      });

      const stops: NormalizedStop[] = (data || [])
        .filter((item: any) => item.type === 'stop' || item.type === 'station')
        .map((item: any) => ({
          id: item.id,
          name: item.name,
          latitude: item.location?.latitude || 0,
          longitude: item.location?.longitude || 0,
        }));

      cacheSet(cacheKey, stops, CACHE_TTL_LOCATIONS);
      return stops;
    } catch (err: any) {
      logger.warn(`db-rest searchStops fehlgeschlagen: ${err.message}`);
      return [];
    }
  }

  // ---- Get departures at a stop ----
  async getDepartures(stopId: string, duration = 10): Promise<NormalizedDeparture[]> {
    const cacheKey = `dep:${stopId}:${duration}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await this.client.get(`/stops/${encodeURIComponent(stopId)}/departures`, {
        params: { duration, results: 50 },
      });

      const deps: NormalizedDeparture[] = (data?.departures || []).map((d: DbRestDeparture) => ({
        stopId,
        stopName: d.origin?.name || '',
        line: d.line?.name || '',
        mode: d.line?.product || d.line?.mode || '',
        direction: d.direction || d.destination?.name || '',
        plannedDeparture: d.plannedDeparture || d.departure || '',
        realtimeDeparture: d.departure,
        delayMinutes: d.delay ?? 0,
        journeyId: d.tripId,
        platform: d.departurePlatform,
      }));

      cacheSet(cacheKey, deps, CACHE_TTL_DEPARTURES);
      return deps;
    } catch (err: any) {
      logger.warn(`db-rest getDepartures fehlgeschlagen: ${err.message}`);
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
      const params: Record<string, any> = {
        from: fromId,
        to: toId,
        results: 3,
        stopovers: false,
        language: 'de',
      };
      if (departure) params.departure = departure.toISOString();

      const { data } = await this.client.get('/journeys', { params });

      const journeys: NormalizedJourney[] = (data?.journeys || []).map((j: DbRestJourney) => {
        const legs = (j.legs || [])
          .filter((l) => !l.walking || (l.distance && l.distance > 200))
          .map((l) => ({
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

        const totalMin = legs.reduce((sum, l) => sum + l.durationMinutes, 0);
        const changes = Math.max(0, legs.filter((l) => l.mode !== 'walk').length - 1);

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
      logger.warn(`db-rest getJourneys fehlgeschlagen: ${err.message}`);
      return [];
    }
  }

  // ---- Health check ----
  async healthCheck(): Promise<{ status: string; url: string }> {
    try {
      const { status } = await this.client.get('/');
      return { status: status === 200 ? 'ok' : 'error', url: this.client.defaults.baseURL || '' };
    } catch (err: any) {
      return { status: `error: ${err.message}`, url: this.client.defaults.baseURL || '' };
    }
  }
}

// Singleton
export const dbRestService = new DbRestService();
