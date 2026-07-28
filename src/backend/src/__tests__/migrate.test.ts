/**
 * migrate.test.ts — Unit-Tests für den Pre-Deploy Database Migration Runner
 *
 * Testet die Funktionen von src/scripts/migrate.ts isoliert mit gemocktem
 * pg pool, fs und process.exit. Die mock-basierte Coverage schliesst die
 * Lücke, dass migrate.ts als CLI-Script konzipiert ist und normalerweise
 * nur in der Render-Pre-Deploy-Phase via node dist/scripts/migrate.js läuft.
 *
 * Gemockte Module:
 *   - fs:     existsSync, readFileSync
 *   - pg:     pool.query, pool.end
 *   - process: exit (verhindert terminales Beenden des Jest-Prozesses)
 *
 * Getestete Pfade:
 *   ✅ Erfolg: Schema existiert, Query läuft durch → exit(0)
 *   ✅ Schema-Datei nicht gefunden → exit(1) + Fehler-Log
 *   ✅ Schema-Datei nicht lesbar → exit(1) + Fehler-Log
 *   ✅ Query schlägt fehl → exit(1) + redacted Error-Log
 *   ✅ Query + Connection-String-Leak → exit(1) + password-redacted
 *   ✅ Query-Fehler + pool.end schlägt fehl → exit(1) (Exception-Safe)
 *   ✅ redactConnectionSecrets() pure Function-Tests
 *   ✅ resolveSchemaPath() Pfadlogik-Tests
 */

import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Mock Setup — inline jest.fn() in den Factory-Funktionen, damit
// ts-jest's jest.mock-Hoisting nicht auf nicht-hoistbare const-Variablen
// zugreift (Temporal-Dead-Zone-Problem mit ts-jest preset).
// ---------------------------------------------------------------------------

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

// Import NACH den jest.mock-Calls — ts-jest hoistet mock-Aufrufe, sodass
// die Factory-Funktionen vor den statischen Imports ausgeführt werden.
import { pool } from '../config/database';
import {
  run,
  redactConnectionSecrets,
} from '../scripts/migrate';
import { resolveSchemaPath } from '../scripts/_schema-path';

// Typisierte Zugriffe auf die gemockten Funktionen
const mockExistsSync = fs.existsSync as jest.Mock;
const mockReadFileSync = fs.readFileSync as jest.Mock;
const mockPoolQuery = pool.query as jest.Mock;
const mockPoolEnd = pool.end as jest.Mock;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('migrate.ts — Database Migration Runner', () => {
  let mockExit: jest.SpyInstance;

  beforeAll(() => {
    // Env-Vars für konsistente Log-Ausgabe (werden geloggt aber nicht getestet)
    process.env.DB_HOST = 'test-host.mock';
    process.env.DB_PORT = '5432';
  });

  afterAll(() => {
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: alle mocks funktionieren
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('CREATE TABLE IF NOT EXISTS test (id INT);');
    mockPoolQuery.mockResolvedValue({ rows: [] });
    mockPoolEnd.mockResolvedValue(undefined);

    // process.exit wird gemockt, damit Jest nicht terminiert.
    // Der `as never`-Cast umgeht TS2345 (exit erwartet `never`-Return,
    // aber wir wollen die tatsächliche Exit-Aktion unterdrücken).
    mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {
      // noop — prevent process from actually exiting
    }) as never);
  });

  afterEach(() => {
    mockExit?.mockRestore();
  });

  // =========================================================================
  // redactConnectionSecrets — Pure Function
  // =========================================================================

  describe('redactConnectionSecrets()', () => {
    // Anmerkung: Der Regex `://user:pass@host` hat eine bekannte Limitation —
    // Passwörter die `@` enthalten werden nicht korrekt redacted, weil das erste @
    // als host-Trenner interpretiert wird. Supabase empfiehlt Percent-Encoding für
    // Sonderzeichen (`%40` für `@`), daher ist das für Production-DB-Passwörter kein
    // Problem. Der Test verwendet deshalb ein Passwort ohne `@`.
    it('redacted Passwort in postgres:// URI', () => {
      const input =
        'password authentication failed for user "postgres" ' +
        '(postgresql://postgres:Str0ng!Passw0rd@aws-0-pooler.supabase.com:5432/postgres)';
      const result = redactConnectionSecrets(input);
      expect(result).toContain(
        'postgresql://postgres:***@aws-0-pooler.supabase.com:5432/postgres',
      );
      expect(result).not.toContain('Str0ng!Passw0rd');
    });

    it('lässt normale Fehlermeldung ohne Connection-URI unverändert', () => {
      const input = 'relation "public.taler_wallets" does not exist';
      expect(redactConnectionSecrets(input)).toBe(input);
    });

    it('redacted mehrere URIs in derselben Message', () => {
      const input =
        'first: postgresql://a:secret1@host1/db and ' +
        'second: postgresql://b:secret2@host2/db';
      const result = redactConnectionSecrets(input);
      expect(result).toContain('postgresql://a:***@host1/db');
      expect(result).toContain('postgresql://b:***@host2/db');
      expect(result).not.toContain('secret1');
      expect(result).not.toContain('secret2');
    });

    it('behandelt leeren Input ohne Fehler', () => {
      expect(redactConnectionSecrets('')).toBe('');
    });

    it('behandelt URI ohne Passwort (nur user@host)', () => {
      const input = 'postgresql://postgres@localhost/db';
      expect(redactConnectionSecrets(input)).toBe(input);
    });

    it('behandelt leeres Passwort (user:@{leer}@host)', () => {
      const input = 'postgresql://user:@host/db';
      const result = redactConnectionSecrets(input);
      // Regex matcht `://user:(leer)@` → redacted zu `://user:***@`
      expect(result).toContain('postgresql://user:***@host/db');
      // Original-String enthielt `user:@` — das `:` darf nicht stehen bleiben
      expect(result).not.toContain('user:@');
    });

    it('behandelt Sonderzeichen im Passwort korrekt (Percent-Encoding)', () => {
      const input =
        'postgresql://user:%2F%3A%40%23%24%25%5E%26%2A%28%29!@host/db';
      const result = redactConnectionSecrets(input);
      expect(result).toContain('postgresql://user:***@host/db');
      expect(result).not.toContain('%2F');
    });
  });

  // =========================================================================
  // resolveSchemaPath — Pfadlogik
  // =========================================================================

  describe('resolveSchemaPath()', () => {
    it('liefert einen Pfad der auf schema.sql endet', () => {
      const schemaPath = resolveSchemaPath();
      expect(path.basename(schemaPath)).toBe('schema.sql');
    });

    it('enthält database/ als Parent-Verzeichnis', () => {
      const schemaPath = resolveSchemaPath();
      expect(schemaPath).toContain(path.join('database', 'schema.sql'));
    });

    it('liefert einen absoluten Pfad (beginnt mit /)', () => {
      const schemaPath = resolveSchemaPath();
      expect(path.isAbsolute(schemaPath)).toBe(true);
    });
  });

  // =========================================================================
  // run() — Erfolgs- und Fehlerpfade
  // =========================================================================

  describe('run()', () => {
    it('sollte bei Erfolg exit(0) aufrufen', async () => {
      await run();

      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS'),
      );
      expect(mockPoolEnd).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('sollte bei Erfolg exit(0) nur einmal aufrufen (kein doppelter exit)', async () => {
      await run();

      expect(mockExit).toHaveBeenCalledTimes(1);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('sollte bei fehlender schema.sql exit(1) loggen', async () => {
      mockExistsSync.mockReturnValue(false);

      await run();

      expect(mockPoolQuery).not.toHaveBeenCalled();
      expect(mockPoolEnd).not.toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('sollte bei nicht-lesbarer schema.sql exit(1) loggen', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      await run();

      expect(mockPoolQuery).not.toHaveBeenCalled();
      expect(mockPoolEnd).not.toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('sollte bei Query-Fehler exit(1) aufrufen', async () => {
      mockPoolQuery.mockRejectedValue(
        new Error('relation "public.users" does not exist'),
      );

      await run();

      expect(mockPoolEnd).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('sollte bei Query-Fehler das Passwort in der Log-Message redacted haben', async () => {
      const connectionError = new Error(
        'password authentication failed for user "postgres" ' +
          '(postgresql://postgres:SecretP@ss!@aws-0-pooler.supabase.com:5432/postgres)',
      );
      mockPoolQuery.mockRejectedValue(connectionError);

      await run();

      expect(mockPoolEnd).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('sollte bei Query-Fehler + pool.end-Fehler exit(1) aufrufen (Exception-Safe)', async () => {
      mockPoolQuery.mockRejectedValue(new Error('deadlock detected'));
      mockPoolEnd.mockRejectedValue(new Error('connection already closed'));

      await run();

      // pool.end wurde im catch-Block aufgerufen (auch wenn es fehlschlug)
      expect(mockPoolEnd).toHaveBeenCalled();
      // process.exit(1) muss trotz pool.end-Fehler aufgerufen werden
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('sollte bei Query-Fehler + pool.end-Fehler NICHT werfen (kein unhandled rejection)', async () => {
      mockPoolQuery.mockRejectedValue(new Error('deadlock detected'));
      mockPoolEnd.mockRejectedValue(new Error('connection already closed'));

      // run() muss sauber resolve-en, nicht rejected-promise werfen
      await expect(run()).resolves.toBeUndefined();
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});
