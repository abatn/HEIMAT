import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { healthRouter } from './routes/health';
import { mobilityRouter } from './routes/mobility';
import { financeRouter } from './routes/finance';
import { healthRouter as healthServiceRouter } from './routes/healthService';
import adminRouter from './routes/admin';
import { testConnection, pool } from './config/database';
import raptorService from './services/raptorService';

dotenv.config();

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'unsafe-none' },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: 'Too many requests.' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(morgan('combined', { stream: { write: (message: string) => logger.info(message.trim()) } }));

app.get('/', (req, res) => {
  res.json({ name: 'HEIMAT 2.0 API', version: '1.0.0', status: 'running' });
});

app.use('/health', healthRouter);
app.use('/api/mobility', mobilityRouter);
app.use('/api/finance', financeRouter);
app.use('/api/health', healthServiceRouter);
app.use('/api/admin', adminRouter);

app.post('/api/migrate', async (req, res) => {
  try {
    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    res.json({ status: 'ok', message: 'Schema loaded successfully' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error?.message || 'Unknown error' });
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

if (require.main === module) {
  const PORT = parseInt(process.env.PORT || '3000', 10);
  app.listen(PORT, '0.0.0.0', async () => {
    logger.info(`HEIMAT Backend running on port ${PORT}`);
    await testConnection();
    
    // RAPTOR initialisieren (GTFS-Datei laden)
    const gtfsPath = path.join(__dirname, '..', 'data', 'gtfs-germany.zip');
    if (fs.existsSync(gtfsPath)) {
      try {
        await raptorService.initialize(gtfsPath);
        logger.info('RAPTOR routing engine ready');
      } catch (e: any) {
        logger.warn('RAPTOR initialization failed, using transitous.org fallback', e.message);
      }
    } else {
      logger.info('No GTFS file found, using transitous.org for routing');
    }
  });
}

export default app;
