import { Pool, PoolConfig } from 'pg';
import { logger } from '../utils/logger';

// Support full connection string or individual params
const connectionString = process.env.DATABASE_URL;

const poolConfig: PoolConfig = connectionString
  ? {
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'heimat',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    };

export const pool = new Pool(poolConfig);

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
