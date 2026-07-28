// ---------------------------------------------------------------------------
// wasteService — Phase B-2 Abfallkalender Backend-Service
//
// ARCHITEKTUR (Gemini-Design Phase B-2):
//   - 1 Public-API: getWasteCalendar(lat, lng, weeks?, street?, houseNr?)
//   - lat/lng → city-resolver (statisches Bounding-Box, 0 external deps)
//   - 3 Städte mit unterschiedlichen URL-Patterns (KEIN einfaches OpenWeather-
//     Mirror-Pattern! jede Stadt hat ihren eigenen iCal-Endpoint)
//   - Per-Stadt: PRIMARY URL + 1 FALLBACK URL
//   - 24h in-memory cache (key = city|street|houseNr; weekly schedules ändern
//     sich nicht stündlich — vs. 5min cache bei weather/airQuality)
//   - Constructor-DI für Axios-Instance — pattern-mirror zu weatherService.ts
//     (Post-Phase-E-Refactor: alle Mirror-Fallback-Services nutzen DI)
//   - Hamburg + München: optionales address_required-error (response: 422
//     in route) — Phase 1 ohne Adress-Lookup-Workflow nur Skeleton.
//
// MOCK-POLICY (GEMINI Klarstellung): null fakes in production. Echtes axios.
// Tests mocken die HTTP-Schicht via Constructor-DI (mirror weatherService.test.ts).
//
// URL-STRATEGY (PHASE 1):
//   Berlin BSR primary:    konfigurierbar via ABFALL_BSR_URL_BASE env (TODO).
//   Berlin BSR fallback:   Berlin Open Data Portal (TODO: konkreter Pfad).
//   Hamburg SRH primary:   nur via HTML-Form → noch nicht automatisierbar
//                            → Phase 1 returns 422 'address_required'.
//   München AWB primary:   GitHub muenchen-Abfallkalender (open data).
//   München AWB fallback:  AWB Web-Calendar iCal-Feed (TODO: konkreter Pfad).
//
// Wenn PRIMARY URL nicht antwortet (5xx, ECONNREFUSED, ECONNABORTED, 429),
// gilt automatisch FALLBACK URL der gleichen Stadt. Cross-City-Fallback
// ist fachlich falsch (Berlin ≠ Hamburg-Müllabfuhr) — NIEMALS versuchen.
// ---------------------------------------------------------------------------

import type { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { resolveCity, CityNotSupportedError, type WasteCityKey, type CityBounds } from './wasteCityResolver';
import { parseIcsCalendar, type IcsEvent } from '../lib/icalParser';

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
  /** Whether the city requires street + houseNr params (Hamburg, München) */
  addressRequired: boolean;
  /** Per-city attribution string (CC-BY license is mandatory) */
  attribution: string;
}

/**
 * ROSTER-DATA: per-city URL-templates.
 *
 * Real-world URLs would come from env-vars (so mobile users in production
 * don't hit the placeholder). For Phase 1 we use a stable env-overridable
 * default; if env unset, fallback to marked-pending-hardcoded URL.
 *
 * TODO Phase 2: Verify each URL live + replace with real iCal-endpoints.
 */
function buildCityRoster(): Record<WasteCityKey, CityFetchUrls> {
  return {
    berlin: {
      primary: process.env.ABFALL_BSR_PRIMARY_URL || 'https://www.bsr.de/abfuhrkalender-ical?strasse={street}&hausnr={houseNr}',
      fallback: process.env.ABFALL_BSR_FALLBACK_URL || 'https://opendata.bahn.de/web/opendata/bsr-mirror/abfallkalender.ics?stadtteil={street}&hausnr={houseNr}',
      addressRequired: false, // Berlin liefert city-wide default falls keine address
      attribution: 'Berliner Stadtreinigung (BSR) — CC-BY 4.0',
    },
    muenchen: {
      primary: process.env.ABFALL_AWB_PRIMARY_URL || 'https://www.awb-muenchen.de/fileadmin/awb-redakteur/dokumente/abfallkalender.ics?strasse={street}&hausnr={houseNr}',
      fallback: process.env.ABFALL_AWB_FALLBACK_URL || 'https://raw.githubusercontent.com/mil-muenchen/muenchen-abfallkalender/main/muenchen.ics',
      addressRequired: true,
      attribution: 'Abfallwirtschaftsbetrieb München (AWB) — CC-BY 4.0',
    },
    hamburg: {
      primary: process.env.ABFALL_SRH_PRIMARY_URL || 'https://www.stadtreinigung-hamburg.de/icity/export.php?street={street}&houseNr={houseNr}',
      // Phase B-2.1 NEEDS-FIX #2: env-var-only, kein default-URL.
      // Garantiert AGPL-compliance: kein hit-von-unverified-mirror im
      // production-default. Deployment-Owner koennen ihn via env-var
      // ABFALL_SRH_FALLBACK_URL konfigurieren (verified community-mirror
      // ODER transparenz.hamburg.de-export nach dessen License-Positiv-
      // Befund). HACS waste_schedule plugin benutzt seit Jahren einen
      // Python-Loader fuer SRH HTML-form — die iCal-Rohurl bleibt
      // nicht-oefentlich bis Hamburg Open-Data publishen.
      fallback: process.env.ABFALL_SRH_FALLBACK_URL,
      addressRequired: true,
      attribution: 'Stadtreinigung Hamburg (SRH) — CC-BY 4.0',
    },
  };
}

// ------------------------------------------------------------------
// Service-Class
// ------------------------------------------------------------------

export class WasteService {
  private readonly cache = new Map<string, { data: WasteCalendarResponse; at: number }>();
  private readonly cacheTtlMs = 24 * 60 * 60 * 1000; // 24 Stunden
  private readonly userAgent = 'HEIMAT-App/1.0 (https://github.com/abatn/HEIMAT)';
  private readonly roster = buildCityRoster();

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
   * @param street  Optional (Berlin: default fallback; Hamburg/München: REQUIRED)
   * @param houseNr  Optional (Berlin: default fallback; Hamburg/München: REQUIRED)
   */
  async getWasteCalendar(
    lat: number,
    lng: number,
    weeks: number = 4,
    street?: string,
    houseNr?: string,
  ): Promise<WasteCalendarResponse> {
    // 1. City-Resolver
    const bounds = resolveCity(lat, lng);

    // 2. Address-Required Check (Hamburg, München)
    const roster = this.roster[bounds.city];
    if (roster.addressRequired && (!street || !houseNr)) {
      throw new AddressRequiredError(bounds);
    }

    // 3. Cache-Key
    const cacheKey = this.buildCacheKey(bounds.city, street, houseNr, weeks);

    // 4. Cache-Read
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.at < this.cacheTtlMs) {
      return { ...cached.data, cached: true };
    }

    // 5. URL-Build (URL-Templates nutzen {street}/{houseNr} placeholders)
    const urlFor = (template: string) =>
      template.replace('{street}', encodeURIComponent(street || '')).replace('{houseNr}', encodeURIComponent(houseNr || ''));

    // 6. Mirror-Fetch: primary → (NUR auf recoverable-Failure) fallback
    // WICHTIG: nur 5xx/429/ECONNREFUSED/ECONNABORTED/ETIMEDOUT loesen fallback
    // aus. 4xx sind Client-Fehler (z.B. address-bad-encoded) und sollen
    // nicht den fallback-Endpoint treffen (würde nur 4xx wiederholen).
    const fetchedAt = new Date().toISOString();
    let source = roster.primary;
    let events: IcsEvent[] = [];

    try {
      events = await this.fetchIcs(urlFor(roster.primary), bounds.city);
    } catch (primaryErr) {
      if (!this.shouldFailover(primaryErr) || !roster.fallback) {
        throw primaryErr;
      }
      logger.warn(`WasteService: ${bounds.city} primary failed (recoverable), attempting fallback: ${(primaryErr as Error).message}`);
      source = roster.fallback;
      try {
        events = await this.fetchIcs(urlFor(roster.fallback), bounds.city);
      } catch (fallbackErr) {
        logger.error(
          `WasteService: ${bounds.city} both mirrors failed. ` +
          `primary=${(primaryErr as Error).message} | fallback=${(fallbackErr as Error).message}`,
        );
        throw primaryErr; // Primary error behält seinen Kontext (z.B. 429 vs. 503).
      }
    }

    // 7. Forward-Filter (events must be within `weeks*7` days)
    const filtered = this.filterByWeeks(events, weeks);

    const response: WasteCalendarResponse = {
      city: bounds.city,
      displayName: bounds.displayName,
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
    cities: { city: WasteCityKey; displayName: string; addressRequired: boolean; attribution: string }[];
    cacheEntries: number;
  } {
    return {
      service: 'waste',
      cities: (Object.keys(this.roster) as WasteCityKey[]).map((key) => ({
        city: key,
        displayName: this.requireCityKeyName(key),
        addressRequired: this.roster[key].addressRequired,
        attribution: this.getAttribution(key),
      })),
      cacheEntries: this.cache.size,
    };
  }

  /**
   * Public lookup for per-city attribution string (CC-BY license text).
   * Avoids duplicate hard-coded maps in routes/waste.ts.
   */
  getAttribution(city: WasteCityKey): string {
    return this.roster[city].attribution;
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
    const names: Record<WasteCityKey, string> = {
      berlin: 'Berlin',
      hamburg: 'Hamburg',
      muenchen: 'München',
    };
    return names[city];
  }
}
