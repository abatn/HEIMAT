/**
 * migrate-status.test.ts — Unit-Tests für den Schema-Drift-Check
 *
 * Testet die Funktionen von src/scripts/migrate-status.ts isoliert mit
 * gemocktem pg pool, fs und explizitem Output-Capture (kein console.log
 * ins Terminal). Die mock-basierte Coverage schliesst die Lücke, dass
 * migrate-status.ts als CLI-Script konzipiert ist und nur in der Render
 * Pre-Deploy-Phase oder lokal via `npm run migrate:status` läuft.
 *
 * Gemockte Module:
 *   - fs:     existsSync, readFileSync
 *   - ../config/database: pool.query, pool.end
 *
 * Getestete Pfade:
 *   ✅ parseExpectedSchema: single-table, multi-table, IF NOT EXISTS
 *   ✅ parseExpectedSchema: ignoriert CREATE INDEX, PRIMARY KEY, CONSTRAINT
 *   ✅ computeDrift: matching schemas → ok
 *   ✅ computeDrift: missing table → drift (status + sort)
 *   ✅ computeDrift: missing column → drift
 *   ✅ computeDrift: extra table (non-cache) → drift
 *   ✅ computeDrift: extra table in ALLOWED_EXTRA_TABLES → ok
 *   ✅ formatReport: ok-status output (smoke check)
 *   ✅ formatReport: drift-status output enthält alle 3 Kategorien
 *   ✅ resolveSchemaPath: liefert absoluten Pfad auf schema.sql
 *   ✅ run(): file-not-found → script_error kind='schema_not_found'
 *   ✅ run(): file-unreadable → script_error kind='schema_unreadable'
 *   ✅ run(): DB-query throws → script_error kind='db_unreachable'
 *   ✅ run(): erfolgreich mit ok-Drift → return ok kind
 *   ✅ run(): erfolgreich mit drift → return drift kind
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// Mocks — VOR den imports
// ============================================================================

jest.mock('fs', () => {
  const actual = jest.requireActual<typeof fs>('fs');
  return {
    ...actual,
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
  };
});

jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn(),
    end: jest.fn().mockResolvedValue(undefined),
  },
}));

// Import NACH den Mocks
import { pool } from '../config/database';
import {
  run,
  resolveSchemaPath,
  parseExpectedSchema,
  computeDrift,
  formatReport,
  queryCurrentSchema,
  ALLOWED_EXTRA_TABLES,
  type SchemaSnapshot,
  type DriftReport,
} from '../scripts/migrate-status';

const mockExistsSync = fs.existsSync as jest.Mock;
const mockReadFileSync = fs.readFileSync as jest.Mock;
const mockPoolQuery = pool.query as jest.Mock;
const mockPoolEnd = pool.end as jest.Mock;

// ============================================================================
// Helper: snapshot builder
// ============================================================================

function snap(tables: Record<string, string[]>): SchemaSnapshot {
  const map = new Map<string, ReadonlySet<string>>();
  for (const [name, cols] of Object.entries(tables)) {
    map.set(name, new Set(cols.map((c) => c.toLowerCase())));
  }
  return { tables: map, rawSchema: '' };
}

// ============================================================================
// Tests
// ============================================================================

describe('migrate-status.ts — Schema-Drift-Check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // resolveSchemaPath
  // ==========================================================================

  describe('resolveSchemaPath()', () => {
    it('liefert einen absoluten Pfad der auf schema.sql endet', () => {
      const p = resolveSchemaPath();
      expect(path.isAbsolute(p)).toBe(true);
      expect(path.basename(p)).toBe('schema.sql');
    });

    it('enthält database/ als Parent-Verzeichnis', () => {
      const p = resolveSchemaPath();
      expect(p).toContain(path.join('database', 'schema.sql'));
    });
  });

  // ==========================================================================
  // parseExpectedSchema — SQL-Parser
  // ==========================================================================

  describe('parseExpectedSchema()', () => {
    it('erkennt eine einzelne CREATE TABLE mit Spalten', () => {
      const sql = 'CREATE TABLE users (id SERIAL PRIMARY KEY, email TEXT NOT NULL);';
      const result = parseExpectedSchema(sql);
      expect(result.tables.has('users')).toBe(true);
      expect(result.tables.get('users')!.has('id')).toBe(true);
      expect(result.tables.get('users')!.has('email')).toBe(true);
      expect(result.tables.get('users')!.has('serial')).toBe(false);
    });

    it('erkennt mehrere Tabellen', () => {
      const sql = [
        'CREATE TABLE users (id INT);',
        'CREATE TABLE stops (id INT, name TEXT);',
        'CREATE TABLE doctors (id INT, specialty TEXT);',
      ].join('\n');
      const result = parseExpectedSchema(sql);
      expect(result.tables.size).toBe(3);
      expect(result.tables.has('users')).toBe(true);
      expect(result.tables.has('stops')).toBe(true);
      expect(result.tables.has('doctors')).toBe(true);
    });

    it('akzeptiert IF NOT EXISTS', () => {
      const sql = 'CREATE TABLE IF NOT EXISTS users (id INT);';
      const result = parseExpectedSchema(sql);
      expect(result.tables.has('users')).toBe(true);
    });

    it('ignoriert CREATE INDEX', () => {
      const sql = [
        'CREATE INDEX idx_users_email ON users(email);',
        'CREATE TABLE users (id INT, email TEXT);',
      ].join('\n');
      const result = parseExpectedSchema(sql);
      expect(result.tables.size).toBe(1);
      expect(result.tables.has('idx_users_email')).toBe(false);
      expect(result.tables.has('users')).toBe(true);
    });

    it('überspringt Constraint-Deklarationen (PRIMARY KEY, FOREIGN KEY)', () => {
      const sql = [
        'CREATE TABLE appointments (',
        '  id INT,',
        '  PRIMARY KEY (id),',
        '  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),',
        '  user_id INT',
        ');',
      ].join('\n');
      const result = parseExpectedSchema(sql);
      const cols = result.tables.get('appointments')!;
      expect(cols.has('id')).toBe(true);
      expect(cols.has('user_id')).toBe(true);
      expect(cols.has('primary')).toBe(false);
      expect(cols.has('constraint')).toBe(false);
      expect(cols.has('fk_user')).toBe(false);
    });

    it('behandelt Multi-Line CREATE TABLE korrekt', () => {
      const sql = [
        'CREATE TABLE stops (',
        '  stop_id UUID,',
        '  name TEXT NOT NULL,',
        '  lat DOUBLE PRECISION,',
        '  lng DOUBLE PRECISION',
        ');',
      ].join('\n');
      const result = parseExpectedSchema(sql);
      const cols = result.tables.get('stops')!;
      expect(cols.size).toBe(4);
      expect(cols.has('stop_id')).toBe(true);
      expect(cols.has('name')).toBe(true);
      expect(cols.has('lat')).toBe(true);
      expect(cols.has('lng')).toBe(true);
      expect(cols.has('precision')).toBe(false);
    });

    it('liefert leeren Snapshot für input ohne CREATE TABLE', () => {
      const result = parseExpectedSchema('-- nur ein Kommentar\nSELECT 1;');
      expect(result.tables.size).toBe(0);
    });
  });

  // ==========================================================================
  // computeDrift — Vergleich
  // ==========================================================================

  describe('computeDrift()', () => {
    it('matching schemas → status=ok', () => {
      const exp = snap({ users: ['id', 'email'] });
      const act = snap({ users: ['id', 'email'] });
      const report = computeDrift(exp, act);
      expect(report.status).toBe('ok');
      expect(report.missingTables).toEqual([]);
      expect(report.missingColumns).toEqual([]);
      expect(report.extraTables).toEqual([]);
    });

    it('erkennt fehlende Tabelle', () => {
      const exp = snap({ users: ['id'], stops: ['id'] });
      const act = snap({ users: ['id'] });
      const report = computeDrift(exp, act);
      expect(report.status).toBe('drift');
      expect(report.missingTables).toEqual(['stops']);
      expect(report.missingColumns).toEqual([]);
    });

    it('erkennt fehlende Spalte in existierender Tabelle', () => {
      const exp = snap({ users: ['id', 'email', 'name'] });
      const act = snap({ users: ['id', 'email'] });
      const report = computeDrift(exp, act);
      expect(report.status).toBe('drift');
      expect(report.missingTables).toEqual([]);
      expect(report.missingColumns).toEqual([
        { table: 'users', column: 'name' },
      ]);
    });

    it('erkennt extra Tabelle (non-cache) als Drift', () => {
      const exp = snap({ users: ['id'] });
      const act = snap({ users: ['id'], legacy_temp: ['x'] });
      const report = computeDrift(exp, act);
      expect(report.status).toBe('drift');
      expect(report.extraTables).toEqual(['legacy_temp']);
    });

    it('akzeptiert extra Tabelle in ALLOWED_EXTRA_TABLES als ok', () => {
      const cache = 'overpass_cache_2026';
      // add temporary to allow-list at runtime via Set-API
      (ALLOWED_EXTRA_TABLES as Set<string>).add(cache);
      try {
        const exp = snap({ users: ['id'] });
        const act = snap({ users: ['id'], [cache]: ['id'] });
        const report = computeDrift(exp, act);
        expect(report.status).toBe('ok');
        expect(report.extraTables).toEqual([]);
      } finally {
        (ALLOWED_EXTRA_TABLES as Set<string>).delete(cache);
      }
    });

    it('sortiert fehlende Spalten nach (table, column)', () => {
      const exp = snap({
        doctors: ['id', 'specialty', 'zip'],
        users: ['id', 'email'],
      });
      const act = snap({
        doctors: ['id'],
        users: ['id'],
      });
      const report = computeDrift(exp, act);
      expect(report.missingColumns).toEqual([
        { table: 'doctors', column: 'specialty' },
        { table: 'doctors', column: 'zip' },
        { table: 'users', column: 'email' },
      ]);
    });

    it('setzt expectedTableCount und actualTableCount korrekt', () => {
      const exp = snap({ a: ['x'], b: ['x'], c: ['x'] });
      const act = snap({ a: ['x'], b: ['x'] });
      const report = computeDrift(exp, act);
      expect(report.expectedTableCount).toBe(3);
      expect(report.actualTableCount).toBe(2);
    });

    it('setzt checkedAt als ISO-String', () => {
      const exp = snap({});
      const act = snap({});
      const report = computeDrift(exp, act);
      // Should parse as valid Date
      expect(new Date(report.checkedAt).toISOString()).toBe(report.checkedAt);
    });
  });

  // ==========================================================================
  // formatReport
  // ==========================================================================

  describe('formatReport()', () => {
    it('ok-Status enthält "schema is in sync"', () => {
      const report: DriftReport = {
        status: 'ok',
        missingTables: [],
        missingColumns: [],
        extraTables: [],
        checkedAt: '2026-07-27T00:00:00.000Z',
        expectedTableCount: 16,
        actualTableCount: 16,
      };
      const out = formatReport(report);
      expect(out).toContain('schema is in sync');
      expect(out).toContain('2026-07-27T00:00:00.000Z');
      expect(out).toContain('16 expected');
    });

    it('drift-Status listet missing tables, missing columns und extra tables', () => {
      const report: DriftReport = {
        status: 'drift',
        missingTables: ['mobility_stops'],
        missingColumns: [
          { table: 'users', column: 'display_name' },
        ],
        extraTables: ['legacy_temp_table'],
        checkedAt: '2026-07-27T00:00:00.000Z',
        expectedTableCount: 16,
        actualTableCount: 16,
      };
      const out = formatReport(report);
      expect(out).toContain('SCHEMA DRIFT DETECTED');
      expect(out).toContain('mobility_stops');
      expect(out).toContain('users.display_name');
      expect(out).toContain('legacy_temp_table');
      expect(out).toContain('npm run migrate:dev');
    });

    it('drift-Status mit nur missing_tables (keine columns)', () => {
      const report: DriftReport = {
        status: 'drift',
        missingTables: ['a'],
        missingColumns: [],
        extraTables: [],
        checkedAt: '2026-07-27T00:00:00.000Z',
        expectedTableCount: 2,
        actualTableCount: 1,
      };
      const out = formatReport(report);
      expect(out).toContain('missing_tables (1)');
      // missing_columns-Section erscheint NICHT wenn leer (intentional, sonst redundant Output)
      expect(out).not.toContain('missing_columns (');
      expect(out).not.toContain('extra_tables (');
      expect(out).toContain('SCHEMA DRIFT DETECTED');
    });
  });

  // ==========================================================================
  // queryCurrentSchema
  // ==========================================================================

  describe('queryCurrentSchema()', () => {
    it('mapped table-name → columns korrekt', async () => {
      mockPoolQuery
        .mockResolvedValueOnce({
          rows: [{ table_name: 'users' }, { table_name: 'stops' }],
        })
        .mockResolvedValueOnce({
          rows: [{ column_name: 'id' }, { column_name: 'email' }],
        })
        .mockResolvedValueOnce({
          rows: [{ column_name: 'stop_id' }, { column_name: 'name' }],
        });

      const result = await queryCurrentSchema();
      expect(result.tables.size).toBe(2);
      expect(result.tables.get('users')!.has('id')).toBe(true);
      expect(result.tables.get('users')!.has('email')).toBe(true);
      expect(result.tables.get('stops')!.has('stop_id')).toBe(true);
      expect(result.tables.get('stops')!.has('name')).toBe(true);
    });

    it('lower-cased Spalten-Namen (information_schema kann mixed-case liefern)', async () => {
      mockPoolQuery
        .mockResolvedValueOnce({ rows: [{ table_name: 'Users' }] })
        .mockResolvedValueOnce({
          rows: [{ column_name: 'ID' }, { column_name: 'Email' }],
        });

      const result = await queryCurrentSchema();
      expect(result.tables.has('users')).toBe(true);
      expect(result.tables.get('users')!.has('id')).toBe(true);
      expect(result.tables.get('users')!.has('email')).toBe(true);
    });
  });

  // ==========================================================================
  // run() — End-to-End-Pfade
  // ==========================================================================

  describe('run()', () => {
    it('ok-Pfad: erfolgreicher Schema-Match', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        'CREATE TABLE users (id INT, email TEXT);',
      );
      mockPoolQuery
        .mockResolvedValueOnce({ rows: [{ table_name: 'users' }] })
        .mockResolvedValueOnce({
          rows: [{ column_name: 'id' }, { column_name: 'email' }],
        });

      const captured: string[] = [];
      const result = await run({
        output: (t) => captured.push(t),
      });

      expect(result.kind).toBe('ok');
      if (result.kind === 'ok') {
        expect(result.report.status).toBe('ok');
      }
      expect(captured.join('\n')).toContain('schema is in sync');
    });

    it('drift-Pfad: gefundene missing table', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        'CREATE TABLE a (id INT);\nCREATE TABLE b (id INT);',
      );
      mockPoolQuery
        .mockResolvedValueOnce({ rows: [{ table_name: 'a' }] })
        .mockResolvedValueOnce({ rows: [{ column_name: 'id' }] });

      const captured: string[] = [];
      const result = await run({
        output: (t) => captured.push(t),
      });

      expect(result.kind).toBe('drift');
      if (result.kind === 'drift') {
        expect(result.report.missingTables).toEqual(['b']);
      }
      expect(captured.join('\n')).toContain('SCHEMA DRIFT DETECTED');
    });

    it('script_error: schema-Datei fehlt', async () => {
      mockExistsSync.mockReturnValue(false);

      const captured: string[] = [];
      const result = await run({
        output: (t) => captured.push(t),
      });

      expect(result.kind).toBe('script_error');
      if (result.kind === 'script_error') {
        expect(result.reason).toBe('schema_not_found');
      }
      expect(captured.join('\n')).toContain('ERROR');
      expect(mockPoolQuery).not.toHaveBeenCalled();
    });

    it('script_error: schema-Datei nicht lesbar', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const captured: string[] = [];
      const result = await run({
        output: (t) => captured.push(t),
      });

      expect(result.kind).toBe('script_error');
      if (result.kind === 'script_error') {
        expect(result.reason).toBe('schema_unreadable');
      }
      expect(mockPoolQuery).not.toHaveBeenCalled();
    });

    it('script_error: DB query throws', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('CREATE TABLE a (id INT);');
      mockPoolQuery.mockRejectedValue(
        new Error('ECONNREFUSED 127.0.0.1:5432'),
      );

      const captured: string[] = [];
      const result = await run({
        output: (t) => captured.push(t),
      });

      expect(result.kind).toBe('script_error');
      if (result.kind === 'script_error') {
        expect(result.reason).toBe('db_unreachable');
      }
      expect(captured.join('\n')).toContain('ECONNREFUSED');
      expect(mockPoolEnd).toHaveBeenCalled();
    });

    it('script_error: pool.end nach DB-Fehler darf nicht werfen', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('CREATE TABLE a (id INT);');
      mockPoolQuery.mockRejectedValue(new Error('connection lost'));
      mockPoolEnd.mockRejectedValue(new Error('already closed'));

      const result = await run({
        output: () => undefined,
      });

      expect(result.kind).toBe('script_error');
      expect(mockPoolEnd).toHaveBeenCalled();
    });

    it('erfolgreicher run() ruft pool.end am Ende auf', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('CREATE TABLE a (id INT);');
      mockPoolQuery
        .mockResolvedValueOnce({ rows: [{ table_name: 'a' }] })
        .mockResolvedValueOnce({ rows: [{ column_name: 'id' }] });

      await run({ output: () => undefined });

      expect(mockPoolEnd).toHaveBeenCalled();
    });
  });
});
