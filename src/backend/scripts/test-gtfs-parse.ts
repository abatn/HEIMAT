/**
 * test-gtfs-parse.ts
 * ------------------
 * Verifiziert die Insert-/Chunking-Logik aus import-gtfs-local.ts OHNE echte DB
 * und OHNE Download. Mock-Daten werden durch importAll() gejagt; ein Mock-Insert
 * zählt die erzeugten SQL-Statements und Parameter.
 *
 * Aufruf: npx ts-node scripts/test-gtfs-parse.ts
 */

import { importAll, parseCsv } from './import-gtfs-local';

interface InsertCall { sql: string; params: any[]; }

async function run(): Promise<void> {
  const calls: InsertCall[] = [];
  let totalRows = 0;

  // Mock-Insert: zählt Aufrufe + simuliert rowCount = Anzahl Werte / Spaltenzahl.
  const insert = async (sql: string, params: any[]): Promise<number> => {
    calls.push({ sql, params });
    // Anzahl betroffener Zeilen schätzen: Spalten pro Tabelle aus SQL ableiten.
    const cols = sql.includes('gtfs_stop_times') ? 5
      : sql.includes('gtfs_calendar') ? 10
      : sql.includes('gtfs_routes') ? 6
      : 5;
    const rows = params.length / cols;
    totalRows += rows;
    return rows;
  };

  // Mock-Daten bauen (mehr als ein Batch, um Chunking zu testen).
  const base = (n: number) => Array.from({ length: n }, (_, i) => i);

  const stops = base(1200).map(i => ({ stop_id: `S${i}`, name: `Stop ${i}`, latitude: 50 + i * 0.0001, longitude: 8 + i * 0.0001, zone_id: 'Z1' }));
  const routes = base(600).map(i => ({ route_id: `R${i}`, short_name: `${i}`, long_name: `Line ${i}`, route_type: 3, route_color: '#123456', route_text_color: '#FFFFFF' }));
  const trips = base(700).map(i => ({ trip_id: `T${i}`, route_id: `R${i % 600}`, headsign: `Dest ${i}`, direction_id: 0, service_id: 'SVC1' }));
  const stopTimes = base(2500).map(i => ({ trip_id: `T${i % 700}`, stop_id: `S${i % 1200}`, arrival_time: '08:00:00', departure_time: '08:00:05', stop_sequence: i }));
  const calendar = base(3).map(i => ({ service_id: `SVC${i}`, monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false, start_date: '20240101', end_date: '20241231' }));

  const result = await importAll(
    { query: async () => ({ rowCount: 0 }) },
    { stops, routes, trips, stopTimes, calendar },
    insert,
  );

  console.log('Ergebnis:', result);
  console.log(`Insert-Statements gesamt: ${calls.length}`);
  console.log(`Simulierte Zeilen gesamt: ${totalRows}`);

  // Chunking-Assertions
  const stopTimeBatches = calls.filter(c => c.sql.includes('gtfs_stop_times')).length;
  const routeBatches = calls.filter(c => c.sql.includes('gtfs_routes')).length;
  const maxStopTimeParams = Math.max(...calls.filter(c => c.sql.includes('gtfs_stop_times')).map(c => c.params.length));

  console.log(`StopTime-Batches (erwartet 3 bei 2500/1000): ${stopTimeBatches}`);
  console.log(`Route-Batches (erwartet 2 bei 600/500): ${routeBatches}`);
  console.log(`Max. StopTime-Params/Batch (<=5000): ${maxStopTimeParams}`);

  if (stopTimeBatches !== 3) throw new Error(`Falsche StopTime-Batch-Anzahl: ${stopTimeBatches}`);
  if (routeBatches !== 2) throw new Error(`Falsche Route-Batch-Anzahl: ${routeBatches}`);
  if (maxStopTimeParams > 5000) throw new Error(`Zu viele Params pro Batch: ${maxStopTimeParams}`);
  if (result.stops !== 1200 || result.stopTimes !== 2500) throw new Error('Zeilenzähler stimmen nicht.');

  // parseCsv Smoke-Test
  const parsed = parseCsv('a,b\n1,2\n3,4\n');
  if (parsed.length !== 2 || parsed[0].a !== '1') throw new Error('parseCsv liefert unerwartetes Ergebnis.');

  console.log('\n✅ Mock-Parse/Insert-Test erfolgreich.');
}

run().catch(err => {
  console.error('❌ Test fehlgeschlagen:', err);
  process.exit(1);
});
