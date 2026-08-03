import axios, { AxiosError } from 'axios';
import { externalServices } from '../config/externalServices';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface ParkingSpot {
  id: string;
  osm_type: 'node' | 'way' | 'relation';
  name: string;
  operator?: string;
  parking_type?: string;       // surface, underground, multi-storey, etc.
  access?: string;             // public, private, customers
  fee?: string;                // yes, no
  capacity?: number;
  surface?: string;            // asphalt, paved, gravel, etc.
  lit?: string;                // yes, no
  latitude: number;
  longitude: number;
  opening_hours?: string;
  attribution: 'OpenStreetMap';
}

interface OverpassElement {
  id: number;
  type: 'node' | 'way' | 'relation';
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface CacheEntry {
  data: ParkingSpot[];
  expires: number;
}

export class ParkingService {
  private readonly userAgent = externalServices.userAgent;
  private readonly overpassMirrors = externalServices.overpassMirrors;

  private cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs = 24 * 60 * 60 * 1000; // 24 Stunden
  private readonly maxCacheEntries = 100;

  private mapElement(element: OverpassElement): ParkingSpot | null {
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    const tags = element.tags || {};

    // Name: use name, oder fallback auf addr:street + addr:housenumber
    const name = tags.name
      || (tags['addr:street'] ? `${tags['addr:street']}${tags['addr:housenumber'] ? ' ' + tags['addr:housenumber'] : ''}` : null);
    if (lat == null || lng == null || !name) return null;

    const capacityStr = tags.capacity;
    const capacityParsed = capacityStr ? parseInt(capacityStr, 10) : NaN;
    const capacity = !isNaN(capacityParsed) && capacityParsed > 0 ? capacityParsed : undefined;

    return {
      id: `${element.type}/${element.id}`,
      osm_type: element.type,
      name,
      operator: tags.operator,
      parking_type: tags.parking,
      access: tags.access,
      fee: tags.fee,
      capacity,
      surface: tags.surface,
      lit: tags.lit,
      latitude: lat,
      longitude: lng,
      opening_hours: tags.opening_hours,
      attribution: 'OpenStreetMap',
    };
  }

  private async fetchFromOverpass(lat: number, lng: number, radiusMeters: number): Promise<OverpassElement[]> {
    const q = `[out:json][timeout:25];(` +
      `node["amenity"="parking"](around:${radiusMeters},${lat},${lng});` +
      `way["amenity"="parking"](around:${radiusMeters},${lat},${lng});` +
      `relation["amenity"="parking"](around:${radiusMeters},${lat},${lng});` +
      `);out body center 50;`;

    const MAX_RETRIES_PER_MIRROR = 2;
    let lastError: unknown;

    for (const mirror of this.overpassMirrors) {
      for (let attempt = 1; attempt <= MAX_RETRIES_PER_MIRROR; attempt++) {
        try {
          const response = await axios.post(mirror, `data=${encodeURIComponent(q)}`, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': this.userAgent,
            },
            timeout: 25000,
          });
          const elements = (response.data?.elements ?? []) as OverpassElement[];
          if (elements.length > 0) return elements;
          if (attempt < MAX_RETRIES_PER_MIRROR) {
            const delayMs = attempt * 1000;
            logger.warn(`Parking Overpass ${mirror} leere Antwort (Attempt ${attempt}/${MAX_RETRIES_PER_MIRROR}), Retry in ${delayMs}ms`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
          }
          logger.warn(`Parking Overpass ${mirror} nach ${MAX_RETRIES_PER_MIRROR} Versuchen noch leer`);
        } catch (e) {
          lastError = e;
          const axiosError = e as AxiosError;
          const status = axiosError.response?.status;
          if (attempt < MAX_RETRIES_PER_MIRROR) {
            const delayMs = attempt * 1000;
            logger.warn(`Parking Overpass ${mirror} Fehler (status ${status ?? 'timeout'}), Retry ${attempt}/${MAX_RETRIES_PER_MIRROR} in ${delayMs}ms`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
          }
          logger.warn(`Parking Overpass ${mirror} fehlgeschlagen (status ${status ?? 'timeout'}) nach ${MAX_RETRIES_PER_MIRROR} Versuchen`);
        }
      }
    }
    throw lastError ?? new AppError('Alle Overpass-Mirrors fuer Parking fehlgeschlagen', 503);
  }

  private cacheKey(lat: number, lng: number, radiusKm: number): string {
    return `${lat.toFixed(3)}|${lng.toFixed(3)}|${radiusKm}`;
  }

  private getCached(key: string): ParkingSpot[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCached(key: string, data: ParkingSpot[]): void {
    if (this.cache.size >= this.maxCacheEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, expires: Date.now() + this.cacheTtlMs });
  }

  async getNearbySpots(lat: number, lng: number, radiusKm: number = 2): Promise<ParkingSpot[]> {
    const radiusMeters = Math.min(Math.max(radiusKm, 0.5) * 1000, 20000); // 0.5..20 km

    const key = this.cacheKey(lat, lng, radiusKm);
    const cached = this.getCached(key);
    if (cached) return cached;

    try {
      const elements = await this.fetchFromOverpass(lat, lng, radiusMeters);
      const spots: ParkingSpot[] = [];
      const seen = new Set<string>();
      for (const el of elements) {
        const spot = this.mapElement(el);
        if (!spot) continue;
        const dedupeKey = `${spot.name}|${spot.latitude.toFixed(5)}|${spot.longitude.toFixed(5)}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        spots.push(spot);
      }
      this.setCached(key, spots);
      return spots.slice(0, 50);
    } catch (error) {
      logger.error(`Parking Overpass nicht erreichbar: ${error}`);
      throw new AppError('Parkplatz-Dienst nicht verfuegbar', 503);
    }
  }
}

export const parkingService = new ParkingService();
