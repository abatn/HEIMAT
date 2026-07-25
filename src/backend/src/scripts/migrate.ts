/**
 * migrate.ts — Pre-Deploy Database Migration Runner
 *
 * Wird vom Render preDeployCommand nach `npm run build` ausgeführt und
 * wendet src/backend/src/database/schema.sql auf die Production-DB an.
 *
 * Vorteile gegenüber einem `/api/migrate` Endpoint:
 *   - Sicherheit: kein unauth Mutation-Endpoint im Internet exponiert
 *   - Atomic-Deploy: failure → Render aborted deploy, alte Instanz läuft weiter
 *   - Cold-Start: passiert beim Deploy, nicht beim App-Boot (Render Free Tier
 *     schläft nach 15 min, dann muss die App so schnell wie möglich antworten)
 *   - Idempotent: schema.sql nutzt CREATE TABLE/INDEX IF NOT EXISTS +
 *     DROP COLUMN IF EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS.
 *
 * Aufruf:
 *   cd src/backend && node dist/scripts/migrate.js
 *
 * Schema-Pfad-Auflösung:
 *   - Compiled: __dirname = src/backend/dist/scripts/,
 *               ../database/schema.sql = src/backend/dist/database/schema.sql
 *               (buildCommand kopiert es vorher dorthin)
 *   - ts-node:  __dirname = src/backend/src/scripts/,
 *               ../database/schema.sql = src/backend/src/database/schema.sql
 *
 * Security: Falls Connection-Errors das Passwort in der Message haben
 * (z. B. "password authentication failed for user ..."), redacted der
 * catch-Block die URI-Form '://user:pass@host' durch '://user:***@host'.
 */

import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { errorMessage } from '../utils/error';

const SCHEMA_RELATIVE_PATH = path.join('..', 'database', 'schema.sql');

function resolveSchemaPath(): string {
  return path.join(__dirname, SCHEMA_RELATIVE_PATH);
}

/**
 * Redactet Postgres-Connection-Strings der Form `://user:pass@host` zu
 * `://user:***@host`. Falls kein Connection-String im Error steht, wird die
 * Message unverändert durchgereicht.
 */
function redactConnectionSecrets(message: string): string {
  return message.replace(/:\/\/([^:/@\s]+):([^@\s]+)@/g, '://$1:***@');
}

async function run(): Promise<void> {
  const schemaPath = resolveSchemaPath();
  const start = Date.now();

  // Wir loggen absichtlich NUR host/port/database/ssl — niemals das Passwort.
  // Auf Render wird die volle URI (inkl. PASSWORD) ohnehin per envVar bereitgestellt
  // und ist nur im Dashboard sichtbar.
  logger.info('Starting pre-deploy database migration', {
    schemaPath,
    dbHost: process.env.DB_HOST || '(unset)',
    dbPort: process.env.DB_PORT || '5432',
    dbName: process.env.DB_NAME || '(unset)',
    dbSsl: process.env.DB_SSL || 'false',
    dbFamily: '4 (forced IPv4)',
  });

  if (!fs.existsSync(schemaPath)) {
    const msg = `schema.sql not found at ${schemaPath}. ` +
      `buildCommand should have copied it via 'cp src/database/schema.sql dist/database/'.`;
    logger.error(msg);
    process.exit(1);
    return;
  }

  let schema: string;
  try {
    schema = fs.readFileSync(schemaPath, 'utf8');
  } catch (e: unknown) {
    logger.error(`Failed to read schema.sql: ${errorMessage(e)}`);
    process.exit(1);
    return;
  }

  try {
    await pool.query(schema);
    const durationMs = Date.now() - start;
    logger.info(`Migration completed successfully in ${durationMs}ms.`);
    await pool.end();
    process.exit(0);
  } catch (e: unknown) {
    const rawMessage = errorMessage(e);
    const safeMessage = redactConnectionSecrets(rawMessage);
    logger.error(`Migration failed: ${safeMessage}`);
    try {
      await pool.end();
    } catch {
      // ignore — wir wollen den Process-Exit-Code nicht überschreiben
    }
    process.exit(1);
  }
}

run();