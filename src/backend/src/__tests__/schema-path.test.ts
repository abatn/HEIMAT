/**
 * schema-path.test.ts — Unit-Tests für shared _schema-path.ts
 *
 * Testet resolveSchemaPath() isoliert:
 *   - Liefert absoluten Pfad
 *   - Endet auf schema.sql
 *   - Enthält ../database/schema.sql (relative to scripts/)
 */

import path from 'path';
import { resolveSchemaPath } from '../scripts/_schema-path';

describe('_schema-path.ts — shared resolveSchemaPath()', () => {
  it('liefert einen absoluten Pfad', () => {
    const p = resolveSchemaPath();
    expect(path.isAbsolute(p)).toBe(true);
  });

  it('endet auf schema.sql', () => {
    const p = resolveSchemaPath();
    expect(path.basename(p)).toBe('schema.sql');
  });

  it('enthält database/ als Parent-Verzeichnis', () => {
    const p = resolveSchemaPath();
    expect(p).toContain(path.join('database', 'schema.sql'));
  });
});
