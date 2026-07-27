/**
 * migrate-status.ts — Schema-Drift-Check
 *
 * Vergleicht das aktuelle PostgreSQL-Schema (information_schema) gegen
 * src/backend/src/database/schema.sql und meldet:
 *   - missing tables (in schema.sql definiert, aber nicht in DB)
 *   - missing columns (Spalte in Tabelle fehlt)
 *   - extra tables (in DB, aber nicht in schema.sql — meist Cache-Strukturen)
 *
 * Aufruf:
 *   cd src/backend && npm run migrate:status
 *
 * Exit codes:
 *   0 = schema ist synchron (kein Drift)
 *   1 = schema-Drift erkannt — `npm run migrate:dev` ausführen
 *   2 = script error (schema.sql fehlt, DB nicht erreichbar, etc.)
 *
 * Use case: vor jedem Deploy verifizieren, dass Production-DB auf dem
 * erwarteten Stand ist. Schneller als `psql diff` und testbar gemockt.
 *
 * KEIN Mock/Simulation (per User-Regel AGENTS.md:143): live DB-Queries
 * gegen information_schema, kein Fake-Output.
 */

import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { errorMessage } from '../utils/error';

const SCHEMA_RELATIVE_PATH = path.join('..', 'database', 'schema.sql');

// Postgres reserved words die wir beim Parsing ignorieren müssen
const SQL_RESERVED_WORDS = new Set([
  'if', 'not', 'exists', 'table', 'index', 'unique', 'primary', 'key',
  'foreign', 'references', 'on', 'cascade', 'restrict', 'set', 'default',
  'null', 'true', 'false', 'check', 'constraint', 'using', 'with',
  'create', 'alter', 'drop', 'add', 'column', 'rename', 'to',
  'and', 'or', 'as', 'like', 'ilike', 'in', 'between', 'is',
]);

/**
 * Tabellen die als LEGITIMATISCH EXTRA erlaubt sind (Cache-Layer-Strukturen
 * die wir nicht in schema.sql dokumentieren weil sie transiente Daten
 * halten). Wenn schema.sql erweitert wird, muss diese Liste gepflegt werden.
 */
export const ALLOWED_EXTRA_TABLES: ReadonlySet<string> = new Set<string>([
  // Stand 2026-07-27: keine Cache-Tabellen aktiv.
  // Reserved für zukünftige Overpass-Cache, GTFS-Cache, etc.
]);

// =============================================================================
// Pure Functions (testable ohne pg/db)
// =============================================================================

export function resolveSchemaPath(): string {
  return path.join(__dirname, SCHEMA_RELATIVE_PATH);
}

export interface SchemaSnapshot {
  tables: Map<string, ReadonlySet<string>>;
  /** Rohes SQL (für Debug-Output) */
  rawSchema: string;
}

/**
 * Extrahiert den Body zwischen CREATE TABLE ( und ) auf gleicher Verschachtelungstiefe.
 */
function extractTableBody(sql: string, openParenIdx: number): string {
  // depth startet bei 1 — wir sind bereits INNERHALB der oeffnenden Klammer.
  // depth zaehlt nur noch verschachtelte Klammern (CHECK(...) etc.).
  let depth = 1;
  let i = openParenIdx;
  while (i < sql.length) {
    const c = sql[i];
    if (c === '(') {
      depth++;
    } else if (c === ')') {
      depth--;
      if (depth === 0) {
        return sql.substring(openParenIdx, i);
      }
    }
    i++;
  }
  // Kein Match gefunden — leerer Body
  return '';
}

/**
 * Erkennt Spalten-Namen aus dem CREATE TABLE-Body. Skippt Constraint-/Index-
 * Deklarationen (CONSTRAINT, PRIMARY KEY, FOREIGN KEY, UNIQUE, INDEX, ...).
 */
function parseColumnNamesFromBody(body: string): Set<string> {
  const columns = new Set<string>();
  // Zeilen oder Komma-getrennte Statements
  const tokens = body.split(/[,\n]/);
  for (const raw of tokens) {
    const token = raw.trim();
    if (!token) continue;
    // Body-level Constraints überspringen
    if (/^(CONSTRAINT|UNIQUE|PRIMARY\s+KEY|FOREIGN\s+KEY|KEY|INDEX|CHECK)\b/i.test(
      token,
    )) {
      continue;
    }
    // Erstes Word = Spaltenname
    const match = /^["'`]?(\w+)["'`]?/.exec(token);
    if (
      match &&
      !SQL_RESERVED_WORDS.has(match[1].toLowerCase())
    ) {
      columns.add(match[1].toLowerCase());
    }
  }
  return columns;
}

/**
 * Parst `schema.sql` und liefert erwartetes Schema als Snapshot.
 * Erkennt CREATE TABLE [IF NOT EXISTS] <name> (...) Statements.
 */
export function parseExpectedSchema(sql: string): SchemaSnapshot {
  const tables = new Map<string, ReadonlySet<string>>();
  // Regex: "CREATE TABLE [IF NOT EXISTS] <name>"
  const tablePattern =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?(\w+)["'`]?/gi;

  let match: RegExpExecArray | null;
  while ((match = tablePattern.exec(sql)) !== null) {
    const tableName = match[1].toLowerCase();
    if (SQL_RESERVED_WORDS.has(tableName)) continue;

    // Body extrahieren — die erste ( nach match.index + match[0].length
    const bodyOpenIdx = tablePattern.lastIndex - match[0].length;
    // Suche die erste ( nach diesem Index
    const parenIdx = sql.indexOf('(', bodyOpenIdx + match[0].length);
    if (parenIdx === -1) continue;

    const body = extractTableBody(sql, parenIdx + 1);
    const columns = parseColumnNamesFromBody(body);
    tables.set(tableName, columns);
  }

  return { tables, rawSchema: sql };
}

/**
 * Query'd das aktuelle Schema aus der laufenden DB (mockable in Tests).
 */
export async function queryCurrentSchema(
  poolOverride: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> } = pool,
): Promise<SchemaSnapshot> {
  const tablesResult = await poolOverride.query(
    "SELECT table_name FROM information_schema.tables " +
      "WHERE table_schema = 'public' ORDER BY table_name",
  );
  const tables = new Map<string, ReadonlySet<string>>();
  for (const row of tablesResult.rows) {
    const tableName = (row as { table_name: string }).table_name.toLowerCase();
    const columnsResult = await poolOverride.query(
      "SELECT column_name FROM information_schema.columns " +
        "WHERE table_schema = 'public' AND table_name = $1 " +
        "ORDER BY ordinal_position",
      [tableName],
    );
    const columns = new Set<string>();
    for (const colRow of columnsResult.rows) {
      columns.add(
        (colRow as { column_name: string }).column_name.toLowerCase(),
      );
    }
    tables.set(tableName, columns);
  }
  return { tables, rawSchema: '' };
}

// =============================================================================
// Drift-Report
// =============================================================================

export interface DriftReport {
  status: 'ok' | 'drift';
  missingTables: string[];
  missingColumns: { table: string; column: string }[];
  extraTables: string[];
  checkedAt: string;
  expectedTableCount: number;
  actualTableCount: number;
}

/**
 * Vergleicht zwei Schemata. Cache-Tabellen in ALLOWED_EXTRA_TABLES werden
 * nicht als Drift gemeldet (intended asymmetry between schema.sql + DB).
 */
export function computeDrift(
  expected: SchemaSnapshot,
  actual: SchemaSnapshot,
): DriftReport {
  const missingTables: string[] = [];
  const missingColumns: { table: string; column: string }[] = [];

  for (const [table, columns] of expected.tables) {
    if (!actual.tables.has(table)) {
      missingTables.push(table);
      continue;
    }
    const actualCols = actual.tables.get(table);
    if (!actualCols) continue;
    for (const col of columns) {
      if (!actualCols.has(col)) {
        missingColumns.push({ table, column: col });
      }
    }
  }

  const extraTables: string[] = [];
  for (const table of actual.tables.keys()) {
    if (!expected.tables.has(table) && !ALLOWED_EXTRA_TABLES.has(table)) {
      extraTables.push(table);
    }
  }

  const status: DriftReport['status'] =
    missingTables.length === 0 && missingColumns.length === 0 &&
    extraTables.length === 0
      ? 'ok'
      : 'drift';

  return {
    status,
    missingTables: missingTables.sort(),
    missingColumns: missingColumns.sort((a, b) =>
      a.table.localeCompare(b.table) || a.column.localeCompare(b.column),
    ),
    extraTables: extraTables.sort(),
    checkedAt: new Date().toISOString(),
    expectedTableCount: expected.tables.size,
    actualTableCount: actual.tables.size,
  };
}

/**
 * Human-readable Format des Drift-Reports.
 */
export function formatReport(report: DriftReport): string {
  if (report.status === 'ok') {
    return [
      'migrate-status: schema is in sync',
      '   checked_at: ' + report.checkedAt,
      '   tables: ' + report.expectedTableCount + ' expected, ' +
        report.actualTableCount + ' actual',
      '   drift: none',
    ].join('\n');
  }

  const lines: string[] = [
    'migrate-status: SCHEMA DRIFT DETECTED',
    '   checked_at: ' + report.checkedAt,
    '   tables: ' + report.expectedTableCount + ' expected, ' +
      report.actualTableCount + ' actual',
    '',
  ];

  if (report.missingTables.length > 0) {
    lines.push('   missing_tables (' + report.missingTables.length + '):');
    for (const t of report.missingTables) {
      lines.push('     - ' + t);
    }
    lines.push('');
  }
  if (report.missingColumns.length > 0) {
    lines.push(
      '   missing_columns (' + report.missingColumns.length + '):',
    );
    for (const c of report.missingColumns) {
      lines.push('     - ' + c.table + '.' + c.column);
    }
    lines.push('');
  }
  if (report.extraTables.length > 0) {
    lines.push('   extra_tables (' + report.extraTables.length + '):');
    for (const t of report.extraTables) {
      lines.push('     - ' + t);
    }
    lines.push('');
  }
  lines.push(
    '   action: run `npm run migrate:dev` to apply pending schema.sql',
  );
  return lines.join('\n');
}

// =============================================================================
// Main entry (CLI)
// =============================================================================

export type RunResult =
  | { kind: 'ok'; report: DriftReport }
  | { kind: 'drift'; report: DriftReport }
  | { kind: 'script_error'; reason: string };

/**
 * Hauptfunktion: liest schema.sql, fragt DB-Schema ab, vergleicht.
 * Formatiert Output und schreibt auf console. Liefert RunResult für Tests.
 */
export async function run(
  options: {
    /** Override-Möglichkeit für den Pool (Tests) */
    poolOverride?: {
      query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
      end?: () => Promise<void>;
    };
    /** Override für fs.existsSync (Tests) */
    existsSync?: (path: string) => boolean;
    /** Override für fs.readFileSync (Tests) */
    readFileSync?: (path: string, encoding: string) => string;
    /** Output-Stream (default: process.stdout.write) */
    output?: (text: string) => void;
  } = {},
): Promise<RunResult> {
  const checkExists = options.existsSync ?? fs.existsSync;
  const readFile = options.readFileSync ??
    ((p: string, enc: string) => fs.readFileSync(p, enc as BufferEncoding));
  const dbPool = options.poolOverride ?? pool;
  const writeOutput = options.output ?? ((t: string) => {
    // eslint-disable-next-line no-console
    console.log(t);
  });

  const schemaPath = resolveSchemaPath();
  logger.info('Starting schema-drift check', { schemaPath });

  if (!checkExists(schemaPath)) {
    const msg = 'schema.sql not found at ' + schemaPath;
    logger.error(msg);
    writeOutput('migrate-status: ERROR — ' + msg);
    return { kind: 'script_error', reason: 'schema_not_found' };
  }

  let sql: string;
  try {
    sql = readFile(schemaPath, 'utf8');
  } catch (e: unknown) {
    const msg = 'Failed to read schema.sql: ' + errorMessage(e);
    logger.error(msg);
    writeOutput('migrate-status: ERROR — ' + msg);
    return { kind: 'script_error', reason: 'schema_unreadable' };
  }

  const expected = parseExpectedSchema(sql);

  let actual: SchemaSnapshot;
  try {
    actual = await queryCurrentSchema(dbPool);
  } catch (e: unknown) {
    const msg = 'Failed to query current schema: ' + errorMessage(e);
    logger.error(msg);
    writeOutput('migrate-status: ERROR — ' + msg);
    try {
      if (dbPool.end) await dbPool.end();
    } catch {
      // ignore — wir wollen nur den Script-Error propagieren
    }
    return { kind: 'script_error', reason: 'db_unreachable' };
  }

  const report = computeDrift(expected, actual);
  writeOutput(formatReport(report));

  try {
    if (dbPool.end) await dbPool.end();
  } catch {
    // ignore — wir wollen nur den Drift-Status propagieren
  }

  return report.status === 'ok'
    ? { kind: 'ok', report }
    : { kind: 'drift', report };
}

// Nur automatisch ausführen wenn als Script direkt aufgerufen (nicht beim Import)
if (require.main === module) {
  void run().then((result) => {
    if (result.kind === 'ok') {
      process.exit(0);
    } else if (result.kind === 'drift') {
      process.exit(1);
    } else {
      process.exit(2);
    }
  });
}
