import { query, queryOne } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import axios from 'axios';

interface Stop { id: string; osm_id?: number; name: string; latitude: number; longitude: number; stop_type: string; }
interface Connection { id: string; departure_stop: string; arrival_stop: string; departure_time: string; arrival_time: string; line: string; transport_type: string; }

interface OverpassElement {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

export class MobilityService {
  private readonly nominatimUrl = 'https://nominatim.openstreetmap.org';
  private readonly osrmUrl = 'https://router.project-osrm.org';
  private readonly userAgent = 'HEIMAT-App/1.0 (https://github.com/abatn/HEIMAT)';
  private readonly cacheTtlHours = 168; // 7 Tage

  private classifyStop(tags: Record<string, string> = {}): string {
    if (tags.railway === 'station' || tags.railway === 'halt') return 'train';
    if (tags.station === 'subway' || tags.subway === 'yes') return 'subway';
    if (tags.tram === 'yes' || tags.railway === 'tram_stop') return 'tram';
    if (tags.light_rail === 'yes' || tags.train === 'yes') return 'train';
    return 'bus';
  }

  private readonly overpassMirrors = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ];

  private async fetchFromOverpass(lat: number, lng: number, radiusMeters: number): Promise<OverpassElement[]> {
    const r = Math.min(radiusMeters, 10000);
    const q = `[out:json][timeout:25];(` +
      `node["public_transport"="platform"](around:${r},${lat},${lng});` +
      `node["highway"="bus_stop"](around:${r},${lat},${lng});` +
      `node["railway"="station"](around:${r},${lat},${lng});` +
      `node["railway"="tram_stop"](around:${r},${lat},${lng});` +
      `node["public_transport"="stop_position"](around:${r},${lat},${lng});` +
      `);out body 50;`;
    let lastError: unknown;
    for (const mirror of this.overpassMirrors) {
      try {
        const response = await axios.post(mirror, `data=${encodeURIComponent(q)}`, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': this.userAgent },
          timeout: 25000,
        });
        return (response.data?.elements ?? []) as OverpassElement[];
      } catch (e) {
        lastError = e;
        const status = (e as any)?.response?.status;
        logger.warn(`Overpass-Mirror ${mirror} fehlgeschlagen (status ${status ?? 'timeout'})`);
      }
    }
    throw lastError;
  }

  private schemaEnsured = false;

  private async ensureSchema(): Promise<void> {
    if (this.schemaEnsured) return;
    // Selbstheilende Migration: osm_id-Spalte + Unique-Index fuer Upsert-Cache
    await query(`ALTER TABLE stops ADD COLUMN IF NOT EXISTS osm_id BIGINT`);
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_stops_osm_id ON stops(osm_id)`);
    this.schemaEnsured = true;
  }

  private async cacheStops(elements: OverpassElement[]): Promise<void> {
    try {
      await this.ensureSchema();
    } catch (e) {
      logger.warn(`Schema-Sicherung (osm_id) fehlgeschlagen: ${e}`);
      return;
    }
    for (const el of elements) {
      const name = el.tags?.name;
      if (!name) continue;
      try {
        await query(
          `INSERT INTO stops (osm_id, name, latitude, longitude, stop_type, updated_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
           ON CONFLICT (osm_id) DO UPDATE
             SET name = EXCLUDED.name, latitude = EXCLUDED.latitude,
                 longitude = EXCLUDED.longitude, stop_type = EXCLUDED.stop_type,
                 updated_at = CURRENT_TIMESTAMP`,
          [el.id, name, el.lat, el.lon, this.classifyStop(el.tags)]
        );
      } catch (e) {
        logger.warn(`Stop-Cache fehlgeschlagen fuer osm_id ${el.id}: ${e}`);
      }
    }
  }

  private async getCachedStops(lat: number, lng: number, radiusMeters: number): Promise<Stop[]> {
    return query<Stop>(
      `SELECT id, osm_id, name, latitude, longitude, stop_type FROM stops
       WHERE updated_at > NOW() - INTERVAL '${this.cacheTtlHours} hours'
         AND (6371000 * acos(LEAST(1, cos(radians($2)) * cos(radians(latitude)) * cos(radians(longitude) - radians($1)) + sin(radians($2)) * sin(radians(latitude))))) < $3
       ORDER BY (6371000 * acos(LEAST(1, cos(radians($2)) * cos(radians(latitude)) * cos(radians(longitude) - radians($1)) + sin(radians($2)) * sin(radians(latitude)))))
       LIMIT 30`, [lng, lat, radiusMeters]);
  }

  async getNearbyStops(lat: number, lng: number, radiusMeters: number = 1000): Promise<Stop[]> {
    // 1. Frischer Cache-Treffer? -> direkt zurueck (Overpass-Rate-Limit schonen)
    try {
      const cached = await this.getCachedStops(lat, lng, radiusMeters);
      if (cached.length >= 3) return cached;
    } catch (e) {
      logger.warn(`Cache-Lookup fehlgeschlagen: ${e}`);
    }

    // 2. Echte Live-Daten von OpenStreetMap/Overpass
    try {
      const elements = await this.fetchFromOverpass(lat, lng, radiusMeters);
      const stops: Stop[] = elements
        .filter(el => el.tags?.name && el.lat != null && el.lon != null)
        .map(el => ({
          id: String(el.id),
          osm_id: el.id,
          name: el.tags!.name,
          latitude: el.lat,
          longitude: el.lon,
          stop_type: this.classifyStop(el.tags),
        }));
      // Duplikate nach Name+Koordinaten entfernen
      const seen = new Set<string>();
      const unique = stops.filter(s => {
        const key = `${s.name}|${s.latitude.toFixed(5)}|${s.longitude.toFixed(5)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      // Async cachen (nicht blockierend fuer die Antwort)
      this.cacheStops(elements).catch(e => logger.warn(`Cache-Write fehlgeschlagen: ${e}`));
      return unique.slice(0, 30);
    } catch (error) {
      logger.error(`Overpass nicht erreichbar, nutze Cache-Fallback: ${error}`);
      // 3. Fallback: veralteter Cache statt Fehler
      try {
        return await this.getCachedStops(lat, lng, radiusMeters * 2);
      } catch {
        throw new AppError('Haltestellendienst nicht verfuegbar', 503);
      }
    }
  }

  async getStopById(id: string): Promise<Stop> {
    const stop = /^\d+$/.test(id)
      ? await queryOne<Stop>('SELECT * FROM stops WHERE osm_id = $1', [Number(id)])
      : await queryOne<Stop>('SELECT * FROM stops WHERE id = $1', [id]);
    if (!stop) throw new AppError('Stop not found', 404);
    return stop;
  }

  async searchStops(query_text: string): Promise<Stop[]> {
    // Ortsname -> Koordinaten via Nominatim -> echte Stops im Umkreis via Overpass
    try {
      const geo = await this.geocodeAddress(query_text);
      if (geo.length > 0) {
        return this.getNearbyStops(geo[0].lat, geo[0].lng, 2000);
      }
    } catch (e) {
      logger.warn(`searchStops Geocoding fehlgeschlagen: ${e}`);
    }
    // Fallback: im Cache nach Namen suchen
    return query<Stop>(
      `SELECT id, osm_id, name, latitude, longitude, stop_type FROM stops
       WHERE name ILIKE $1 ORDER BY name LIMIT 20`, [`%${query_text}%`]);
  }

  async geocodeAddress(address: string): Promise<{ lat: number; lng: number; display_name: string }[]> {
    try {
      const response = await axios.get(`${this.nominatimUrl}/search`, {
        params: { q: address, format: 'json', limit: 5, countrycodes: 'de' },
        headers: { 'User-Agent': this.userAgent },
        timeout: 15000,
      });
      return response.data.map((item: any) => ({ lat: parseFloat(item.lat), lng: parseFloat(item.lon), display_name: item.display_name }));
    } catch (error) { throw new AppError('Geocoding failed', 500); }
  }

  async getRoute(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<any> {
    try {
      const response = await axios.get(`${this.osrmUrl}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}`, { params: { overview: 'full', geometries: 'geojson' }, timeout: 30000 });
      if (response.data.routes && response.data.routes.length > 0) return response.data.routes[0];
      throw new AppError('No route found', 404);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Routing service unavailable', 503);
    }
  }
}

export const mobilityService = new MobilityService();
