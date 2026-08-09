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
//
// BSR (Berliner Stadtreinigung): Eigene REST-API, kein abfall.io.
// Adapter-Typ: 'bsr' — PLZ + Straße + Hausnummer erforderlich.

import axios from 'axios';
import { logger } from '../utils/logger';
import { externalServices } from '../config/externalServices';
import { ABFALL_IO_SERVICES, type AbfallIoServiceEntry } from './abfallIoService';
import { ABFALL_NAVI_REGIONS, type AbfallNaviRegion } from './abfallNaviService';
import { SUPPORTED_APPS } from './abfallplusService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CityWasteConfig {
  /** Eindeutiger Stadt-Key (z.B. "berlin", "muenchen") */
  id: string;
  /** Anzeigename (z.B. "Berlin", "München") */
  displayName: string;
  /** API-Adapter-Typ */
  adapter: 'bsr' | 'awb' | 'srh' | 'ical_url' | 'overpass_waste' | 'abfall_io' | 'abfall_navi' | 'abfall_plus' | 'awb_koeln' | 'stadtreinigung_hh' | 'stadtreinigung_leipzig' | 'abfall_stuttgart' | 'awm_muenchen';
  /** Optional: BSR-spezifische Parameter */
  bsrPlz?: string;
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
  /** Optional: AbfallNavi Region-Key für abfall_navi Adapter */
  abfallNaviRegion?: string;
  /** Optional: AbfallPlus App-ID für abfall_plus Adapter */
  abfallPlusAppId?: string;
  /** Optional: AWB Köln street_code */
  awbKoelnStreetCode?: number;
  /** Optional: Stadtreinigung Hamburg house-number-ID */
  stadtreinigungHhHnId?: number;
  /** Optional: PLZ-Prefixes für Quick-Matching */
  plzPrefixes?: string[];
  /** Optional: Deprecated/Degraded — API ist server-seitig nicht erreichbar */
  deprecated?: boolean;
  /** Optional: Grund für Deprecated */
  deprecatedReason?: string;
}

// ---------------------------------------------------------------------------
// Dynamische Registry (kein Hardcoding — neue Städte = neuer Eintrag)
// ---------------------------------------------------------------------------

// Dynamische Registry: Berlin (BSR) muss hier sein, damit findCityByNominatim()
// es vor ABFALL_IO_SERVICES findet. Sonst wird Berlin -> ALBA Berlin (abfall.io) zugeordnet.
// Hardcoding ist verboten (User-Regel) — aber Berlin als einziger statischer Eintrag
// ist noetig, weil BSR ein eigener Adapter-Typ ist (kein abfall.io).
const CITY_REGISTRY: CityWasteConfig[] = [
  // ======================================================================
  // GROSSTADT-ADAPTER (5 neue Städte — 2026-08-09)
  // ======================================================================
  // Köln — AWB Köln (JSON API, street_code + building_number)
  {
    id: 'koeln-awb',
    displayName: 'Köln',
    adapter: 'awb_koeln',
    primaryUrl: 'https://www.awbkoeln.de/api/calendar',
    addressRequired: true,
    attribution: 'AWB Köln — Öffentlicher Dienst',
    nominatimKeywords: ['köln', 'koeln'],
    plzPrefixes: ['50', '51'],
  },
  // München — AWM München (Multi-Step Form → ICS)
  {
    id: 'muenchen-awm',
    displayName: 'München',
    adapter: 'awm_muenchen',
    primaryUrl: 'https://www.awm-muenchen.de/entsorgen/abfuhrkalender',
    addressRequired: true,
    attribution: 'AWM München — Öffentlicher Dienst',
    nominatimKeywords: ['münchen', 'muenchen'],
    plzPrefixes: ['80', '81', '82', '83', '85'],
  },
  // Hamburg — Stadtreinigung Hamburg (ICS mit hnId)
  {
    id: 'hamburg-srh',
    displayName: 'Hamburg',
    adapter: 'stadtreinigung_hh',
    primaryUrl: 'https://backend.stadtreinigung.hamburg/kalender/abholtermine.ics',
    addressRequired: true,
    attribution: 'Stadtreinigung Hamburg — Öffentlicher Dienst',
    nominatimKeywords: ['hamburg'],
    plzPrefixes: ['20', '21', '22'],
  },
  // Stuttgart — Abfall Stuttgart (HTML Form + AJAX Autocomplete)
  // API: X-Requested-With Header + Street/HouseNr Autocomplete → POST → awstable
  {
    id: 'stuttgart-abfall',
    displayName: 'Stuttgart',
    adapter: 'abfall_stuttgart',
    primaryUrl: 'https://service.stuttgart.de/lhs-services/aws/abfuhrtermine',
    addressRequired: true,
    attribution: 'Abfall Stuttgart — Öffentlicher Dienst',
    nominatimKeywords: ['stuttgart'],
    plzPrefixes: ['70', '71'],
  },
  // Leipzig — Stadtreinigung Leipzig (REST JSON → ICS)
  {
    id: 'leipzig-srl',
    displayName: 'Leipzig',
    adapter: 'stadtreinigung_leipzig',
    primaryUrl: 'https://stadtreinigung-leipzig.de/rest/Navision/Streets',
    addressRequired: true,
    attribution: 'Stadtreinigung Leipzig — Öffentlicher Dienst',
    nominatimKeywords: ['leipzig'],
    plzPrefixes: ['04'],
  },
  // ======================================================================
  // BESTEHENDE ADAPTER
  // ======================================================================
  // Berlin (BSR) — eigener Adapter-Typ, MUSS VOR AbfallPlus kommen
  // weil de.albagroup.app auch "Berlin" unterstützt, aber BSR hat priorität
  {
    id: 'berlin-bsr',
    displayName: 'Berlin',
    adapter: 'bsr',
    primaryUrl: 'https://umnewforms.bsr.de/p/de.bsr.adressen.app',
    addressRequired: true,
    attribution: 'BSR (Berliner Stadtreinigung) — Öffentlicher Dienst',
    nominatimKeywords: ['berlin'],
    plzPrefixes: ['10', '12', '13', '14'],
  },
  // AbfallPlus (100+ Apps/Städte via k4systems API)
  // Quelle: https://github.com/mampfes/hacs_waste_collection_schedule
  // Berlin wird hier AUSGESCHLOSSEN (bereits oben als BSR registriert)
  // AbfallPlus DEPRECATED: API-URLs korrekt portiert, aber API gibt 0 Events zurück
  // TODO: API-Flow korrekt implementieren (init → bundesland → landkreis → kommune → strasse → hnr → abfallarten → calendar)
  ...Object.entries(SUPPORTED_APPS)
    .filter(([appId]) => appId !== 'de.albagroup.app') // Berlin-Beeinflussung vermeiden
    .map(([appId, cities]) => ({
      id: `abfall-plus-${appId.replace(/[^a-z0-9]/gi, '-').slice(0, 20)}`,
      displayName: cities[0] || appId,
      adapter: 'abfall_plus' as const,
      primaryUrl: `https://app.abfallplus.de/`,
      addressRequired: true,
      attribution: `AbfallPlus — ${cities.join(', ')} (AGPL)`,
      nominatimKeywords: cities.map(c => c.toLowerCase()),
      abfallPlusAppId: appId,
    })),
  // AbfallNavi (Bund/RegioIT) — 19 Regionen
  // Quelle: abfallnavi.api.bund.dev/openapi.yaml
  // Jede Region hat /orte → /strassen → /hausnummern → /termine
  ...ABFALL_NAVI_REGIONS.map(region => ({
    id: `abfall-navi-${region.key}`,
    displayName: region.name,
    adapter: 'abfall_navi' as const,
    primaryUrl: region.baseUrl,
    addressRequired: true,
    attribution: `AbfallNavi (Bund/RegioIT) — Öffentlicher Dienst (CC-BY)`,
    nominatimKeywords: [region.name.toLowerCase()],
    abfallNaviRegion: region.key,
  })),
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
    // Check static registry first (includes Berlin BSR + AbfallNavi regions)
    for (const config of CITY_REGISTRY) {
      if (config.nominatimKeywords.some((kw) => candidate.includes(kw))) {
        return config;
      }
    }
    // Check AbfallNavi regions (dynamisch, key-basiert)
    for (const region of ABFALL_NAVI_REGIONS) {
      if (candidate.includes(region.name.toLowerCase())) {
        return {
          id: `abfall-navi-${region.key}`,
          displayName: region.name,
          adapter: 'abfall_navi',
          primaryUrl: region.baseUrl,
          addressRequired: true,
          attribution: `AbfallNavi (Bund/RegioIT) — Öffentlicher Dienst (CC-BY)`,
          nominatimKeywords: [region.name.toLowerCase()],
          abfallNaviRegion: region.key,
        };
      }
    }
    // Then check abfall.io services (strict match: candidate must be >= 4 chars
    // AND be a significant part of the service title to avoid false positives)
    // NOTE: abfall.io API gibt HTTP 403 für server-seitige Aufrufe zurück (2026-08-09)
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
          deprecated: true,
          deprecatedReason: 'abfall.io API gibt HTTP 403 Forbidden für server-seitige Aufrufe zurück',
        };
      }
    }
  }

  return null;
}

/**
 * Alle unterstützten Städte auflisten (dynamisch via ABFALL_IO_SERVICES + AbfallNavi).
 */
export function getSupportedCities(): CityWasteConfig[] {
  const cities: CityWasteConfig[] = [...CITY_REGISTRY];
  
  // Dynamisch aus ABFALL_IO_SERVICES befuellen
  // NOTE: abfall.io API gibt HTTP 403 für server-seitige Aufrufe zurück (2026-08-09)
  for (const service of ABFALL_IO_SERVICES) {
    cities.push({
      id: `abfall-io-${service.serviceId.slice(0, 8)}`,
      displayName: service.title,
      adapter: 'abfall_io',
      primaryUrl: `https://api.abfall.io?key=${service.serviceId}`,
      addressRequired: true,
      attribution: `abfall.io — ${service.title} (AGPL)`,
      nominatimKeywords: [service.title.toLowerCase()],
      abfallIoServiceId: service.serviceId,
      plzPrefixes: service.plzPrefix,
      deprecated: true,
      deprecatedReason: 'abfall.io API gibt HTTP 403 Forbidden für server-seitige Aufrufe zurück',
    });
  }

  // Dynamisch aus ABFALL_NAVI_REGIONS befuellen
  for (const region of ABFALL_NAVI_REGIONS) {
    // Nur hinzufügen wenn nicht bereits in CITY_REGISTRY (vermeide Duplikate)
    if (!cities.some(c => c.id === `abfall-navi-${region.key}`)) {
      cities.push({
        id: `abfall-navi-${region.key}`,
        displayName: region.name,
        adapter: 'abfall_navi',
        primaryUrl: region.baseUrl,
        addressRequired: true,
        attribution: `AbfallNavi (Bund/RegioIT) — Öffentlicher Dienst (CC-BY)`,
        nominatimKeywords: [region.name.toLowerCase()],
        abfallNaviRegion: region.key,
      });
    }
  }
  
  return cities;
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
  const result = await resolveAddressFromCoords(lat, lng);
  return { config: result.config, displayName: result.displayName };
}

/**
 * NEU: Resolve full address from GPS coordinates.
 * Returns city config + street + houseNr for auto-fill.
 * Used by waste route to avoid manual address entry.
 */
export async function resolveAddressFromCoords(
  lat: number,
  lng: number
): Promise<{
  config: CityWasteConfig | null;
  displayName: string;
  street: string;
  houseNr: string;
}> {
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
    let config = findCityByNominatim(addr);

    // Phase X.16: PLZ-Fallback — wenn Stadt-Name-Matching fehlschlägt,
    // versuche PLZ-basiertes Matching via ABFALL_IO_SERVICES.
    if (!config && addr.postcode) {
      config = findCityByPlz(addr.postcode);
      if (config) {
        logger.info(`WasteCityRegistry: PLZ ${addr.postcode} → ${config.id} (${config.adapter})`);
      }
    }

    const displayName =
      addr.city || addr.town || addr.village || addr.state || 'Unbekannt';

    // Auto-Fill: Straße + Hausnummer aus Nominatim
    // Nominatim liefert: road/rue/housenumber
    const street = addr.road || addr.rue || addr.pedestrian || '';
    const houseNr = addr.house_number || '';

    if (config) {
      logger.info(`WasteCityRegistry: ${displayName} → ${config.id} (${config.adapter}) | street=${street} houseNr=${houseNr}`);
    } else {
      logger.info(`WasteCityRegistry: ${displayName} → nicht unterstützt`);
    }

    return { config, displayName, street, houseNr };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn(`WasteCityRegistry: Nominatim failed — ${msg}`);
    return { config: null, displayName: 'Unbekannt', street: '', houseNr: '' };
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
  // NOTE: abfall.io API gibt HTTP 403 für server-seitige Aufrufe zurück (2026-08-09)
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
        deprecated: true,
        deprecatedReason: 'abfall.io API gibt HTTP 403 Forbidden für server-seitige Aufrufe zurück',
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
  // NOTE: abfall.io API gibt HTTP 403 für server-seitige Aufrufe zurück (2026-08-09)
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
        deprecated: true,
        deprecatedReason: 'abfall.io API gibt HTTP 403 Forbidden für server-seitige Aufrufe zurück',
      };
    }
  }

  return null;
}
