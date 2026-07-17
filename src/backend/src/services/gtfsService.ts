import axios from 'axios';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse';
import { parse as parseSync } from 'csv-parse/sync';
import { Readable } from 'stream';
import { query, execute, pool } from '../config/database';
import { logger } from '../utils/logger';
import fs from 'fs';
import os from 'os';
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
  return parseSync(content, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true });
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

// Streaming-CSV-Parser von Datei (RAM-schonend bei >500MB Dateien)
function parseStream(filePath: string): AsyncGenerator<Record<string, string>> {
  const stream = fs.createReadStream(filePath);
  const parser = parse({ columns: true, skip_empty_lines: true, trim: true, relax_column_count: true }) as any;
  stream.pipe(parser);
  return (async function* () {
    for await (const record of parser) {
      yield record as Record<string, string>;
    }
  })();
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
    const res = await query<{ c: string }>('SELECT COUNT(*)::text AS c FROM gtfs_stops');
    const count = parseInt(res[0]?.c || '0', 10);
    if (count === 0) {
      logger.warn('GTFS: Keine Daten in DB — Feed-Import über /api/admin/import-gtfs auslösen');
    } else {
      logger.info(`GTFS: ${count} Stops in DB vorhanden`);
    }
    this.loaded = true;
  }

  // STREAMING-Import: Feed als Stream -> Temp-Datei -> pro GTFS-Datei streaming
  // parsen und direkt in die DB schreiben. Keine RAM-Caches (Render Free-Tier: 512MB).
  // Status wird in gtfs_import_status persistiert (pollbar via /api/admin/gtfs-status).
  async streamingImport(onProgress?: (msg: string) => void): Promise<void> {
    const log = onProgress || ((m: string) => logger.info(m));
    const setStatus = async (status: string, stage: string, message: string, progress = 0) => {
      await query(
        `INSERT INTO gtfs_import_status (status, stage, message, progress, updated_at) VALUES ($1,$2,$3,$4,NOW())`,
        [status, stage, message, progress]
      );
    };
    let importClient: any = null;
    try {
      await setStatus('running', 'download', 'Starte Download', 0);
      log('GTFS: Lade Feed (Stream)...');
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtfs-'));
      const zipPath = path.join(tmpDir, 'latest.zip');
      const writer = fs.createWriteStream(zipPath);
      const response = await axios.get(GTFS_URL, { responseType: 'stream', timeout: 600000 });
      let downloaded = 0;
      const total = parseInt((response.headers as any)['content-length'] || '0', 10);
      response.data.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        if (total > 0 && downloaded % (20 * 1024 * 1024) < chunk.length) {
          const pct = Math.round((downloaded / total) * 30);
          setStatus('running', 'download', `Download ${(downloaded / 1024 / 1024).toFixed(0)}/${(total / 1024 / 1024).toFixed(0)} MB`, pct).catch(() => {});
        }
      });
      await new Promise<void>((resolve, reject) => {
        (response.data as Readable).pipe(writer);
        writer.on('finish', () => resolve());
        writer.on('error', reject);
      });
      await setStatus('running', 'extract', `Download abgeschlossen (${(downloaded / 1024 / 1024).toFixed(0)} MB)`, 30);
      log(`GTFS: Download abgeschlossen -> ${zipPath}`);

      // yauzl: echtes Streaming — nur eine Datei gleichzeitig im RAM
      const yauzl = require('yauzl');
      const zipfile: any = await new Promise((resolve, reject) =>
        yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (err: any, zf: any) => err ? reject(err) : resolve(zf))
      );

      const BATCH = 1000;
      importClient = await pool.connect();
      const insertBatch = async (table: string, cols: string[], rows: any[][], conflict: string) => {
        if (rows.length === 0) return 0;
        const max = cols.length;
        const placeholders = rows.map((_, i) => {
          const start = i * max;
          return `(${cols.map((_, j) => `$${start + j + 1}`).join(', ')})`;
        }).join(',');
        const params = rows.flat();
        const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES ${placeholders} ${conflict}`;
        const r = await importClient.query(sql, params);
        return r.rowCount || 0;
      };

      // Aktiven Wochentag bestimmen (Heute: Systemzeit)
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const todayDay = dayNames[new Date().getDay()];
      log(`GTFS: Aktiver Wochentag = ${todayDay}`);

      const tablesCfg: Record<string, { table: string; cols: string[]; conflict: string }> = {
        'stops.txt': { table: 'gtfs_stops', cols: ['stop_id', 'name', 'latitude', 'longitude', 'zone_id'], conflict: 'ON CONFLICT (stop_id) DO UPDATE SET name=EXCLUDED.name, latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude' },
        'routes.txt': { table: 'gtfs_routes', cols: ['route_id', 'short_name', 'long_name', 'route_type', 'route_color', 'route_text_color'], conflict: 'ON CONFLICT (route_id) DO UPDATE SET short_name=EXCLUDED.short_name, long_name=EXCLUDED.long_name' },
        'trips.txt': { table: 'gtfs_trips', cols: ['trip_id', 'route_id', 'headsign', 'direction_id', 'service_id'], conflict: 'ON CONFLICT (trip_id) DO NOTHING' },
        'stop_times.txt': { table: 'gtfs_stop_times', cols: ['trip_id', 'stop_id', 'arrival_time', 'departure_time', 'stop_sequence'], conflict: 'ON CONFLICT (trip_id, stop_id, stop_sequence) DO NOTHING' },
        'calendar.txt': { table: 'gtfs_calendar', cols: ['service_id', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'start_date', 'end_date'], conflict: 'ON CONFLICT (service_id) DO NOTHING' },
      };
      const rowFor = (name: string, r: Record<string, string>): any[] | null => {
        switch (name) {
          case 'stops.txt': return (!r.stop_id || !r.stop_name || !r.stop_lat || !r.stop_lon) ? null : [r.stop_id, r.stop_name, parseFloat(r.stop_lat) || 0, parseFloat(r.stop_lon) || 0, r.zone_id || ''];
          case 'routes.txt': return !r.route_id ? null : [r.route_id, r.route_short_name || '', r.route_long_name || '', parseInt(r.route_type) || 3, r.route_color ? `#${r.route_color}` : '#6B7280', r.route_text_color ? `#${r.route_text_color}` : '#FFFFFF'];
          case 'trips.txt': return !r.trip_id ? null : [r.trip_id, r.route_id || '', r.trip_headsign || '', parseInt(r.direction_id) || 0, r.service_id || ''];
          case 'calendar.txt': { if (!r.service_id) return null; const b = (v: string) => v === '1' || v === 'true'; return [r.service_id, b(r.monday), b(r.tuesday), b(r.wednesday), b(r.thursday), b(r.friday), b(r.saturday), b(r.sunday), r.start_date || '', r.end_date || '']; }
          case 'stop_times.txt': return (!r.trip_id || !r.stop_id) ? null : [r.trip_id, r.stop_id, r.arrival_time || '', r.departure_time || '', parseInt(r.stop_sequence) || 0];
          default: return null;
        }
      };

      const activeServices = new Set<string>();
      const activeTrips = new Set<string>();
      let stage = '';

      await new Promise<void>((resolveAll, rejectAll) => {
        zipfile.on('entry', (entry: any) => {
          const name = entry.fileName.split('/').pop() || '';
          if (!['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt', 'calendar.txt'].includes(name) || entry.fileName.endsWith('/')) {
            zipfile.readEntry(); return;
          }
          if (stage !== name) { stage = name; setStatus('running', name.replace('.txt', ''), `Importiere ${name}`, 35).catch(() => {}); log(`GTFS: → ${name}`); }
          zipfile.openReadStream(entry, (err: any, rs: Readable) => {
            if (err) return rejectAll(err);
            const parser = parse({ columns: true, skip_empty_lines: true, trim: true, relax_column_count: true }) as any;
            rs.pipe(parser);
            let rows: any[][] = []; let total = 0; let n = 0;
            const flush = async () => {
              if (rows.length === 0) return;
              const batch = rows; rows = [];
              n += await insertBatch(tablesCfg[name].table, tablesCfg[name].cols, batch, tablesCfg[name].conflict);
              if (total % 1000000 < BATCH) log(`GTFS: ${total} ${name} verarbeitet`);
            };
            parser.on('data', async (rec: Record<string, string>) => {
              parser.pause(); // RAM kontrollieren: nicht schneller lesen als DB schreibt
              if (name === 'calendar.txt') {
                if (rec.service_id && (rec[todayDay] === '1' || rec[todayDay] === 'true')) activeServices.add(rec.service_id);
                const row = rowFor(name, rec); if (row) rows.push(row);
              } else if (name === 'trips.txt') {
                if (rec.trip_id && activeServices.has(rec.service_id || '')) activeTrips.add(rec.trip_id);
                const row = rowFor(name, rec); if (row) rows.push(row);
              } else if (name === 'stop_times.txt') {
                if (!rec.trip_id || !rec.stop_id) { parser.resume(); return; }
                if (!activeTrips.has(rec.trip_id)) { parser.resume(); return; } // NUR aktive Trips
                rows.push([rec.trip_id, rec.stop_id, rec.arrival_time || '', rec.departure_time || '', parseInt(rec.stop_sequence) || 0]);
              } else {
                const row = rowFor(name, rec); if (row) rows.push(row);
              }
              total++;
              if (rows.length >= BATCH) { await flush(); }
              parser.resume();
            });
            parser.on('end', async () => {
              await flush();
              log(`GTFS: ${n} ${name} importiert (${total} gelesen)`);
              zipfile.readEntry();
            });
            parser.on('error', rejectAll);
          });
        });
        zipfile.on('end', () => resolveAll());
        zipfile.on('error', rejectAll);
        zipfile.readEntry();
      });
      log(`GTFS: Aktive Services=${activeServices.size}, Aktive Trips=${activeTrips.size}`);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      if (importClient) importClient.release();
      await setStatus('done', 'complete', 'Import abgeschlossen', 100);
      log('GTFS: Import abgeschlossen');
    } catch (error: any) {
      logger.error(`GTFS: Import fehlgeschlagen: ${error?.message || error}`);
      if (importClient) importClient.release();
      await setStatus('failed', 'error', error?.message || String(error), 0).catch(() => {});
      throw error;
    }
  }

  async getImportStatus(): Promise<{ status: string; stage: string; message: string; progress: number; updated_at: string } | null> {
    const rows = await query<{ status: string; stage: string; message: string; progress: number; updated_at: string }>(
      `SELECT status, stage, message, progress, updated_at FROM gtfs_import_status ORDER BY id DESC LIMIT 1`
    );
    return rows[0] || null;
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

  // Nächste Abfahrten an einer Haltestelle (SQL-basiert, RAM-schonend)
  async getDepartures(stopName: string, limit: number = 10): Promise<GtfsDeparture[]> {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

    const sql = `
      SELECT s.name AS stop_name, r.short_name AS route_short_name, r.long_name AS route_long_name,
             r.route_type, r.route_color, t.headsign, st.departure_time, st.trip_id
      FROM gtfs_stop_times st
      JOIN gtfs_stops s ON s.stop_id = st.stop_id
      JOIN gtfs_trips t ON t.trip_id = st.trip_id
      JOIN gtfs_routes r ON r.route_id = t.route_id
      WHERE s.name ILIKE $1 AND st.departure_time >= $2
      ORDER BY st.departure_time ASC
      LIMIT $3
    `;
    const rows = await query<GtfsDeparture>(sql, [`%${stopName}%`, hhmm, limit]);
    return rows.map(r => ({
      stop_name: r.stop_name,
      route_short_name: r.route_short_name,
      route_long_name: r.route_long_name,
      route_type: r.route_type,
      route_color: r.route_color,
      headsign: r.headsign,
      departure_time: r.departure_time,
      trip_id: r.trip_id,
    }));
  }

  // Stop-Matching: GTFS ↔ Overpass (SQL-Bounding-Box + Client-Score)
  async matchStops(overpassLat: number, overpassLng: number, overpassName: string): Promise<{ stop: GtfsStop; score: number } | null> {
    const sql = `
      SELECT stop_id, name, latitude, longitude, zone_id
      FROM gtfs_stops
      WHERE latitude BETWEEN $1 - 0.05 AND $1 + 0.05
        AND longitude BETWEEN $2 - 0.05 AND $2 + 0.05
    `;
    const candidates = await query<GtfsStop>(sql, [overpassLat, overpassLng]);

    let bestMatch: { stop: GtfsStop; score: number } | null = null;
    const nameLower = overpassName.toLowerCase();
    for (const gtfsStop of candidates) {
      const dist = haversineMeters(overpassLat, overpassLng, gtfsStop.latitude, gtfsStop.longitude);
      if (dist > 200) continue;
      const nameScore = 1 - levenshtein(nameLower, gtfsStop.name.toLowerCase()) / Math.max(overpassName.length, gtfsStop.name.length);
      const distScore = Math.max(0, 1 - dist / 200);
      const score = nameScore * 0.6 + distScore * 0.4;
      if (score > 0.5 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { stop: gtfsStop, score };
      }
    }
    return bestMatch;
  }

  // DB-basierte Getter für RAPTOR (lädt nur relevante Daten per Bounding-Box)
  async getStopsInBox(lat: number, lng: number, delta = 0.1): Promise<GtfsStop[]> {
    return query<GtfsStop>(
      `SELECT stop_id, name, latitude, longitude, zone_id FROM gtfs_stops WHERE latitude BETWEEN $1 - $3 AND $1 + $3 AND longitude BETWEEN $2 - $3 AND $2 + $3`,
      [lat, lng, delta],
    );
  }
  async getRoutesByIds(ids: string[]): Promise<GtfsRoute[]> {
    if (ids.length === 0) return [];
    const params = ids.map((_, i) => `$${i + 1}`).join(',');
    return query<GtfsRoute>(`SELECT route_id, short_name, long_name, route_type, route_color, route_text_color FROM gtfs_routes WHERE route_id IN (${params})`, ids);
  }
  async getTripsByIds(ids: string[]): Promise<GtfsTrip[]> {
    if (ids.length === 0) return [];
    const params = ids.map((_, i) => `$${i + 1}`).join(',');
    return query<GtfsTrip>(`SELECT trip_id, route_id, headsign, direction_id, service_id FROM gtfs_trips WHERE trip_id IN (${params})`, ids);
  }
  async getStopTimesByTrips(ids: string[]): Promise<GtfsStopTime[]> {
    if (ids.length === 0) return [];
    const params = ids.map((_, i) => `$${i + 1}`).join(',');
    return query<GtfsStopTime>(`SELECT trip_id, stop_id, arrival_time, departure_time, stop_sequence FROM gtfs_stop_times WHERE trip_id IN (${params})`, ids);
  }
  async getStopTimesByStops(ids: string[]): Promise<GtfsStopTime[]> {
    if (ids.length === 0) return [];
    const params = ids.map((_, i) => `$${i + 1}`).join(',');
    return query<GtfsStopTime>(`SELECT trip_id, stop_id, arrival_time, departure_time, stop_sequence FROM gtfs_stop_times WHERE stop_id IN (${params})`, ids);
  }
  isLoaded(): boolean { return this.loaded; }

  async getCounts(): Promise<{ stops: number; routes: number; trips: number; stop_times: number }> {
    const c = async (t: string) => {
      const r = await query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM ${t}`);
      return parseInt(r[0]?.c || '0', 10);
    };
    return {
      stops: await c('gtfs_stops'),
      routes: await c('gtfs_routes'),
      trips: await c('gtfs_trips'),
      stop_times: await c('gtfs_stop_times'),
    };
  }
}

export const gtfsService = new GtfsService();
