import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate';
import { errorMessage } from '../utils/error';
import {
  stopsQuerySchema,
  searchQuerySchema,
  routeQuerySchema,
  geocodeQuerySchema,
  departuresQuerySchema,
  journeyQuerySchema,
  raptorJourneyQuerySchema,
  stopsMatchQuerySchema,
  logDelayBodySchema,
  aiIntentBodySchema,
  aiPersonalRouteBodySchema,
} from '../middleware/schemas';
import { mobilityService } from '../services/mobilityService';
import { dbVendoService } from '../services/dbVendoService';
import raptorService from '../services/raptorService';
import { classifyIntent } from '../services/aiService';
import { analyzeDisruptions, getDisruptionsFromTransitous } from '../services/disruptionAgent';
import { personalRoutePlanning } from '../services/personalRoutingAgent';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

export const mobilityRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next); };

// ---------------------------------------------------------------------------
// Overpass-based endpoints (lokale Haltestellen, Routing)
// ---------------------------------------------------------------------------

mobilityRouter.get('/stops', validate(stopsQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const latNum = parseFloat(req.query.lat as string);
  const lngNum = parseFloat(req.query.lng as string);
  const radiusNum = req.query.radius ? parseFloat(req.query.radius as string) : 1000;
  const stops = await mobilityService.getNearbyStops(latNum, lngNum, radiusNum);
  res.json({ status: 'ok', stops, count: stops.length });
}));

// Haltestellen-Suche via db-vendo (MUST be before /stops/:id!)
mobilityRouter.get('/stops/search', validate(searchQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const stops = await dbVendoService.searchStops(req.query.q as string, 5);
  res.json({ status: 'ok', stops, count: stops.length });
}));

// GTFS Stop-Matching (MUST be before /stops/:id!)
mobilityRouter.get('/stops/match', validate(stopsMatchQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const matches = await mobilityService.matchStopToGtfs(
    parseInt(req.query.osm_id as string),
    req.query.name as string,
    parseFloat(req.query.lat as string),
    parseFloat(req.query.lng as string)
  );
  res.json({ status: 'ok', matches, count: matches.length });
}));

mobilityRouter.get('/stops/:id', asyncHandler(async (req: Request, res: Response) => {
  const stop = await mobilityService.getStopById(req.params.id);
  res.json({ status: 'ok', stop });
}));

mobilityRouter.get('/route', validate(routeQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const route = await mobilityService.getRoute(
    { lat: parseFloat(req.query.from_lat as string), lng: parseFloat(req.query.from_lng as string) },
    { lat: parseFloat(req.query.to_lat as string), lng: parseFloat(req.query.to_lng as string) },
  );
  res.json({ status: 'ok', route });
}));

mobilityRouter.get('/geocode', validate(geocodeQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const results = await mobilityService.geocodeAddress(req.query.address as string);
  res.json({ status: 'ok', results });
}));

// Nächste Abfahrten via transitous.org
mobilityRouter.get('/departures', validate(departuresQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const { stopId, lat, lng, duration } = req.query;

  try {
    let id = stopId as string | undefined;

    if (!id && lat && lng) {
      const nearby = await dbVendoService.searchStopsByCoords(
        parseFloat(lat as string), parseFloat(lng as string), 1,
      );
      if (nearby.length > 0) id = nearby[0].id;
    }

    if (!id) {
      logger.warn(`Departures: keine Haltestelle gefunden (lat=${lat}, lng=${lng})`);
      res.json({ status: 'ok', departures: [], count: 0 });
      return;
    }

    const durationNum = duration ? parseInt(duration as string) : 10;
    const departures = await dbVendoService.getDepartures(id, durationNum);

    res.json({
      status: 'ok',
      departures: departures.map(d => ({
        line: d.line,
        direction: d.direction,
        mode: d.mode,
        plannedDeparture: d.plannedDeparture,
        realtimeDeparture: d.realtimeDeparture,
        delay: d.delayMinutes,
        platform: d.platform,
        stopName: d.stopName,
      })),
      count: departures.length,
    });
  } catch (e: unknown) {
    logger.warn(`departures fehlgeschlagen: ${errorMessage(e)}`);
    res.json({ status: 'ok', departures: [], count: 0 });
  }
}));

// Verbindungssuche via transitous.org
mobilityRouter.get('/journey', validate(journeyQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const fl = parseFloat(req.query.from_lat as string);
  const fg = parseFloat(req.query.from_lng as string);
  const tl = parseFloat(req.query.to_lat as string);
  const tg = parseFloat(req.query.to_lng as string);

  try {
    logger.info(`Journey: transitous.org ${fl},${fg} → ${tl},${tg}`);
    const journeys = await dbVendoService.getJourneys('', '', undefined, fl, fg, tl, tg);
    logger.info(`Journey: ${journeys.length} Verbindungen gefunden`);
    res.json({ status: 'ok', journeys });
  } catch (e: unknown) {
    logger.warn(`journey fehlgeschlagen: ${errorMessage(e)}`);
    res.json({ status: 'ok', journeys: [] });
  }
}));

// ---------------------------------------------------------------------------
// ML: Delay-Logging Endpoint
// ---------------------------------------------------------------------------

mobilityRouter.post('/log-delay', validate(logDelayBodySchema, 'body'), asyncHandler(async (req: Request, res: Response) => {
  const { tripId, line, stopId, stopName, scheduledDeparture, actualDeparture, delayMinutes } = req.body;

  try {
    const query = `
      INSERT INTO delay_logs (trip_id, line, stop_id, stop_name, scheduled_departure, actual_departure, delay_minutes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    const values = [
      tripId,
      line,
      stopId || '',
      stopName || '',
      scheduledDeparture,
      actualDeparture || scheduledDeparture,
      delayMinutes || 0,
    ];

    await pool.query(query, values);

    logger.info(`DELAY_LOG: trip=${tripId} line=${line} delay=${delayMinutes}min`);
    res.json({ status: 'ok', logged: true });
  } catch (e: unknown) {
    logger.warn(`Delay-Logging fehlgeschlagen: ${errorMessage(e)}`);
    res.json({ status: 'ok', logged: false });
  }
}));

// ---------------------------------------------------------------------------
// RAPTOR-basierte Verbindungssuche (lokale GTFS-Daten)
// ---------------------------------------------------------------------------

mobilityRouter.get('/journey/raptor', validate(raptorJourneyQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  if (!raptorService.isReady()) {
    logger.info('RAPTOR not ready, falling back to transitous.org');
    res.json({ status: 'ok', journeys: [], fallback: 'transitous.org' });
    return;
  }

  try {
    const departTime = req.query.departureTime ? new Date(req.query.departureTime as string) : new Date();
    const journeys = await raptorService.findJourneys(
      req.query.from as string,
      req.query.to as string,
      departTime
    );

    logger.info(`RAPTOR: ${journeys.length} journeys found for ${req.query.from} → ${req.query.to}`);
    res.json({ status: 'ok', journeys, source: 'raptor' });
  } catch (e: unknown) {
    logger.warn(`RAPTOR journey fehlgeschlagen: ${errorMessage(e)}`);
    res.json({ status: 'ok', journeys: [], source: 'raptor', error: errorMessage(e) });
  }
}));

// RAPTOR Status
mobilityRouter.get('/raptor/status', asyncHandler(async (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    ready: raptorService.isReady(),
    source: 'raptor-journey-planner'
  });
}));

// ---------------------------------------------------------------------------
// AI Intent-Klassifikation
// ---------------------------------------------------------------------------

mobilityRouter.post('/ai/intent', validate(aiIntentBodySchema, 'body'), asyncHandler(async (req: Request, res: Response) => {
  const intent = await classifyIntent(req.body.message);
  res.json({ status: 'ok', intent: intent ?? null });
}));

// ---------------------------------------------------------------------------
// AI Disruption-Analyse
// ---------------------------------------------------------------------------

mobilityRouter.get('/ai/disruptions', asyncHandler(async (req: Request, res: Response) => {
  const alerts = await getDisruptionsFromTransitous();
  const disruptions = await analyzeDisruptions(alerts);
  res.json({ status: 'ok', disruptions, raw_alerts: alerts.length });
}));

// ---------------------------------------------------------------------------
// AI Personal Routing
// ---------------------------------------------------------------------------

mobilityRouter.post('/ai/personal-route', validate(aiPersonalRouteBodySchema, 'body'), asyncHandler(async (req: Request, res: Response) => {
  const { message, origin, destination } = req.body;
  const journeys = await personalRoutePlanning(message, origin, destination);
  res.json({ status: 'ok', journeys });
}));
