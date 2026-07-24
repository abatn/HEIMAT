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
import { authRouter } from './routes/auth';
import adminRouter from './routes/admin';
import { testConnection, pool } from './config/database';
import raptorService from './services/raptorService';
import { gtfsService } from './services/gtfsService';
import { swaggerSpec } from './config/swagger';
import swaggerUi from 'swagger-ui-express';
import { errorMessage } from './utils/error';

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
app.use('/api/auth', authRouter);
app.use('/api/mobility', mobilityRouter);
app.use('/api/finance', financeRouter);
app.use('/api/health', healthServiceRouter);
app.use('/api/admin', adminRouter);

// Swagger API-Dokumentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.post('/api/migrate', async (req, res) => {
  try {
    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    res.json({ status: 'ok', message: 'Schema loaded successfully' });
  } catch (error: unknown) {
    res.status(500).json({ status: 'error', message: errorMessage(error) });
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

if (require.main === module) {
  const PORT = parseInt(process.env.PORT || '3000', 10);
  app.listen(PORT, '0.0.0.0', async () => {
    logger.info(`HEIMAT Backend running on port ${PORT}`);
    await testConnection();

    try {
      const status = await gtfsService.getStatus();
      if (status.has_data) {
        await raptorService.initializeFromDb();
        if (raptorService.isReady()) {
          logger.info('RAPTOR routing engine ready from PostgreSQL');
        } else {
          logger.info('GTFS schema exists but no data, using transitous.org fallback');
        }
      } else {
        logger.info('No GTFS data found, using transitous.org for routing');
      }
    } catch (e: unknown) {
      logger.warn(`RAPTOR initialization skipped: ${errorMessage(e)}`);
    }
  });
}

export default app;
