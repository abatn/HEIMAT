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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CityWasteConfig {
  /** Eindeutiger Stadt-Key (z.B. "berlin", "muenchen") */
  id: string;
  /** Anzeigename (z.B. "Berlin", "München") */
  displayName: string;
  /** API-Adapter-Typ */
  adapter: 'bsr' | 'awb' | 'srh' | 'ical_url' | 'overpass_waste';
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
}

// ---------------------------------------------------------------------------
// Dynamische Registry (kein Hardcoding — neue Städte = neuer Eintrag)
// ---------------------------------------------------------------------------

const CITY_REGISTRY: CityWasteConfig[] = [
  {
    id: 'berlin',
    displayName: 'Berlin',
    adapter: 'bsr',
    primaryUrl: externalServices.abfallBerlinPrimaryUrl,
    fallbackUrl: externalServices.abfallBerlinFallbackUrl,
    addressRequired: false,
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
    for (const config of CITY_REGISTRY) {
      if (config.nominatimKeywords.some((kw) => candidate.includes(kw))) {
        return config;
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
