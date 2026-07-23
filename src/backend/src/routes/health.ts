import { Router, Request, Response } from 'express';
import { pool } from '../config/database';

export const healthRouter = Router();

healthRouter.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

healthRouter.get('/ready', async (req: Request, res: Response) => {
  const checks: Record<string, string> = {};

  // Database check
  try {
    await pool.query('SELECT 1');
    checks.database = 'connected';
  } catch {
    checks.database = 'disconnected';
  }

  // Redis check (optional)
  try {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      // Simple TCP connect test
      const { createClient } = await import('redis');
      const client = createClient({ url: redisUrl });
      await client.connect();
      await client.ping();
      await client.disconnect();
      checks.cache = 'connected';
    } else {
      checks.cache = 'not configured';
    }
  } catch {
    checks.cache = 'disconnected';
  }

  const allHealthy = Object.values(checks).every(v => v === 'connected' || v === 'not configured');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'degraded',
    services: checks,
  });
});
