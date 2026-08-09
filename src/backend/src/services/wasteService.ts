// ---------------------------------------------------------------------------
// wasteService — Phase B-2 Abfallkalender Backend-Service
//
// ARCHITEKTUR (ortsungebunden):
//   - 1 Public-API: getWasteCalendar(lat, lng, weeks?, street?, houseNr?)
//   - lat/lng → Nominatim Reverse-Geocode → Stadt-Erkennung
//   - Dynamische Adapter: ABFALL_IO_SERVICES (28+ Kommunen) + AbfallNavi (19 Regionen)
//   - 24h in-memory cache (key = city|street|houseNr)
//   - Constructor-DI für Axios-Instance
//   - KEINE hardcoded Städte — alles via GPS + dynamische Registry
//
// MOCK-POLICY: null fakes in production. Echtes axios.
// ---------------------------------------------------------------------------

import type { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { CITY_BOUNDS, resolveCity, CityNotSupportedError, type WasteCityKey, type CityBounds } from './wasteCityResolver';
import { type CityWasteConfig, getSupportedCities, findCityByPlz, findCityByName } from './wasteCityRegistry';
import { AbfallIoService, type AbfallIoResult } from './abfallIoService';
import { AbfallNaviService, type AbfallNaviResult } from './abfallNaviService';
import { AbfallPlusService, type AbfallPlusResult, SUPPORTED_APPS } from './abfallplusService';
import { BsrService, type BsrResult } from './bsrService';
import { AwbKoelnService } from './awbKoelnService';
import { StadtreinigungHhService } from './stadtreinigungHhService';
import { StadtreinigungLeipzigService } from './stadtreinigungLeipzigService';
import { AbfallStuttgartService } from './abfallStuttgartService';
import { AwmMuenchenService } from './awmMuenchenService';
import { parseIcsCalendar, type IcsEvent } from '../lib/icalParser';
import { externalServices } from '../config/externalServices';

// ------------------------------------------------------------------
// Public-Types
// ------------------------------------------------------------------

/**
 * AddressRequiredError: wird geworfen wenn city address-required ist
 * (Hamburg, München Phase 1) und keine street+houseNr im Request.
 * Route übersetzt das in HTTP 422.
 */
export class AddressRequiredError extends Error {
  readonly code = 'ADDRESS_REQUIRED';
  readonly city: WasteCityKey;
  readonly displayName: string;
  constructor(bounds: CityBounds) {
    super(
      `Abfallkalender für ${bounds.displayName} benötigt eine Adresse ` +
      `(Straße + Hausnummer). URL-Parameter: ?street=...&houseNr=...`,
    );
    this.city = bounds.city;
    this.displayName = bounds.displayName;
  }
}

export interface WasteCalendarEvent {
  /** ISO-8601 datetime 'YYYY-MM-DDTHH:mm:ss' */
  start: string;
  end?: string;
  summary: string;
  category?: string;
  location?: string;
}

export interface WasteCalendarResponse {
  /** Stadt-Key (lowercase ASCII fuer Konsistenz mit Routes) */
  city: WasteCityKey;
  /** Pretty-Name fuer Mobile-UI */
  displayName: string;
  /** Forwarded weeks parameter (1-8); future-dated events werden gefiltert. */
  weeks: number;
  /** Empty-list ist OK: z.B. wenn kein Event im Fenster liegt. */
  events: WasteCalendarEvent[];
  /** Welche URL hat tatsächlich geliefert (BSR / BSR-Fallback / etc) */
  source: string;
  /** ISO-8601 timestamp of the upstream-fetch (cache-stability-debug) */
  fetchedAt: string;
  /** True wenn aus dem 24h-Cache gelesen (kein upstream call) */
  cached: boolean;
  /** Status fuer Mobile-UI (DH immer 'ok' bei Antwort, 'error' bei Fehler) */
  status: 'ok' | 'error';
}

// ------------------------------------------------------------------
// Per-City URL-Strategie
// ------------------------------------------------------------------

interface CityFetchUrls {
  primary: string;
  fallback?: string;
  /** Whether the city requires street + houseNr params (dynamisch per city config) */
  addressRequired: boolean;
  /** Per-city attribution string (CC-BY license is mandatory) */
  attribution: string;
}

// ---------------------------------------------------------------------------
// KEIN hardcoded roster mehr!
// Alle Stadt-Daten kommen aus wasteCityRegistry.ts (dynamisch, ortsungebunden).
// Neue Städte = neuer Eintrag in der Registry, KEIN Code-Change nötig.
// ---------------------------------------------------------------------------

// ------------------------------------------------------------------
// Service-Class
// ------------------------------------------------------------------

export class WasteService {
  private readonly cache = new Map<string, { data: WasteCalendarResponse; at: number }>();
  private readonly cacheTtlMs = 24 * 60 * 60 * 1000; // 24 Stunden
  private readonly userAgent = externalServices.userAgent;
  // Constructor-DI (mirror weatherService.ts post-Phase-E)
  constructor(private readonly http: AxiosInstance) {}

  /**
   * Public-API: Hole Waste-Calendar für die nächsten N Wochen.
   *
   * @param lat  Koordinate Breitengrad
   * @param lng  Koordinate Laengengrad
   * @param weeks Forward-Window: 1-8 Wochen, default 4. Filtered alle VEVENT
   *             deren start-Datum mehr als `weeks*7` Tage in der Zukunft liegt
   *             werden aus der Antwort entfernt.
   * @param street  Optional (je nach Stadt REQUIRED — wird dynamisch erkannt)
   * @param houseNr  Optional (je nach Stadt REQUIRED — wird dynamisch erkannt)
   */
  async getWasteCalendar(
    lat: number,
    lng: number,
    weeks: number = 4,
    street?: string,
    houseNr?: string,
    scheduleId?: string,
  ): Promise<WasteCalendarResponse> {
    // 1. City-Resolver (dynamic via Nominatim — no hardcoding)
    const cityConfig = await resolveCity(lat, lng);

    // 1b. Check if primary URL is empty (deactivated city)
    if (!cityConfig.primaryUrl) {
      throw new Error(
        `Abfallkalender für ${cityConfig.displayName} ist derzeit nicht verfügbar. ` +
        `Die externe API hat sich geändert. Wir arbeiten an einer Lösung.`
      );
    }

    // 1c. Check if city is deprecated (e.g. abfall.io HTTP 403)
    if (cityConfig.deprecated) {
      logger.warn(`WasteService: ${cityConfig.displayName} ist deprecated — ${cityConfig.deprecatedReason}`);
      throw new Error(
        `Abfallkalender für ${cityConfig.displayName} ist derzeit nicht verfügbar. ` +
        `${cityConfig.deprecatedReason}. ` +
        `Bitte versuche es später erneut oder kontaktiere den Support.`
      );
    }

    // 2. Address-Required Check (dynamic per city config)
    // BSR: scheduleId ist eine Alternative zu street+houseNr
    // AbfallNavi: street ALLEIN reicht (houseNr optional — API sucht nächste Hausnummer)
    const hasAddress = street && street.length > 0;
    const hasScheduleId = scheduleId && scheduleId.length >= 20;
    if (cityConfig.addressRequired && !hasAddress && !hasScheduleId) {
      throw new AddressRequiredError({ city: cityConfig.id as WasteCityKey, displayName: cityConfig.displayName, minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 });
    }

    // 3. Cache-Key
    const cacheKey = this.buildCacheKey(cityConfig.id, street, houseNr, weeks);

    // 4. Cache-Read
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.at < this.cacheTtlMs) {
      return { ...cached.data, cached: true };
    }

    // 5. Adapter-specific handling
    const fetchedAt = new Date().toISOString();
    let source = cityConfig.primaryUrl;
    let events: IcsEvent[] = [];

    // abfall.io Adapter: Multi-Step API (init → strasse → export_ics)
    if (cityConfig.adapter === 'abfall_io' && cityConfig.abfallIoServiceId) {
      const abfallIo = new AbfallIoService(this.http);
      try {
        const result = await abfallIo.fetchCalendar(
          cityConfig.abfallIoServiceId,
          street,
          houseNr,
        );
        events = result.events;
        source = result.source;
      } catch (err) {
        logger.error(`WasteService: abfall.io failed for ${cityConfig.displayName}: ${(err as Error).message}`);
        throw err;
      }
    } else if (cityConfig.adapter === 'bsr') {
      // BSR (Berliner Stadtreinigung) Adapter: ICS-Endpoint
      // Benötigt: schedule_id (24-stelliger Code von www.bsr.de/abfuhrkalender)
      if (!scheduleId) {
        throw new Error(
          `Abfallkalender für ${cityConfig.displayName} benötigt eine schedule_id. ` +
          `Bitte besuche www.bsr.de/abfuhrkalender, gib deine Adresse ein, ` +
          `und kopiere den 24-stelligen Code aus dem ICS-Download-Link.`
        );
      }
      const bsr = new BsrService(this.http);
      try {
        const result = await bsr.fetchCalendar(scheduleId, weeks);
        events = result.events;
        source = result.source;
      } catch (err) {
        logger.error(`WasteService: BSR failed for ${cityConfig.displayName}: ${(err as Error).message}`);
        throw err;
      }
    } else if (cityConfig.adapter === 'abfall_navi' && cityConfig.abfallNaviRegion) {
      // AbfallNavi (Bund) Adapter: Staatliche API
      const abfallNavi = new AbfallNaviService(this.http);
      try {
        const result = await abfallNavi.fetchCalendar(
          cityConfig.abfallNaviRegion,
          street || '',
          houseNr || '',
          weeks,
        );
        events = result.events;
        source = result.source;
      } catch (err) {
        logger.error(`WasteService: AbfallNavi failed for ${cityConfig.displayName}: ${(err as Error).message}`);
        throw err;
      }
    } else if (cityConfig.adapter === 'abfall_plus' && cityConfig.abfallPlusAppId) {
      // AbfallPlus Adapter: k4systems API (100+ Apps/Städte)
      const abfallPlus = new AbfallPlusService(cityConfig.abfallPlusAppId);
      try {
        const result = await abfallPlus.fetchCalendar(
          street || '',
          houseNr || '',
          weeks,
        );
        events = result.events.map(e => ({
          start: e.date + 'T00:00:00',
          summary: e.summary,
          category: e.wasteType,
        }));
        source = result.source || 'AbfallPlus';
      } catch (err) {
        logger.error(`WasteService: AbfallPlus failed for ${cityConfig.displayName}: ${(err as Error).message}`);
        throw err;
      }
    } else if (cityConfig.adapter === 'awb_koeln') {
      // AWB Köln: Streets-Lookup → street_code, dann Calendar
      // Benötigt: Straßennamen + Hausnummer (WERDE automatisch in AwbKoelnService nachgeschlagen)
      if (!street) {
        throw new Error(
          `Abfallkalender für ${cityConfig.displayName} benötigt eine Straße + Hausnummer. ` +
          `URL-Parameter: ?street=...&houseNr=...`
        );
      }
      const awbKoeln = new AwbKoelnService(street, houseNr || '1');
      try {
        const result = await awbKoeln.fetchCalendar(weeks);
        events = result.events.map(e => ({
          start: e.date + 'T00:00:00',
          summary: e.summary,
          category: e.wasteType,
        }));
        source = result.source || 'AWB Köln';
      } catch (err) {
        logger.error(`WasteService: AWB Köln failed: ${(err as Error).message}`);
        throw err;
      }
    } else if (cityConfig.adapter === 'stadtreinigung_hh') {
      // Stadtreinigung Hamburg: ICS mit hnId
      // Benötigt: houseNr als hnId (Oder Straße → Lookup nötig)
      // Fürs Erste: houseNr wird direkt als hnId verwendet
      const hnId = parseInt(houseNr || '0', 10) || 0;
      if (!hnId) {
        throw new Error(
          `Abfallkalender für ${cityConfig.displayName} benötigt eine Hausnummer-ID (hnId). ` +
          `URL-Parameter: ?houseNr=<hnId> (z.B. 53814 für Zabelweg 1B)`
        );
      }
      const hh = new StadtreinigungHhService(hnId);
      try {
        const result = await hh.fetchCalendar(weeks);
        events = result.events;
        source = result.source || 'Stadtreinigung Hamburg';
      } catch (err) {
        logger.error(`WasteService: Stadtreinigung HH failed: ${(err as Error).message}`);
        throw err;
      }
    } else if (cityConfig.adapter === 'stadtreinigung_leipzig') {
      // Stadtreinigung Leipzig: REST JSON → ICS
      if (!street) {
        throw new Error(
          `Abfallkalender für ${cityConfig.displayName} benötigt eine Straße. ` +
          `URL-Parameter: ?street=...&houseNr=...`
        );
      }
      const leipzig = new StadtreinigungLeipzigService(street, houseNr || '');
      try {
        const result = await leipzig.fetchCalendar(weeks);
        events = result.events;
        source = result.source || 'Stadtreinigung Leipzig';
      } catch (err) {
        logger.error(`WasteService: Stadtreinigung Leipzig failed: ${(err as Error).message}`);
        throw err;
      }
    } else if (cityConfig.adapter === 'abfall_stuttgart') {
      // Abfall Stuttgart: HTML Form → Tabelle
      if (!street) {
        throw new Error(
          `Abfallkalender für ${cityConfig.displayName} benötigt eine Straße. ` +
          `URL-Parameter: ?street=...&houseNr=...`
        );
      }
      const stuttgart = new AbfallStuttgartService(street, houseNr || '');
      try {
        const result = await stuttgart.fetchCalendar(weeks);
        events = result.events.map(e => ({
          start: e.date + 'T00:00:00',
          summary: e.summary,
          category: e.wasteType,
        }));
        source = result.source || 'Abfall Stuttgart';
      } catch (err) {
        logger.error(`WasteService: Abfall Stuttgart failed: ${(err as Error).message}`);
        throw err;
      }
    } else if (cityConfig.adapter === 'awm_muenchen') {
      // AWM München: Multi-Step Form → ICS
      if (!street) {
        throw new Error(
          `Abfallkalender für ${cityConfig.displayName} benötigt eine Straße. ` +
          `URL-Parameter: ?street=...&houseNr=...`
        );
      }
      const muenchen = new AwmMuenchenService(street, houseNr || '');
      try {
        const result = await muenchen.fetchCalendar(weeks);
        events = result.events;
        source = result.source || 'AWM München';
      } catch (err) {
        logger.error(`WasteService: AWM München failed: ${(err as Error).message}`);
        throw err;
      }
    } else {
    // Standard iCal Adapter: URL-Based fetch
    const urlFor = (template: string) =>
      template.replace('{street}', encodeURIComponent(street || '')).replace('{houseNr}', encodeURIComponent(houseNr || ''));

    // Mirror-Fetch: primary → (NUR auf recoverable-Failure) fallback
    // WICHTIG: nur 5xx/429/ECONNREFUSED/ECONNABORTED/ETIMEDOUT loesen fallback
    // aus. 4xx sind Client-Fehler (z.B. address-bad-encoded) und sollen
    // nicht den fallback-Endpoint treffen (würde nur 4xx wiederholen).

    try {
      events = await this.fetchIcs(urlFor(cityConfig.primaryUrl), cityConfig.id);
    } catch (primaryErr) {
      if (!this.shouldFailover(primaryErr) || !cityConfig.fallbackUrl) {
        throw primaryErr;
      }
      logger.warn(`WasteService: ${cityConfig.id} primary failed (recoverable), attempting fallback: ${(primaryErr as Error).message}`);
      source = cityConfig.fallbackUrl;
      try {
        events = await this.fetchIcs(urlFor(cityConfig.fallbackUrl), cityConfig.id);
      } catch (fallbackErr) {
        logger.error(
          `WasteService: ${cityConfig.id} both mirrors failed. ` +
          `primary=${(primaryErr as Error).message} | fallback=${(fallbackErr as Error).message}`,
        );
        throw primaryErr;
      }
    }
    } // end else (standard iCal adapter)

    // 7. Forward-Filter (events must be within `weeks*7` days)
    const filtered = this.filterByWeeks(events, weeks);

    const response: WasteCalendarResponse = {
      city: cityConfig.id,
      displayName: cityConfig.displayName,
      weeks,
      events: filtered.map((e) => ({
        start: e.start,
        ...(e.end ? { end: e.end } : {}),
        summary: e.summary,
        ...(e.category ? { category: e.category } : {}),
        ...(e.location ? { location: e.location } : {}),
      })),
      source,
      fetchedAt,
      cached: false,
      status: 'ok',
    };

    // 8. Cache-Write
    this.cache.set(cacheKey, { data: response, at: Date.now() });

    return response;
  }

  /** Get service-status metadata (used by /api/waste/status route). */
  getStatus(): {
    service: 'waste';
    cities: { city: WasteCityKey; displayName: string; addressRequired: boolean; attribution: string; deprecated?: boolean; deprecatedReason?: string }[];
    cacheEntries: number;
  } {
    const cities = getSupportedCities();
    return {
      service: 'waste',
      cities: cities.map((c: CityWasteConfig) => ({
        city: c.id as WasteCityKey,
        displayName: c.displayName,
        addressRequired: c.addressRequired,
        attribution: c.attribution,
        ...(c.deprecated ? { deprecated: true, deprecatedReason: c.deprecatedReason } : {}),
      })),
      cacheEntries: this.cache.size,
    };
  }

  /**
   * Public lookup for per-city attribution string (CC-BY license text).
   */
  getAttribution(city: WasteCityKey): string {
    const cities = getSupportedCities();
    const found = cities.find((c: CityWasteConfig) => c.id === city);
    return found?.attribution || 'Unknown';
  }

  /**
   * Phase X.3b: GET /api/config/location-defaults endpoint-Backend.
   *
   * Liefert die BBox + addressRequired + Attribution pro Stadt dynamisch
   * an Mobile (vorher hardcoded in waste_provider.dart). Elimiiniert
   * hardcoded bboxes aus Mobile und konsolidiert hier.
   *
   * AGPL-defensiv: KEIN iCal-URL (primaryUrl) im Response. Mobile kann
   * nicht die BSR/SRH/AWB-Endpoints direkt hitten, sondern muss via
   * unser /api/waste/calendar-Backend-Wrapper gehen.
   *
   * version: Bumped bei breaking changes (e.g. neue Stadt hinzu).
   * expiresAt: ISO-8601 timestamp 24h from now (Mobile cache-TTL).
   */
  getLocationDefaults(): {
    version: string;
    expiresAt: string;
    cities: Array<{
      name: WasteCityKey;
      displayName: string;
      bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
      addressRequired: boolean;
      attribution: string;
    }>;
  } {
    return {
      version: '1.0',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      cities: getSupportedCities().map((c: CityWasteConfig) => ({
        name: c.id as WasteCityKey,
        displayName: c.displayName,
        bbox: { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 }, // Dynamic — no hardcoding
        addressRequired: c.addressRequired,
        attribution: c.attribution,
      })),
    };
  }

  // --------------------------------------------------------------
  // Internals
  // --------------------------------------------------------------

  private async fetchIcs(url: string, city: WasteCityKey): Promise<IcsEvent[]> {
    const response = await this.http.get(url, {
      headers: { 'User-Agent': this.userAgent, Accept: 'text/calendar' },
      responseType: 'text',
      timeout: 15000,
    });
    const rawText = typeof response.data === 'string' ? response.data : String(response.data ?? '');
    const parsed = parseIcsCalendar(rawText);
    if (parsed.events.length === 0) {
      throw new Error(`WasteService/${city}: upstream returned 0 parseable events (URL=${url})`);
    }
    return parsed.events;
  }

  /**
   * Mirror-failover decision: Only on 5xx, ECONNREFUSED, ECONNABORTED, ETIMEDOUT, OR `getAxiErrorStatus >= 500`. NOT on 4xx — 4xx sind user/coder-Fehler.
   */
  private static readonly mirrorFailoverStatuses = new Set([502, 503, 504, 429]);

  private shouldFailover(e: unknown): boolean {
    // Type-narrowing ohne TypeScript-Cast: any-typed access für axios-error
    const err = e as { response?: { status?: number }; code?: string; message?: string };
    if (err.response?.status && WasteService.mirrorFailoverStatuses.has(err.response.status)) {
      return true;
    }
    if (err.code && ['ECONNREFUSED', 'ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'].includes(err.code)) {
      return true;
    }
    return false;
  }

  private filterByWeeks(events: IcsEvent[], weeks: number): IcsEvent[] {
    const cutoffMs = Date.now() + weeks * 7 * 24 * 60 * 60 * 1000;
    return events.filter((e) => {
      const t = Date.parse(e.start);
      return isFinite(t) && t <= cutoffMs;
    }).sort((a, b) => a.start.localeCompare(b.start));
  }

  private buildCacheKey(city: WasteCityKey, street?: string, houseNr?: string, weeks: number = 4): string {
    // URL-Normalisierung: lower-case + trim + Unicode-NFC (komposierte Form).
    // Damit bekommen 'Straße' und 'Strasse' und 'straße' alle den gleichen
    // Cache-Key, obwohl sie unterschiedliche input-representationen sind.
    // Ohne Normalisierung wuerden 3 separate Cache-Eintraege entstehen,
    // obwohl alle 3 dieselbe upstream-URL treffen (nach encodeURIComponent).
    // NFC normalisiert 'STRASSE' + 'ß' = 'STRASSE + ss-Rendering' → 'strasse'.
    const normStreet = (street || '').toLowerCase().trim().normalize('NFC');
    const normHouseNr = (houseNr || '').toLowerCase().trim().normalize('NFC');
    return `${city}|${normStreet || 'default'}|${normHouseNr || 'default'}|${weeks}`;
  }

  private requireCityKeyName(city: WasteCityKey): string {
    // Dynamisch aus Registry — kein Hardcoding
    const cities = getSupportedCities();
    const found = cities.find((c) => c.id === city);
    return found?.displayName || city;
  }

  /**
   * Extract PLZ from Nominatim reverse geocode for BSR adapter.
   * BSR requires PLZ + Street + House number.
   */
  private async extractPlzFromCoords(lat: number, lng: number): Promise<string | null> {
    try {
      const response = await this.http.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          lat,
          lon: lng,
          format: 'jsonv2',
          addressdetails: 1,
          'accept-language': 'de',
        },
        timeout: 5000,
        headers: {
          'User-Agent': externalServices.userAgent,
        },
      });

      const addr = response.data?.address || {};
      return addr.postcode || null;
    } catch (error) {
      logger.warn(`WasteService: Nominatim PLZ extraction failed: ${(error as Error).message}`);
      return null;
    }
  }
}
