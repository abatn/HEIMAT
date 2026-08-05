/**
 * globalSetup.ts — Wartet bis Postgres bereit ist BEVOR Tests starten.
 *
 * Das Problem: Tests importieren `app from '../index'` was `testConnection()`
 * aufruft. Wenn Postgres noch nicht ready ist, schlagen ALLE Tests fehl.
 *
 * Lösung: globalSetup läuft EINMAL vor allen Tests und wartet auf Postgres.
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

export default async function globalSetup(): Promise<void> {
  // .env laden (wie in production)
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });

  // Nur warten wenn Postgres konfiguriert ist
  const dbHost = process.env.DB_HOST;
  const dbUrl = process.env.DATABASE_URL;
  if (!dbHost && !dbUrl) {
    return; // Kein Postgres konfiguriert — Tests überspringen
  }

  const pool = new Pool({
    host: dbHost || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'heimat_test',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    connectionTimeoutMillis: 5000,
  });

  const maxRetries = 30; // max 30 Sekunden warten
  const delayMs = 1000;

  for (let i = 0; i < maxRetries; i++) {
    try {
      await pool.query('SELECT 1');
      await pool.end();
      console.log(`✓ Postgres bereit nach ${(i + 1) * delayMs}ms`);
      return;
    } catch {
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  await pool.end();
  console.warn(`⚠ Postgres nicht erreichbar nach ${maxRetries}s — Tests können fehlschlagen`);
}
