/**
 * _schema-path.ts — Shared utility: resolves schema.sql path
 *
 * Beide Scripts (migrate.ts, migrate-status.ts) brauchen diesen Pfad.
 * Extraction verhindert DRY-Verletzung (~5 LOC dupliziert).
 *
 * Pfad-Auflösung:
 *   - Compiled: __dirname = src/backend/dist/scripts/,
 *               ../database/schema.sql = src/backend/dist/database/schema.sql
 *               (buildCommand kopiert es vorher dorthin)
 *   - ts-node:  __dirname = src/backend/src/scripts/,
 *               ../database/schema.sql = src/backend/src/database/schema.sql
 */

import path from 'path';

const SCHEMA_RELATIVE_PATH = path.join('..', 'database', 'schema.sql');

export function resolveSchemaPath(): string {
  return path.join(__dirname, SCHEMA_RELATIVE_PATH);
}
