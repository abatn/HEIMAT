// ---------------------------------------------------------------------------
// route/waste.ts — Express-Routes für Abfallkalender Phase B-2
//
// Mirror-Pattern zu weather.ts + airQuality.ts:
//   - GET /api/waste/calendar  (Haupt-API: lat/lng + optional street/houseNr)
//   - GET /api/waste/status    (Health-Info: cities, attribution, cache)
//
// Validierung via Zod (mirror zu validate.ts):
//   - lat/lng als floats
//   - weeks als int(1-8)
//   - street/houseNr als optional strings (je nach Stadt dynamisch required → 422)
//
// HTTP-Status-Codes:
//   - 200 OK bei Cache-Hit oder upstream-success
//   - 400 BadRequest bei malformed lat/lng
//   - 422 UnprocessableEntity bei address-required Städten ohne street+houseNr
//   - 502 BadGateway bei upstream-fail (alle mirrors dead)
// ---------------------------------------------------------------------------

import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { z } from 'zod';
import { WasteService, AddressRequiredError } from '../services/wasteService';
import { CityNotSupportedError } from '../services/wasteCityResolver';
import { AppError } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';
import { logger } from '../utils/logger';

export const wasteRouter = Router();

// Default-singleton: production runtime verwendet das echte axios-Preset.
// Tests in __tests__/wasteService.test.ts koennten WasteService mit eigenem
// mock-http instantiieren — aber für ROUTE-Tests sind wir hier nicht da
// (route-Validierung wird via SuperTest in einem Phase-2-Skipped gemacht).
const wasteService = new WasteService(axios);

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next); };

// ------------------------------------------------------------------
// Zod-Schemas
// ------------------------------------------------------------------

const calendarQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  weeks: z.coerce.number().int().min(1).max(8).optional().default(4),
  street: z.string().min(1).max(200).optional(),
  houseNr: z.string().min(1).max(20).optional(),
  scheduleId: z.string().min(20).max(30).optional(), // BSR schedule_id (24-stellig)
});

// ------------------------------------------------------------------
// GET /api/waste/calendar
// ------------------------------------------------------------------

wasteRouter.get(
  '/calendar',
  validate(calendarQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    // Phase B-2.2 fix: validate() middleware does Object.assign(req.query, data)
    // after schema.parse(req[source]). In Express 5, req.query is a lazy URL-
    // getter — Object.assign mutates a transient object that is discarded on
    // next read, so handler-side `req.query.lat` re-parses URL strings.
    // The TS cast `as unknown as { lat: number }` only lies to the compiler;
    // runtime value is still `'52.52'`. Result: resolveCity threw TypeError
    // and route returned 502 instead of 200. Mirror the proven
    // /api/weather/* parseFloat-at-handler boundary pattern so wasteService
    // reliably receives numbers. Service stays strict (typeof === 'number').
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const weeks = req.query.weeks ? parseInt(req.query.weeks as string, 10) : 4;
    const street = req.query.street as string | undefined;
    const houseNr = req.query.houseNr as string | undefined;
    const scheduleId = req.query.scheduleId as string | undefined;

    try {
      const data = await wasteService.getWasteCalendar(lat, lng, weeks, street, houseNr, scheduleId);
      res.json({
        status: data.status,
        city: data.city,
        displayName: data.displayName,
        weeks: data.weeks,
        events: data.events,
        source: data.source,
        attribution: wasteService.getAttribution(data.city),
        fetchedAt: data.fetchedAt,
        cached: data.cached,
      });
    } catch (e: unknown) {
      const err = e as Error;
      if (err instanceof AddressRequiredError) {
        logger.warn(`Waste calendar: 422 address_required for ${err.displayName}`);
        res.status(422).json({
          status: 'error',
          code: err.code,
          message: err.message,
          city: err.city,
          displayName: err.displayName,
        });
        return;
      }
      if (err instanceof CityNotSupportedError) {
        res.status(400).json({
          status: 'error',
          code: err.code,
          message: err.message,
          hint: 'Deine Stadt wird über GPS + Nominatim dynamisch erkannt. Keine Hardcodierung.',
        });
        return;
      }
      // ALL OTHER ERRORS: 502 BadGateway (upstream failure both mirrors)
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Waste calendar fetch failed: ${errMsg}`);
      res.status(502).json({
        status: 'error',
        message: 'Abfallkalender konnte nicht abgerufen werden',
        detail: errMsg,
      });
    }
  }),
);

// ------------------------------------------------------------------
// GET /api/waste/status
// ------------------------------------------------------------------

wasteRouter.get('/status', asyncHandler(async (_req: Request, res: Response) => {
  const status = wasteService.getStatus();
  res.json({
    status: 'ok',
    service: 'waste',
    version: '1.0',
    cities: status.cities,
    cacheEntries: status.cacheEntries,
    attribution:
      'Kommunale Open-Data-Quellen via abfall.io + AbfallNavi (Bund) — CC-BY 4.0',
  });
}));

// ------------------------------------------------------------------
// Attribution zentral via wasteService.getAttribution(city) — siehe
// service-rosters unten (CC-BY license pro Stadt, Mock-Policy-konform).
// Keine separate Helper-Map hier, weil das die Mock-Policy duplizieren
// wuerde (kein Mock, echte Daten, Single Source of Truth im Service).
// ------------------------------------------------------------------
