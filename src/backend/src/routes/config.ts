// ---------------------------------------------------------------------------
// routes/config.ts — Phase X.3b Backend-Driven-Configuration-Endpoint
//
// SIMPLES DESIGN: `GET /api/config/location-defaults` liefert BBox + addressRequired
// + Attribution pro unterstuetzte Stadt, DYNAMISCH aus Backend-Source-of-Truth
// (wasteService.getLocationDefaults() merges wasteCityResolver.CITY_BOUNDS + roster).
//
// AGPL-DEFENSIV: Response enthaelt KEINE iCal-Endpoints (BSR/SRH/AWB primary URLs).
// Mobile zieht ueber unseren Backend-Wrapper /api/waste/calendar. Verhindert
// dass Mobile-User die upstream-Municipality-Endpoints direkt hitten und
// spoofing-Agents beim Provider miss-trauen.
//
// CACHE-STRATEGIE (mobile): 24h SharedPreferences-TTL. expiresAt Unix-timestamp
// ist deterministisch, kein clocks-skew-issue.
//
// Health-Endpoint analog zu /api/waste/status: GET /api/config/status.
// ---------------------------------------------------------------------------

import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { z } from 'zod';
import { WasteService } from '../services/wasteService';
import { logger } from '../utils/logger';

export const configRouter = Router();

// Local singleton (mirror zu routes/waste.ts pattern). DI-Refactor waere
// groesserer Scope-Sprung — minimal-invasive copy analog bestehender routes.
const wasteService = new WasteService(axios);

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ---------------------------------------------------------------------------
// Zod response-schema (Phase X.3b — contract zwischen Backend und Mobile)
// ---------------------------------------------------------------------------
//
// KONTRAKT-DETAILS:
//   - bbox: 4 doubles (minLat/maxLat/minLng/maxLng) — Mobile WasteProvider
//           nutzt das fuer pickCityFromBbox.
//   - addressRequired: Hamburg/Muenchen=true, Berlin=false (BSR liefert city-wide
//           default-fallback).
//   - attribution: CC-BY-4.0 license text per city (BSR/SRH/AWB).
//   - KEIN iCal-URL — Mobile muss /api/waste/calendar durch unseren Wrapper
//     jagen (city-resolution, NFC-cache-key, address-validation, mirror-failover).

const bboxSchema = z.object({
  minLat: z.number(),
  maxLat: z.number(),
  minLng: z.number(),
  maxLng: z.number(),
});

const cityMetadataSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  bbox: bboxSchema,
  addressRequired: z.boolean(),
  attribution: z.string(),
});

const locationDefaultsSchema = z.object({
  version: z.string(),
  expiresAt: z.string(),
  cities: z.array(cityMetadataSchema),
});

// ---------------------------------------------------------------------------
// GET /api/config/location-defaults
// ---------------------------------------------------------------------------

configRouter.get(
  '/location-defaults',
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      const defaults = wasteService.getLocationDefaults();
      // Defensive: re-validate gegen zod-schema BEVOR response-flush.
      // Falls wasteService contract-drift macht (z.B. neues Feld hinzugefuegt
      // ohne zod-update), wird 500 geworfen statt silent schema-version skew.
      const parsed = locationDefaultsSchema.parse(defaults);
      res.json({
        status: 'ok',
        ...parsed,
      });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      logger.error(`Config location-defaults failed: ${errMsg}`);
      res.status(500).json({
        status: 'error',
        message: 'Location-Defaults konnten nicht geladen werden',
        detail: errMsg,
      });
    }
  }),
);

// ---------------------------------------------------------------------------
// GET /api/config/status — Health-Info
// ---------------------------------------------------------------------------

configRouter.get('/status', asyncHandler(async (_req: Request, res: Response) => {
  const defaults = wasteService.getLocationDefaults();
  res.json({
    status: 'ok',
    service: 'config',
    version: defaults.version,
    expiresAt: defaults.expiresAt,
    citiesSupported: defaults.cities.length,
    attribution: 'Kommunale Open-Data + OpenStreetMap — CC-BY 4.0 / ODbL',
  });
}));
