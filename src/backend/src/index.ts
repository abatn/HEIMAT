import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { healthRouter } from './routes/health';
import { mobilityRouter } from './routes/mobility';
import { financeRouter } from './routes/finance';
import { healthRouter as healthServiceRouter } from './routes/healthService';
import { testConnection } from './config/database';

dotenv.config();

const app = express();

app.use(helmet());
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

app.post('/api/migrate', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const { pool } = require('./config/database');
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
  });
}

export default app;
