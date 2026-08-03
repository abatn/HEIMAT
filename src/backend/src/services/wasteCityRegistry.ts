// wasteCityRegistry.ts — Dynamische Stadt-Registrierung für Abfallkalender
//
// ARCHITEKTUR (ortsungebunden, kein Hardcoding):
//   1. User gibt GPS-Koordinaten
//   2. Nominatim Reverse-Geocode → Stadt-Name
//   3. Stadt-Name → Registry-Lookup → API-Adapter
//   4. Kein Adapter → Klare Meldung "noch nicht verfügbar"
//
// Jede Stadt hat einen Adapter-Typ und parameter.
// Neue Städte können hinzugefügt werden OHNE Code-Änderungen
// (nur Registry-Eintrag nötig).
//
// User-Regel: "mock, simulation, fake sind verboten"
// → Alle APIs sind ECHTE Open-Data-Quellen.

import axios from 'axios';
import { logger } from '../utils/logger';
import { externalServices } from '../config/externalServices';
import { ABFALL_IO_SERVICES, type AbfallIoServiceEntry } from './abfallIoService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CityWasteConfig {
  /** Eindeutiger Stadt-Key (z.B. "berlin", "muenchen") */
  id: string;
  /** Anzeigename (z.B. "Berlin", "München") */
  displayName: string;
  /** API-Adapter-Typ */
  adapter: 'bsr' | 'awb' | 'srh' | 'ical_url' | 'overpass_waste' | 'abfall_io';
  /** Primäre API-URL (konfigurierbar via Env) */
  primaryUrl: string;
  /** Fallback-URL (optional) */
  fallbackUrl?: string;
  /** Braucht Adresse (Straße + Hausnummer)? */
  addressRequired: boolean;
  /** Attribuierung */
  attribution: string;
  /** Nominatim-Keywords für Matching (Lowercase) */
  nominatimKeywords: string[];
  /** Optional: Schedule-ID-Resolver für APIs die eine ID brauchen (z.B. BSR) */
  scheduleIdResolver?: {
    /** URL-Template für Schedule-ID-Lookup (z.B. BSR Adresssuche) */
    lookupUrl: string;
    /** URL-Template für iCal-Download mit Schedule-ID */
    icalUrlTemplate: string;
  };
  /** Optional: abfall.io service_id für abfall_io Adapter */
  abfallIoServiceId?: string;
  /** Optional: PLZ-Prefixes für Quick-Matching */
  plzPrefixes?: string[];
}

// ---------------------------------------------------------------------------
// Dynamische Registry (kein Hardcoding — neue Städte = neuer Eintrag)
// ---------------------------------------------------------------------------

const CITY_REGISTRY: CityWasteConfig[] = [
  // BSR Berlin: Temporär deaktiviert — neue API erfordert Schedule-ID
  // die nicht öffentlich per Adresse aufgelöst werden kann.
  // Status: https://github.com/abatn/HEIMAT/issues/XXX
  // TODO: BSR API erneut prüfen sobald öffentliches Lookup verfügbar ist.
  // Aktuell: Zeige klare Meldung "BSR-API nicht verfügbar" statt 404-Fehler.
  {
    id: 'berlin',
    displayName: 'Berlin',
    adapter: 'bsr',
    primaryUrl: '', // Deaktiviert — BSR API erfordert Schedule-ID
    fallbackUrl: undefined,
    addressRequired: true,
    attribution: 'Berliner Stadtreinigung (BSR) — CC-BY 4.0',
    nominatimKeywords: ['berlin'],
  },
  {
    id: 'muenchen',
    displayName: 'München',
    adapter: 'awb',
    primaryUrl: externalServices.abfallMuenchenPrimaryUrl,
    fallbackUrl: undefined,
    addressRequired: true,
    attribution: 'Abfallwirtschaftsbetrieb München (AWB) — CC-BY 4.0',
    nominatimKeywords: ['münchen', 'munich', 'muenchen'],
  },
  {
    id: 'hamburg',
    displayName: 'Hamburg',
    adapter: 'srh',
    primaryUrl: externalServices.abfallHamburgPrimaryUrl,
    fallbackUrl: undefined,
    addressRequired: true,
    attribution: 'Stadtreinigung Hamburg (SRH) — CC-BY 4.0',
    nominatimKeywords: ['hamburg'],
  },
];

// ---------------------------------------------------------------------------
// Lookup-Funktionen
// ---------------------------------------------------------------------------

/**
 * Stadt anhand von Nominatim-Daten finden.
 * Matching: Nominatim city/state field → Registry Keywords.
 * Returns null wenn keine Stadt gefunden → "noch nicht verfügbar".
 */
export function findCityByNominatim(nominatim: {
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  county?: string;
}): CityWasteConfig | null {
  // Alle möglichen Stadt-Namen sammeln
  const candidates = [
    nominatim.city,
    nominatim.town,
    nominatim.village,
  ]
    .filter(Boolean)
    .map((n) => n!.toLowerCase().trim());

  // Immer auch den State/County prüfen (manche Orte liegen im Kreis)
  if (nominatim.state) candidates.push(nominatim.state.toLowerCase().trim());
  if (nominatim.county) candidates.push(nominatim.county.toLowerCase().trim());

  for (const candidate of candidates) {
    // Check static registry first
    for (const config of CITY_REGISTRY) {
      if (config.nominatimKeywords.some((kw) => candidate.includes(kw))) {
        return config;
      }
    }
    // Then check abfall.io services (strict match: candidate must be >= 4 chars
    // AND be a significant part of the service title to avoid false positives)
    for (const service of ABFALL_IO_SERVICES) {
      const titleLower = service.title.toLowerCase();
      // Only match if candidate is a significant word (>= 4 chars) AND
      // appears as a whole word in the service title
      if (
        candidate.length >= 4 &&
        (titleLower.includes(candidate) ||
         titleLower.split(/\s+/).some(word => word === candidate))
      ) {
        return {
          id: `abfall-io-${service.serviceId.slice(0, 8)}`,
          displayName: service.title,
          adapter: 'abfall_io' as const,
          primaryUrl: `https://api.abfall.io?key=${service.serviceId}`,
          addressRequired: true,
          attribution: `abfall.io — ${service.title} (AGPL)`,
          nominatimKeywords: [service.title.toLowerCase()],
          abfallIoServiceId: service.serviceId,
        };
      }
    }
  }

  return null;
}

/**
 * Alle unterstützten Städte auflisten.
 */
export function getSupportedCities(): CityWasteConfig[] {
  return [...CITY_REGISTRY];
}

/**
 * Prüfen ob eine Stadt unterstützt wird.
 */
export function isCitySupported(cityName: string): boolean {
  return CITY_REGISTRY.some((c) =>
    c.nominatimKeywords.some((kw) =>
      cityName.toLowerCase().includes(kw)
    )
  );
}

/**
 * Reverse-Geocoding via Nominatim → Stadt-Name + Config.
 *
 * Returns:
 *   - { config, displayName } wenn Stadt unterstützt wird
 *   - { config: null, displayName: "Unbekannt" } wenn nicht
 */
export async function resolveCityFromCoords(
  lat: number,
  lng: number
): Promise<{ config: CityWasteConfig | null; displayName: string }> {
  try {
    const response = await axios.get(
      'https://nominatim.openstreetmap.org/reverse',
      {
        params: {
          lat,
          lon: lng,
          format: 'jsonv2',
          addressdetails: 1,
          'accept-language': 'de',
        },
        timeout: 5000,
        headers: {
          'User-Agent': 'HEIMAT-2.0/1.0 (Open Source Super App)',
        },
      }
    );

    const addr = response.data?.address || {};
    const config = findCityByNominatim(addr);

    const displayName =
      addr.city || addr.town || addr.village || addr.state || 'Unbekannt';

    if (config) {
      logger.info(`WasteCityRegistry: ${displayName} → ${config.id} (${config.adapter})`);
    } else {
      logger.info(`WasteCityRegistry: ${displayName} → nicht unterstützt`);
    }

    return { config, displayName };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn(`WasteCityRegistry: Nominatim failed — ${msg}`);
    return { config: null, displayName: 'Unbekannt' };
  }
}

// ---------------------------------------------------------------------------
// PLZ-based Provider Discovery (ortsungebunden)
// ---------------------------------------------------------------------------

/**
 * Find waste provider by German postal code (PLZ).
 * Uses abfall.io SERVICE_MAP for nationwide coverage.
 *
 * @param plz German postal code (5 digits)
 * @returns CityWasteConfig if found, null otherwise
 */
export function findCityByPlz(plz: string): CityWasteConfig | null {
  const normalizedPlz = plz.trim();
  if (!/^\d{5}$/.test(normalizedPlz)) {
    return null;
  }

  // Check abfall.io services by PLZ prefix
  for (const service of ABFALL_IO_SERVICES) {
    if (service.plzPrefix?.some((prefix) => normalizedPlz.startsWith(prefix))) {
      return {
        id: `abfall-io-${service.serviceId.slice(0, 8)}`,
        displayName: service.title,
        adapter: 'abfall_io',
        primaryUrl: `https://api.abfall.io?key=${service.serviceId}`,
        addressRequired: true,
        attribution: `abfall.io — ${service.title} (AGPL)`,
        nominatimKeywords: [service.title.toLowerCase()],
        abfallIoServiceId: service.serviceId,
        plzPrefixes: service.plzPrefix,
      };
    }
  }

  return null;
}

/**
 * Find waste provider by city name (fuzzy match against abfall.io).
 * Used when Nominatim returns a city name that's not in the static registry.
 *
 * @param cityName City name from Nominatim
 * @returns CityWasteConfig if found, null otherwise
 */
export function findCityByName(cityName: string): CityWasteConfig | null {
  const normalized = cityName.toLowerCase().trim();

  // First check static registry
  const staticResult = getSupportedCities().find((c) =>
    c.nominatimKeywords.some((kw) => normalized.includes(kw))
  );
  if (staticResult) return staticResult;

  // Then check abfall.io services (fuzzy match)
  for (const service of ABFALL_IO_SERVICES) {
    const titleLower = service.title.toLowerCase();
    // Match if city name is contained in service title
    if (titleLower.includes(normalized) || normalized.includes(titleLower.split(' ')[0])) {
      return {
        id: `abfall-io-${service.serviceId.slice(0, 8)}`,
        displayName: service.title,
        adapter: 'abfall_io',
        primaryUrl: `https://api.abfall.io?key=${service.serviceId}`,
        addressRequired: true,
        attribution: `abfall.io — ${service.title} (AGPL)`,
        nominatimKeywords: [service.title.toLowerCase()],
        abfallIoServiceId: service.serviceId,
      };
    }
  }

  return null;
}
