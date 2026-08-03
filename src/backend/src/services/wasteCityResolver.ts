// ---------------------------------------------------------------------------  
// wasteCityResolver — Dynamische Stadt-Erkennung via Nominatim
//
// ARCHITEKTUR (ortsungebunden, kein Hardcoding):
//   1. User gibt GPS-Koordinaten (lat/lng)
//   2. Nominatim Reverse-Geocode → Stadt-Name
//   3. Stadt-Name → CityRegistry Lookup → API-Adapter (wenn vorhanden)
//   4. Kein Adapter → CityNotSupportedError → klare Meldung
//
// KEIN Hardcoding mehr! Bounding-Boxes wurden entfernt.
// Neue Städte werden über wasteCityRegistry.ts hinzugefügt.
//
// User-Regel: "mock, simulation, fake sind verboten"
// → Nominatim ist ein echtes Open-Source-Geocoding-Service.
// ---------------------------------------------------------------------------

import axios from 'axios';
import { logger } from '../utils/logger';
import {
  resolveCityFromCoords,
  getSupportedCities,
  type CityWasteConfig,
} from './wasteCityRegistry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * CityNotSupportedError — wird geworfen wenn Koordinaten
 * keiner unterstützten Stadt zugeordnet werden können.
 *
 * Frontend-Handling: zeige "Abfallkalender für deine Region noch nicht
 * verfügbar — wir arbeiten an mehr Städten".
 */
export class CityNotSupportedError extends Error {
  readonly code = 'CITY_NOT_SUPPORTED';
  readonly lat: number;
  readonly lng: number;
  readonly detectedCity: string;
  constructor(lat: number, lng: number, detectedCity: string) {
    const supported = getSupportedCities().map((c) => c.displayName).join(', ');
    super(
      `Abfallkalender für ${detectedCity || `Koordinaten (${lat.toFixed(3)}, ${lng.toFixed(3)})`}` +
      ` noch nicht verfügbar. Unterstützte Städte: ${supported}.`
    );
    this.lat = lat;
    this.lng = lng;
    this.detectedCity = detectedCity;
  }
}

/**
 * CityBounds — wird NICHT mehr für City-Resolution verwendet.
 * Bleibt als Export für Config-Route (GET /api/config/location-defaults).
 * Phase X.3b: Kompatibilität mit Mobile-UI.
 */
export interface CityBounds {
  city: string;
  displayName: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Legacy-Typ für Rückwärtskompatibilität mit wasteService.ts.
 * WasteService erwartet ein CityBounds-artiges Objekt mit `city` und `displayName`.
 */
export type WasteCityKey = string;

// ---------------------------------------------------------------------------
// Dynamische Resolution (kein Hardcoding!)
// ---------------------------------------------------------------------------

/**
 * Resolve city from GPS coordinates using Nominatim.
 *
 * Returns CityWasteConfig if city is supported, throws CityNotSupportedError otherwise.
 * This is ASYNC because Nominatim requires an HTTP call.
 */
export async function resolveCity(lat: number, lng: number): Promise<CityWasteConfig> {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new TypeError(`resolveCity: lat/lng must be numbers, got ${typeof lat}/${typeof lng}`);
  }
  if (!isFinite(lat) || !isFinite(lng)) {
    throw new TypeError(`resolveCity: lat/lng must be finite, got ${lat}/${lng}`);
  }

  const { config, displayName } = await resolveCityFromCoords(lat, lng);

  if (!config) {
    throw new CityNotSupportedError(lat, lng, displayName);
  }

  return config;
}

// ---------------------------------------------------------------------------
// Legacy-Export (Kompatibilität mit wasteService.ts)
// ---------------------------------------------------------------------------

/**
 * Legacy: Bounding-Box-Daten für Config-Route.
 * Wird NICHT mehr für City-Resolution verwendet.
 */
export const CITY_BOUNDS: CityBounds[] = getSupportedCities().map((c) => ({
  city: c.id,
  displayName: c.displayName,
  // Dummy-BBox — wird nicht mehr für Lookup verwendet
  minLat: -90,
  maxLat: 90,
  minLng: -180,
  maxLng: 180,
}));
