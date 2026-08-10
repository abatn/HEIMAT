import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { execSync } from 'child_process';

import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { healthRouter } from './routes/health';
import { mobilityRouter } from './routes/mobility';
import { financeRouter } from './routes/finance';
import { healthRouter as healthServiceRouter } from './routes/healthService';
import { authRouter } from './routes/auth';
import adminRouter from './routes/admin';
import { aiRouter } from './routes/ai';
import { weatherRouter } from './routes/weather';
import { airQualityRouter } from './routes/airQuality';
import { wasteRouter } from './routes/waste';
import { evChargingRouter } from './routes/evCharging';
import { parkingRouter } from './routes/parking';
import { configRouter } from './routes/config';
import { checkinRouter } from './routes/checkin';
import { healthMemoryRouter } from './routes/healthMemory';
import { healthMedicationsRouter } from './routes/healthMedications';
import { mentalHealthRouter } from './routes/mentalHealth';
import { preventionRouter } from './routes/prevention';
import { followUpRouter } from './routes/followUp';
import { jobsRouter } from './routes/jobs';
import { skillMatchRouter } from './routes/skillMatch';
import { careerRouter } from './routes/career';
import { dailyBriefingRouter } from './routes/dailyBriefing';
import { smartAlertsRouter } from './routes/smartAlerts';
import { searchRouter } from './routes/search';
import { eventsRouter } from './routes/events';
import { hotelsRouter } from './routes/hotels';
import { buergeramtRouter } from './routes/buergeramt';
import { checkinService } from './services/checkinService';
import { testConnection } from './config/database';
import raptorService from './services/raptorService';
import { gtfsService } from './services/gtfsService';
import { swaggerSpec } from './config/swagger';
import swaggerUi from 'swagger-ui-express';
import { errorMessage } from './utils/error';
import { ollamaService } from './services/ollamaService';

dotenv.config();

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'unsafe-none' },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { error: 'Too many requests. Please try again later.' } }));
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
app.use('/api/ai', aiRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/air-quality', airQualityRouter);
app.use('/api/waste', wasteRouter);
app.use('/api/ev-charging', evChargingRouter);
app.use('/api/parking', parkingRouter);
app.use('/api/config', configRouter);
app.use('/api/checkin', checkinRouter);
app.use('/api/health/memory', healthMemoryRouter);
app.use('/api/health/medications', healthMedicationsRouter);
app.use('/api/health/mental', mentalHealthRouter);
app.use('/api/health/prevention', preventionRouter);
app.use('/api/health/followups', followUpRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/jobs', skillMatchRouter);
app.use('/api/career', careerRouter);
app.use('/api/daily-briefing', dailyBriefingRouter);
app.use('/api/smart-alerts', smartAlertsRouter);
app.use('/api/search', searchRouter);
app.use('/api/events', eventsRouter);
app.use('/api/hotels', hotelsRouter);
app.use('/api/buergeramt', buergeramtRouter);

// Lebenszeichen Check-in Eskalations-Timer starten (nur in Produktion)
if (process.env.NODE_ENV !== 'test') {
  checkinService.startEscalationTimer();
}

// Statische Dateien ausliefern (Favicon, etc.)
// Phase X.1 (2026-07-28): /mini-Static-Serving entfernt — IFrame-Einbettung
// externer Webseiten ist per User-Regel verboten. Alle Mini-Programme werden
// nativ in Flutter gerendert (ServiceRegistry + ComingSoonScreen-Pattern).

// Swagger API-Dokumentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.use(notFoundHandler);
app.use(errorHandler);

if (require.main === module) {
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Phase 23 Fix: preDeployCommand ist in runtime:node still ignoriert (siehe
  // Render-Docs: nur fuer runtime:docker). Stattdessen blocking startup-hook BEVOR
  // die neue Instanz Traffic annimmt. Failure -> process.exit(1), Render aborted deploy.
  // Default-on: Migration laeuft bei jedem Start AUSSER bei explizitem AUTO_MIGRATE=false
  // (Render-Dashboard kein Env-Var noetig, lokales Dev kann mit=false ueberschreiben).
  if (process.env.AUTO_MIGRATE !== 'false') {
    try {
      logger.info('Running pre-flight database migrations (AUTO_MIGRATE default-on)...');
      execSync('node dist/scripts/migrate.js', { stdio: 'inherit' });
    } catch (e: unknown) {
      logger.error(`Auto-migration failed, aborting startup: ${errorMessage(e)}`);
      process.exit(1);
    }
  }

  app.listen(PORT, '0.0.0.0', async () => {
    logger.info(`HEIMAT Backend running on port ${PORT}`);
    await testConnection();

    // Ollama Warmup: Modell sofort beim Start in den RAM laden
    // Verhindert Cold-Start-Timeout beim ersten Chat-Aufruf
    ollamaService.status().then(status => {
      if (status.available) {
        logger.info(`Ollama Warmup: ${status.message}`);
      } else {
        logger.warn(`Ollama Warmup: ${status.message}`);
      }
    }).catch(e => {
      logger.warn(`Ollama Warmup fehlgeschlagen: ${e}`);
    });

    try {
      // OPT-IN-Default: RAPTOR-In-Memory-Routing-Engine braucht beim Initialisieren
      // >500 MB Heap, was Render Free Tier (512 MB Container) mit V8 OOM killt. Ohne
      // explizites ENABLE_RAPTOR=true bleibt der Schritt aus und wir nutzen dauerhaft
      // den transitous.org-Fallback. Lokales Dev / Render Standard: ENABLE_RAPTOR=true.
      if (process.env.ENABLE_RAPTOR === 'true') {
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
      } else {
        logger.info('RAPTOR disabled (ENABLE_RAPTOR not set), using transitous.org for routing');
      }
    } catch (e: unknown) {
      logger.warn(`RAPTOR initialization skipped: ${errorMessage(e)}`);
    }
  });
}

export default app;
