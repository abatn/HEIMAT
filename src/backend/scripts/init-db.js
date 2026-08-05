/**
 * init-db.js — Initialisiert die Supabase Test-DB fuer CI
 *
 * Nutzt node pg (kein psql noetig).
 * Liest schema.sql und fuehrt es aus.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function initDb() {
  const schemaPath = path.resolve(__dirname, '../src/database/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log(`Verbinde mit ${process.env.DB_HOST}:${process.env.DB_PORT}...`);
    await pool.query('SELECT 1');
    console.log('Verbindung OK');

    console.log('Lade Schema...');
    await pool.query(schema);
    console.log('Schema erfolgreich geladen');
  } catch (e) {
    console.error('Fehler:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDb();
