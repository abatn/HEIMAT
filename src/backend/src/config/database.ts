import { Pool, PoolConfig } from 'pg';
import { logger } from '../utils/logger';
import { URL } from 'url';

// Parse connection string or use individual params
function buildPoolConfig(): PoolConfig & { family?: number } {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    const url = new URL(connectionString);
    return {
      host: url.hostname,
      port: parseInt(url.port || '5432'),
      database: url.pathname.replace('/', ''),
      user: url.username,
      password: url.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: url.searchParams.get('sslmode') === 'require' ? { rejectUnauthorized: false } : undefined,
      family: 4, // Force IPv4 — Supabase defaults to IPv6, Render Free-Tier is IPv4-only
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'heimat',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    family: 4,
  };
}

const poolConfig = buildPoolConfig();

export const pool = new Pool(poolConfig as PoolConfig);

pool.on('connect', () => {
  logger.info('New client connected to PostgreSQL');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test connection
export async function testConnection(): Promise<boolean> {
  try {
    logger.info('Attempting PostgreSQL connection...', {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL,
    });
    const client = await pool.connect();
    logger.info('PostgreSQL connected successfully');
    client.release();
    return true;
  } catch (error) {
    logger.error('PostgreSQL connection failed:', error);
    return false;
  }
}

// Execute query
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug('Executed query', { text, duration, rows: result.rowCount });
  return result.rows;
}

// Execute single row query
export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

// Execute insert/update/delete
export async function execute(text: string, params?: any[]): Promise<number> {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug('Executed query', { text, duration, rows: result.rowCount });
  return result.rowCount || 0;
}
