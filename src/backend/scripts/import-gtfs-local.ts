/**
 * import-gtfs-local.ts
 * --------------------
 * Lokaler GTFS-Import für HEIMAT 2.0.
 *
 * Problem: Der ~244MB nv_free GTFS-Feed kann nicht über das Render-Backend
 * (Free-Tier: 512MB RAM, Cold-Start, Request-Timeout) importiert werden.
 * Stattdessen: lokal herunterladen + STREAMING parsen und DIREKT via `pg`
 * in die Supabase-Postgres-DB schreiben.
 *
 * Wichtig: stop_times.txt ist >500MB groß. Wir dürfen sie NICHT als ganzen
 * String laden (ERR_STRING_TOO_LONG). Stattdessen parsen wir jede Datei
 * zeilenweise über einen Stream und inserten direkt in Batches.
 *
 * Aufruf:
 *   DATABASE_URL=postgresql://user:pass@host:5432/postgres \
 *     npx ts-node scripts/import-gtfs-local.ts
 *
 * Umgebungsvariablen:
 *   DATABASE_URL   (Pflicht) – vollständiger PostgreSQL-Connection-String
 *   GTFS_URL       (Optional) – Feed-URL, Default: nv_free latest.zip
 *
 * KEINE hardcoded Credentials — ausschließlich process.env.DATABASE_URL.
 */

import axios from 'axios';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse';
import { Pool } from 'pg';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as dns from 'dns';
import { URL } from 'url';

// Erzwingt IPv4: löst den Hostnamen aus der Connection-String via dns.lookup
// auf eine IPv4-Adresse auf (verhindert IPv6-ENETUNREACH in Umgebungen ohne IPv6).
async function resolveToIpv4(connectionString: string): Promise<string> {
  try {
    const u = new URL(connectionString);
    if (u.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) return connectionString; // schon IPv4
    const { address } = await dns.promises.lookup(u.hostname, { family: 4 });
    u.hostname = address;
    return u.toString();
  } catch {
    return connectionString;
  }
}

const GTFS_URL = process.env.GTFS_URL || 'https://download.gtfs.de/germany/nv_free/latest.zip';

const BATCH_STOP_TIMES = 2000;
const BATCH_DEFAULT = 1000;

type Row = Record<string, string>;

// Streaming-CSV-Parser: gibt jede Zeile als Objekt zurück (async iterator)
function parseStream(stream: Readable): AsyncGenerator<Row> {
  const parser = parse({ columns: true, skip_empty_lines: true, trim: true, relax_column_count: true });
  stream.pipe(parser);
  return (async function* () {
    for await (const record of parser) {
      yield record as Row;
    }
  })();
}

async function downloadZipBuffer(): Promise<Buffer> {
  console.log(`Lade GTFS-Feed herunter von ${GTFS_URL}...`);
  const response = await axios.get(GTFS_URL, { responseType: 'arraybuffer', timeout: 600000 });
  console.log(`Download abgeschlossen (${(response.data.byteLength / 1024 / 1024).toFixed(1)} MB)`);
  return Buffer.from(response.data);
}

// Entpackt das ZIP in ein temporäres Verzeichnis und gibt die Pfade zurück.
async function extractZip(buffer: Buffer): Promise<string> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gtfs-'));
  const zip = new AdmZip(buffer);
  zip.extractAllTo(tmpDir, true);
  console.log(`ZIP entpackt nach ${tmpDir}`);
  return tmpDir;
}

// Findet eine Datei im entpackten Verzeichnis (case-insensitive, endet mit name)
function fileStream(dir: string, fileName: string): Readable | null {
  const entries = fs.readdirSync(dir);
  const match = entries.find(e => e.toLowerCase().endsWith(fileName.toLowerCase()));
  if (!match) return null;
  return fs.createReadStream(path.join(dir, match));
}

async function importStops(pool: Pool, dir: string, log: (m: string) => void): Promise<number> {
  const stream = fileStream(dir, 'stops.txt');
  if (!stream) { log('stops.txt nicht gefunden'); return 0; }
  let batch: any[][] = [];
  let count = 0;
  for await (const r of parseStream(stream)) {
    if (!r.stop_id || !r.stop_name || !r.stop_lat || !r.stop_lon) continue;
    batch.push([
      r.stop_id, r.stop_name,
      parseFloat(r.stop_lat) || 0, parseFloat(r.stop_lon) || 0,
      r.zone_id || '',
    ]);
    if (batch.length >= BATCH_DEFAULT) {
      count += await insertStopBatch(pool, batch);
      batch = [];
    }
  }
  if (batch.length) count += await insertStopBatch(pool, batch);
  log(`Stops importiert: ${count}`);
  return count;
}

async function insertStopBatch(pool: Pool, batch: any[][]): Promise<number> {
  const values = batch.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(',');
  const params = batch.flat();
  const res = await pool.query(
    `INSERT INTO gtfs_stops (stop_id, name, latitude, longitude, zone_id) VALUES ${values} ON CONFLICT (stop_id) DO UPDATE SET name=EXCLUDED.name, latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, zone_id=EXCLUDED.zone_id`,
    params,
  );
  return res.rowCount || 0;
}

async function importRoutes(pool: Pool, dir: string, log: (m: string) => void): Promise<number> {
  const stream = fileStream(dir, 'routes.txt');
  if (!stream) { log('routes.txt nicht gefunden'); return 0; }
  let batch: any[][] = [];
  let count = 0;
  for await (const r of parseStream(stream)) {
    if (!r.route_id) continue;
    batch.push([
      r.route_id, r.route_short_name || '', r.route_long_name || '',
      parseInt(r.route_type) || 3,
      r.route_color ? `#${r.route_color}` : '#6B7280',
      r.route_text_color ? `#${r.route_text_color}` : '#FFFFFF',
    ]);
    if (batch.length >= BATCH_DEFAULT) {
      count += await insertRouteBatch(pool, batch);
      batch = [];
    }
  }
  if (batch.length) count += await insertRouteBatch(pool, batch);
  log(`Routes importiert: ${count}`);
  return count;
}

async function insertRouteBatch(pool: Pool, batch: any[][]): Promise<number> {
  const values = batch.map((_, i) => `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`).join(',');
  const params = batch.flat();
  const res = await pool.query(
    `INSERT INTO gtfs_routes (route_id, short_name, long_name, route_type, route_color, route_text_color) VALUES ${values} ON CONFLICT (route_id) DO UPDATE SET short_name=EXCLUDED.short_name, long_name=EXCLUDED.long_name`,
    params,
  );
  return res.rowCount || 0;
}

async function importTrips(pool: Pool, dir: string, log: (m: string) => void): Promise<number> {
  const stream = fileStream(dir, 'trips.txt');
  if (!stream) { log('trips.txt nicht gefunden'); return 0; }
  let batch: any[][] = [];
  let count = 0;
  for await (const r of parseStream(stream)) {
    if (!r.trip_id) continue;
    batch.push([
      r.trip_id, r.route_id || '', r.trip_headsign || '',
      parseInt(r.direction_id) || 0, r.service_id || '',
    ]);
    if (batch.length >= BATCH_DEFAULT) {
      count += await insertTripBatch(pool, batch);
      batch = [];
    }
  }
  if (batch.length) count += await insertTripBatch(pool, batch);
  log(`Trips importiert: ${count}`);
  return count;
}

async function insertTripBatch(pool: Pool, batch: any[][]): Promise<number> {
  const values = batch.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(',');
  const params = batch.flat();
  const res = await pool.query(
    `INSERT INTO gtfs_trips (trip_id, route_id, headsign, direction_id, service_id) VALUES ${values} ON CONFLICT (trip_id) DO NOTHING`,
    params,
  );
  return res.rowCount || 0;
}

async function importStopTimes(pool: Pool, dir: string, log: (m: string) => void): Promise<number> {
  const stream = fileStream(dir, 'stop_times.txt');
  if (!stream) { log('stop_times.txt nicht gefunden'); return 0; }
  let batch: any[][] = [];
  let count = 0;
  let total = 0;
  for await (const r of parseStream(stream)) {
    if (!r.trip_id || !r.stop_id) continue;
    batch.push([
      r.trip_id, r.stop_id,
      r.arrival_time || '', r.departure_time || '',
      parseInt(r.stop_sequence) || 0,
    ]);
    total++;
    if (batch.length >= BATCH_STOP_TIMES) {
      count += await insertStopTimeBatch(pool, batch);
      batch = [];
      if (total % 2000000 === 0) log(`  ...${total} StopTimes verarbeitet`);
    }
  }
  if (batch.length) count += await insertStopTimeBatch(pool, batch);
  log(`StopTimes importiert: ${count} (${total} gelesen)`);
  return count;
}

async function insertStopTimeBatch(pool: Pool, batch: any[][]): Promise<number> {
  const values = batch.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(',');
  const params = batch.flat();
  const res = await pool.query(
    `INSERT INTO gtfs_stop_times (trip_id, stop_id, arrival_time, departure_time, stop_sequence) VALUES ${values}`,
    params,
  );
  return res.rowCount || 0;
}

async function importCalendar(pool: Pool, dir: string, log: (m: string) => void): Promise<number> {
  const stream = fileStream(dir, 'calendar.txt');
  if (!stream) { log('calendar.txt nicht gefunden'); return 0; }
  let batch: any[][] = [];
  let count = 0;
  for await (const r of parseStream(stream)) {
    if (!r.service_id) continue;
    const b = (v: string) => v === '1' || v === 'true';
    batch.push([
      r.service_id, b(r.monday), b(r.tuesday), b(r.wednesday), b(r.thursday),
      b(r.friday), b(r.saturday), b(r.sunday), r.start_date || '', r.end_date || '',
    ]);
    if (batch.length >= BATCH_DEFAULT) {
      count += await insertCalendarBatch(pool, batch);
      batch = [];
    }
  }
  if (batch.length) count += await insertCalendarBatch(pool, batch);
  log(`Calendar importiert: ${count}`);
  return count;
}

async function insertCalendarBatch(pool: Pool, batch: any[][]): Promise<number> {
  const values = batch.map((_, i) => {
    const b = i * 10;
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}, $${b + 10})`;
  }).join(',');
  const params = batch.flat();
  const res = await pool.query(
    `INSERT INTO gtfs_calendar (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date) VALUES ${values} ON CONFLICT (service_id) DO NOTHING`,
    params,
  );
  return res.rowCount || 0;
}

async function importTransfers(pool: Pool, dir: string, log: (m: string) => void): Promise<number> {
  const stream = fileStream(dir, 'transfers.txt');
  if (!stream) { log('transfers.txt nicht gefunden (optional)'); return 0; }
  let batch: any[][] = [];
  let count = 0;
  for await (const r of parseStream(stream)) {
    if (!r.from_stop_id || !r.to_stop_id) continue;
    batch.push([
      r.from_stop_id, r.to_stop_id,
      parseInt(r.transfer_type) || 0,
      parseInt(r.min_transfer_time) || 0,
    ]);
    if (batch.length >= BATCH_DEFAULT) {
      count += await insertTransferBatch(pool, batch);
      batch = [];
    }
  }
  if (batch.length) count += await insertTransferBatch(pool, batch);
  log(`Transfers importiert: ${count}`);
  return count;
}

async function insertTransferBatch(pool: Pool, batch: any[][]): Promise<number> {
  const values = batch.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(',');
  const params = batch.flat();
  const res = await pool.query(
    `INSERT INTO gtfs_transfers (from_stop_id, to_stop_id, transfer_type, min_transfer_time) VALUES ${values} ON CONFLICT (from_stop_id, to_stop_id) DO UPDATE SET transfer_type=EXCLUDED.transfer_type, min_transfer_time=EXCLUDED.min_transfer_time`,
    params,
  );
  return res.rowCount || 0;
}

async function verify(pool: Pool, log: (m: string) => void): Promise<void> {
  const tables = ['gtfs_stops', 'gtfs_routes', 'gtfs_trips', 'gtfs_stop_times', 'gtfs_calendar', 'gtfs_transfers'];
  for (const t of tables) {
    const res = await pool.query(`SELECT count(*)::int AS c FROM ${t}`);
    log(`Verifikation ${t}: ${res.rows[0].c} Zeilen`);
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL ist nicht gesetzt. Aufruf: DATABASE_URL=postgresql://... npx ts-node scripts/import-gtfs-local.ts');
  }

  // IPv4 erzwingen: Hostname vorab via dns.lookup auflösen (umgebung hat kein IPv6-Routing)
  const resolvedUrl = await resolveToIpv4(databaseUrl);

  const buffer = await downloadZipBuffer();
  const dir = await extractZip(buffer);

  const pool = new Pool({ connectionString: resolvedUrl, max: 10, ssl: { rejectUnauthorized: false } });
  try {
    await importStops(pool, dir, console.log);
    await importRoutes(pool, dir, console.log);
    await importTrips(pool, dir, console.log);
    await importStopTimes(pool, dir, console.log);
    await importCalendar(pool, dir, console.log);
    await importTransfers(pool, dir, console.log);
    await verify(pool, console.log);
    console.log('GTFS-Import abgeschlossen.');
  } finally {
    await pool.end();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('GTFS-Import fehlgeschlagen:', err);
    process.exit(1);
  });
}

export { importStops, importRoutes, importTrips, importStopTimes, importCalendar, importTransfers };
