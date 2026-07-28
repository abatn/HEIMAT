import axios, { AxiosError } from 'axios';
import { externalServices } from '../config/externalServices';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface ChargingSocket {
  type: string;
  count: number;
}

export interface Station {
  id: string;
  osm_type: 'node' | 'way' | 'relation';
  name: string;
  operator?: string;
  network?: string;
  latitude: number;
  longitude: number;
  capacity?: number;
  sockets: ChargingSocket[];
  fee?: string;
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
  data: Station[];
  expires: number;
}

export class EvChargingService {
  // Phase X.3a: 1:1 mirror-pattern aus mobilityService.ts.
  // Vorher 3x duplizierte overpassMirror-Liste + userAgent (mobilityX +
  // evCharging + weather) wird SINGLE-SOURCE via Config-Registry.
  private readonly userAgent = externalServices.userAgent;
  private readonly overpassMirrors = externalServices.overpassMirrors;

  private cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs = 24 * 60 * 60 * 1000; // 24 Stunden
  private readonly maxCacheEntries = 100;

  private extractSockets(tags: Record<string, string> = {}): ChargingSocket[] {
    const socketRegex = /^socket:(.+)$/;
    const sockets: ChargingSocket[] = [];
    for (const [key, value] of Object.entries(tags)) {
      const match = key.match(socketRegex);
      if (!match) continue;
      const type = match[1];
      const count = parseInt(value, 10);
      if (!isNaN(count) && count > 0) {
        sockets.push({ type, count });
      }
    }
    return sockets;
  }

  private mapElement(element: OverpassElement): Station | null {
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    const name = element.tags?.name;
    if (lat == null || lng == null || !name) return null;

    const tags = element.tags || {};
    const capacityStr = tags.capacity;
    const capacityParsed = capacityStr ? parseInt(capacityStr, 10) : NaN;
    const capacity = !isNaN(capacityParsed) && capacityParsed > 0 ? capacityParsed : undefined;

    return {
      id: `${element.type}/${element.id}`,
      osm_type: element.type,
      name,
      operator: tags.operator,
      network: tags.network,
      latitude: lat,
      longitude: lng,
      capacity,
      sockets: this.extractSockets(tags),
      fee: tags.fee,
      opening_hours: tags.opening_hours,
      attribution: 'OpenStreetMap',
    };
  }

  private async fetchFromOverpass(lat: number, lng: number, radiusMeters: number): Promise<OverpassElement[]> {
    const q = `[out:json][timeout:25];(` +
      `node["amenity"="charging_station"](around:${radiusMeters},${lat},${lng});` +
      `way["amenity"="charging_station"](around:${radiusMeters},${lat},${lng});` +
      `relation["amenity"="charging_station"](around:${radiusMeters},${lat},${lng});` +
      `);out body center 30;`;

    let lastError: unknown;
    for (const mirror of this.overpassMirrors) {
      try {
        const response = await axios.post(mirror, `data=${encodeURIComponent(q)}`, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': this.userAgent,
          },
          timeout: 25000,
        });
        return (response.data?.elements ?? []) as OverpassElement[];
      } catch (e) {
        lastError = e;
        const axiosError = e as AxiosError;
        const status = axiosError.response?.status;
        logger.warn(`EV-Charging Overpass-Mirror ${mirror} fehlgeschlagen (status ${status ?? 'timeout'})`);
      }
    }
    throw lastError;
  }

  private cacheKey(lat: number, lng: number, radiusKm: number): string {
    return `${lat.toFixed(3)}|${lng.toFixed(3)}|${radiusKm}`;
  }

  private getCached(key: string): Station[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCached(key: string, data: Station[]): void {
    if (this.cache.size >= this.maxCacheEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, expires: Date.now() + this.cacheTtlMs });
  }

  async getNearbyStations(lat: number, lng: number, radiusKm: number = 5): Promise<Station[]> {
    const radiusMeters = Math.min(Math.max(radiusKm, 1) * 1000, 50000); // 1..50 km

    // 1. Cache-Treffer? -> direkt zurueck
    const key = this.cacheKey(lat, lng, radiusKm);
    const cached = this.getCached(key);
    if (cached) return cached;

    // 2. Live-Daten von OSM Overpass
    try {
      const elements = await this.fetchFromOverpass(lat, lng, radiusMeters);
      const stations: Station[] = [];
      const seen = new Set<string>();
      for (const el of elements) {
        const station = this.mapElement(el);
        if (!station) continue;
        const dedupeKey = `${station.name}|${station.latitude.toFixed(5)}|${station.longitude.toFixed(5)}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        stations.push(station);
      }
      this.setCached(key, stations);
      return stations.slice(0, 30);
    } catch (error) {
      logger.error(`EV-Charging Overpass nicht erreichbar: ${error}`);
      throw new AppError('E-Ladestationen-Dienst nicht verfuegbar', 503);
    }
  }
}

export const evChargingService = new EvChargingService();