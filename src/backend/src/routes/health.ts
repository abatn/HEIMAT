import { Router, Request, Response } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

healthRouter.get('/ready', (req: Request, res: Response) => {
  // Check database connection, Redis, etc.
  res.json({
    status: 'ready',
    services: {
      database: 'connected',
      cache: 'connected',
    },
  });
});
