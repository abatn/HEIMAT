import axios from 'axios';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';
import { query, execute } from '../config/database';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

const GTFS_URL = 'https://download.gtfs.de/germany/nv_free/latest.zip';
const CACHE_DIR = path.join(__dirname, '../../.gtfs-cache');
const CACHE_FILE = path.join(CACHE_DIR, 'latest.zip');
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 Stunden

export interface GtfsStop { stop_id: string; name: string; latitude: number; longitude: number; zone_id: string; }
export interface GtfsRoute { route_id: string; short_name: string; long_name: string; route_type: number; route_color: string; route_text_color: string; }
export interface GtfsTrip { trip_id: string; route_id: string; headsign: string; direction_id: number; service_id: string; }
export interface GtfsStopTime { trip_id: string; stop_id: string; arrival_time: string; departure_time: string; stop_sequence: number; }
export interface GtfsCalendar { service_id: string; monday: boolean; tuesday: boolean; wednesday: boolean; thursday: boolean; friday: boolean; saturday: boolean; sunday: boolean; start_date: string; end_date: string; }
export interface GtfsDeparture { stop_name: string; route_short_name: string; route_long_name: string; route_type: number; route_color: string; headsign: string; departure_time: string; trip_id: string; }

function parseCsv(content: string): Record<string, string>[] {
  return parse(content, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true });
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0));
  return dp[m][n];
}

export class GtfsService {
  private loaded = false;
  private stopsCache: GtfsStop[] = [];
  private routesCache: GtfsRoute[] = [];
  private tripsCache: GtfsTrip[] = [];
  private stopTimesCache: GtfsStopTime[] = [];
  private calendarCache: GtfsCalendar[] = [];

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    await this.loadFromDb();
    if (this.stopsCache.length === 0) {
      logger.warn('GTFS: Keine Daten in DB — Feed-Import über /api/admin/import-gtfs auslösen');
      this.loaded = true;
      return;
    }
    this.loaded = true;
    logger.info(`GTFS geladen: ${this.stopsCache.length} Stops, ${this.routesCache.length} Routes, ${this.tripsCache.length} Trips`);
  }

  async downloadAndParse(): Promise<void> {
    try {
      if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

      const shouldDownload = !fs.existsSync(CACHE_FILE) ||
        (Date.now() - fs.statSync(CACHE_FILE).mtimeMs) > CACHE_MAX_AGE_MS;

      if (shouldDownload) {
        logger.info(`GTFS: Lade Feed herunter von ${GTFS_URL}...`);
        const response = await axios.get(GTFS_URL, { responseType: 'arraybuffer', timeout: 300000 });
        fs.writeFileSync(CACHE_FILE, Buffer.from(response.data));
        logger.info(`GTFS: Download abgeschlossen (${(response.data.byteLength / 1024 / 1024).toFixed(1)} MB)`);
      } else {
        logger.info('GTFS: Nutze gecachten Feed');
      }

      const zip = new AdmZip(CACHE_FILE);
      const entries = zip.getEntries();
      const getFile = (name: string): string => {
        const entry = entries.find(e => e.entryName.endsWith(name));
        return entry ? entry.getData().toString('utf-8') : '';
      };

      // stops.txt
      const stopsRaw = parseCsv(getFile('stops.txt'));
      this.stopsCache = stopsRaw.map(r => ({
        stop_id: r.stop_id || '',
        name: r.stop_name || '',
        latitude: parseFloat(r.stop_lat) || 0,
        longitude: parseFloat(r.stop_lon) || 0,
        zone_id: r.zone_id || '',
      })).filter(s => s.name && s.latitude && s.longitude);

      // routes.txt
      const routesRaw = parseCsv(getFile('routes.txt'));
      this.routesCache = routesRaw.map(r => ({
        route_id: r.route_id || '',
        short_name: r.route_short_name || '',
        long_name: r.route_long_name || '',
        route_type: parseInt(r.route_type) || 3,
        route_color: r.route_color ? `#${r.route_color}` : '#6B7280',
        route_text_color: r.route_text_color ? `#${r.route_text_color}` : '#FFFFFF',
      }));

      // trips.txt
      const tripsRaw = parseCsv(getFile('trips.txt'));
      this.tripsCache = tripsRaw.map(r => ({
        trip_id: r.trip_id || '',
        route_id: r.route_id || '',
        headsign: r.trip_headsign || '',
        direction_id: parseInt(r.direction_id) || 0,
        service_id: r.service_id || '',
      }));

      // stop_times.txt
      const stopTimesRaw = parseCsv(getFile('stop_times.txt'));
      this.stopTimesCache = stopTimesRaw.map(r => ({
        trip_id: r.trip_id || '',
        stop_id: r.stop_id || '',
        arrival_time: r.arrival_time || '',
        departure_time: r.departure_time || '',
        stop_sequence: parseInt(r.stop_sequence) || 0,
      }));

      // calendar.txt
      const calRaw = parseCsv(getFile('calendar.txt'));
      this.calendarCache = calRaw.map(r => ({
        service_id: r.service_id || '',
        monday: r.monday === '1',
        tuesday: r.tuesday === '1',
        wednesday: r.wednesday === '1',
        thursday: r.thursday === '1',
        friday: r.friday === '1',
        saturday: r.saturday === '1',
        sunday: r.sunday === '1',
        start_date: r.start_date || '',
        end_date: r.end_date || '',
      }));

      logger.info(`GTFS: Parse abgeschlossen — ${this.stopsCache.length} Stops, ${this.routesCache.length} Routes, ${this.tripsCache.length} Trips, ${this.stopTimesCache.length} StopTimes`);
    } catch (error) {
      logger.error(`GTFS: Download/Parse fehlgeschlagen: ${error}`);
      throw error;
    }
  }

  async importToDatabase(): Promise<{ stops: number; routes: number; trips: number; stopTimes: number; calendar: number }> {
    const result = await this.importToDb();
    return {
      stops: this.stopsCache.length,
      routes: this.routesCache.length,
      trips: this.tripsCache.length,
      stopTimes: this.stopTimesCache.length,
      calendar: this.calendarCache.length,
    };
  }

  private async importToDb(): Promise<void> {
    const chunk = <T>(arr: T[], size: number): T[][] => {
      const result: T[][] = [];
      for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
      return result;
    };

    // Stops
    for (const batch of chunk(this.stopsCache, 500)) {
      const values = batch.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(',');
      const params = batch.flatMap(s => [s.stop_id, s.name, s.latitude, s.longitude, s.zone_id]);
      await execute(`INSERT INTO gtfs_stops (stop_id, name, latitude, longitude, zone_id) VALUES ${values} ON CONFLICT (stop_id) DO UPDATE SET name=EXCLUDED.name, latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude`, params);
    }

    // Routes
    for (const batch of chunk(this.routesCache, 500)) {
      const values = batch.map((_, i) => `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`).join(',');
      const params = batch.flatMap(r => [r.route_id, r.short_name, r.long_name, r.route_type, r.route_color, r.route_text_color]);
      await execute(`INSERT INTO gtfs_routes (route_id, short_name, long_name, route_type, route_color, route_text_color) VALUES ${values} ON CONFLICT (route_id) DO UPDATE SET short_name=EXCLUDED.short_name, long_name=EXCLUDED.long_name`, params);
    }

    // Trips
    for (const batch of chunk(this.tripsCache, 500)) {
      const values = batch.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(',');
      const params = batch.flatMap(t => [t.trip_id, t.route_id, t.headsign, t.direction_id, t.service_id]);
      await execute(`INSERT INTO gtfs_trips (trip_id, route_id, headsign, direction_id, service_id) VALUES ${values} ON CONFLICT (trip_id) DO NOTHING`, params);
    }

    // Stop Times (in großen Batches wegen Millions von Einträgen)
    for (const batch of chunk(this.stopTimesCache, 1000)) {
      const values = batch.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(',');
      const params = batch.flatMap(st => [st.trip_id, st.stop_id, st.arrival_time, st.departure_time, st.stop_sequence]);
      await execute(`INSERT INTO gtfs_stop_times (trip_id, stop_id, arrival_time, departure_time, stop_sequence) VALUES ${values}`, params);
    }

    // Calendar
    for (const batch of chunk(this.calendarCache, 500)) {
      const values = batch.map((_, i) => {
        const b = i * 10;
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}, $${b + 10})`;
      }).join(',');
      const params = batch.flatMap(c => [c.service_id, c.monday, c.tuesday, c.wednesday, c.thursday, c.friday, c.saturday, c.sunday, c.start_date, c.end_date]);
      await execute(`INSERT INTO gtfs_calendar (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date) VALUES ${values} ON CONFLICT (service_id) DO NOTHING`, params);
    }

    logger.info('GTFS: DB-Import abgeschlossen');
  }

  private async loadFromDb(): Promise<void> {
    try {
      this.stopsCache = await query<GtfsStop>('SELECT stop_id, name, latitude, longitude, zone_id FROM gtfs_stops LIMIT 100000');
      this.routesCache = await query<GtfsRoute>('SELECT route_id, short_name, long_name, route_type, route_color, route_text_color FROM gtfs_routes');
      this.tripsCache = await query<GtfsTrip>('SELECT trip_id, route_id, headsign, direction_id, service_id FROM gtfs_trips LIMIT 500000');
      this.stopTimesCache = await query<GtfsStopTime>('SELECT trip_id, stop_id, arrival_time, departure_time, stop_sequence FROM gtfs_stop_times LIMIT 2000000');
      this.calendarCache = await query<GtfsCalendar>('SELECT service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date FROM gtfs_calendar');
    } catch (e) {
      logger.warn(`GTFS: DB-Laden fehlgeschlagen: ${e}`);
    }
  }

  // Nächste Abfahrten an einer Haltestelle
  async getDepartures(stopName: string, limit: number = 10): Promise<GtfsDeparture[]> {
    await this.ensureLoaded();
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

    // Stops nach Name finden
    const matchedStops = this.stopsCache.filter(s =>
      s.name.toLowerCase().includes(stopName.toLowerCase())
    );
    if (matchedStops.length === 0) return [];

    const stopIds = new Set(matchedStops.map(s => s.stop_id));
    const departures: GtfsDeparture[] = [];

    for (const st of this.stopTimesCache) {
      if (!stopIds.has(st.stop_id)) continue;
      if (!st.departure_time || st.departure_time < hhmm) continue;

      const trip = this.tripsCache.find(t => t.trip_id === st.trip_id);
      if (!trip) continue;
      const route = this.routesCache.find(r => r.route_id === trip.route_id);
      if (!route) continue;

      departures.push({
        stop_name: matchedStops[0].name,
        route_short_name: route.short_name,
        route_long_name: route.long_name,
        route_type: route.route_type,
        route_color: route.route_color,
        headsign: trip.headsign,
        departure_time: st.departure_time,
        trip_id: st.trip_id,
      });

      if (departures.length >= limit) break;
    }

    return departures.sort((a, b) => a.departure_time.localeCompare(b.departure_time));
  }

  // Stop-Matching: GTFS ↔ Overpass
  matchStops(overpassLat: number, overpassLng: number, overpassName: string): { stop: GtfsStop; score: number } | null {
    let bestMatch: { stop: GtfsStop; score: number } | null = null;

    for (const gtfsStop of this.stopsCache) {
      const dist = haversineMeters(overpassLat, overpassLng, gtfsStop.latitude, gtfsStop.longitude);
      if (dist > 200) continue; // max 200m

      const nameScore = 1 - levenshtein(overpassName.toLowerCase(), gtfsStop.name.toLowerCase()) / Math.max(overpassName.length, gtfsStop.name.length);
      const distScore = Math.max(0, 1 - dist / 200);
      const score = nameScore * 0.6 + distScore * 0.4;

      if (score > 0.5 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { stop: gtfsStop, score };
      }
    }

    return bestMatch;
  }

  getStops(): GtfsStop[] { return this.stopsCache; }
  getRoutes(): GtfsRoute[] { return this.routesCache; }
  getTrips(): GtfsTrip[] { return this.tripsCache; }
  getStopTimes(): GtfsStopTime[] { return this.stopTimesCache; }
  isLoaded(): boolean { return this.loaded; }
}

export const gtfsService = new GtfsService();
