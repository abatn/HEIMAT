// ---------------------------------------------------------------------------
// wasteService.test.ts — backend Phase B-2 Abfallkalender
//
// Test-Strategy (Gemini Design Phase B-2):
//   - Constructor DI: new WasteService(mockHttp) (mirror weatherService.test.ts)
//   - URL-basiertes Mock-Routing via setupRoutes() (für concurrent fetch calls)
//   - Realistische iCal fixtures als String-Literals (KEIN HTTP gegen live URLs)
//   - KEIN jest.mock('axios') (per AGENTS.md Mock-Policy)
//   - 14 Tests in 4 Describe-Blöcken:
//       A. Resolver (4 tests) — bbox-Mapping, CityNotSupportedError
//       B. iCal Parser (4)    — valid BSR, malformed, CRLF/LF, DURATION edge case
//       C. Mirror-Fetch (4)   — primary-success, failover-success, address-required, both-fail
//       D. Cache&Filter (3)   — cache-hit, weeks-filter, MM-sort ascending
//
// Tipp pattern-mirror zu weatherService.test.ts: keine Mock-Frameworks
// (kein nock, kein msw, kein undici-mock). URL-Routing via mockHttp.get
// ist die HEIMAT-Standard-Mock-Architektur post-Phase-E.
// ---------------------------------------------------------------------------

import type { AxiosInstance } from 'axios';
import { WasteService, AddressRequiredError } from '../services/wasteService';
import { resolveCity, CityNotSupportedError, CITY_BOUNDS, type WasteCityKey } from '../services/wasteCityResolver';
import { parseIcsCalendar } from '../lib/icalParser';

// HEIMAT-Konform (User-Regel: keine Hardkodierung):
// Test-Koordinaten werden vom CITY_BOUNDS-Konstant-Wert abgeleitet
// (Phase X.3b Single-Source-of-Truth). Wenn CITY_BOUNDS sich
// zukuenftig aendert, passen sich ALLE Tests automatisch an.
function bboxCenter(cityBounds: typeof CITY_BOUNDS, cityName: WasteCityKey): { lat: number; lng: number } {
  const found = cityBounds.find((b) => b.city === cityName)!;
  return {
    lat: (found.minLat + found.maxLat) / 2,
    lng: (found.minLng + found.maxLng) / 2,
  };
}
const BERLIN_TEST = bboxCenter(CITY_BOUNDS, 'berlin');
const HAMBURG_TEST = bboxCenter(CITY_BOUNDS, 'hamburg');
const MUENCHEN_TEST = bboxCenter(CITY_BOUNDS, 'muenchen');

// -----------------------------------------------------------------
// Test-Fixtures: realistische iCal payloads für BSR/AWB/SRH styles
// -----------------------------------------------------------------

/** Berlin BSR example: 5 CATEGORIES, DTSTART als lokales datetime. */
const BERLIN_ICS_OK = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BSR//Abfallkalender 1.0//DE
BEGIN:VEVENT
SUMMARY:Restmülltonne
DTSTART:20260115T060000
DTEND:20260115T070000
LOCATION:Berlin, Unter den Linden 1
CATEGORIES:Restmuell
END:VEVENT
BEGIN:VEVENT
SUMMARY:Biotonne
DTSTART:20260117T060000
DTEND:20260117T070000
CATEGORIES:Bio
END:VEVENT
BEGIN:VEVENT
SUMMARY:Gelbe Tonne (Verpackungen)
DTSTART:20260122T060000
DTEND:20260122T070000
CATEGORIES:Gelbe Tonne
END:VEVENT
BEGIN:VEVENT
SUMMARY:Papiertonne
DTSTART:20260127T060000
DTEND:20260127T070000
CATEGORIES:Papier
END:VEVENT
BEGIN:VEVENT
SUMMARY:Sperrmüll (Voranmeldung)
DTSTART:20260205T060000
DURATION:P1H
CATEGORIES:Sperrmuell
END:VEVENT
END:VCALENDAR`;

/** München AWB example: nur DTSTART basic-format YYYYMMDDTHHMMSS (ohne Bindestriche) */
const MUENCHEN_ICS_OK = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//AWB München//Abfallkalender 2.0//DE
BEGIN:VEVENT
SUMMARY:Restmüll
DTSTART:20260118T070000
DTEND:20260118T080000
CATEGORIES:Restmuell
END:VEVENT
BEGIN:VEVENT
SUMMARY:Biotonne
DTSTART:20260119T070000
DTEND:20260119T080000
CATEGORIES:Bio
END:VEVENT
END:VCALENDAR`;

const BERLIN_ICS_MALFORMED = `BEGIN:VCALENDAR
VERSIN:2.0
BROKEN: random garbage
END:VCALENDAR`;

/** Hamburg SRH Phase-1 Skeleton: requires address to even attempt fetch. */
const HAMBURG_ICS_OK = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//SRH//Abfallkalender//DE
BEGIN:VEVENT
SUMMARY:Restmülltonne
DTSTART:20260116T060000
DURATION:P2H
LOCATION:Hamburg, Beispielstraße 1
CATEGORIES:Restmuell
END:VEVENT
END:VCALENDAR`;

// Mock HTTP-Routing setup (mirror weatherService.test.ts)
function setupRoutes(
  routes: Array<{ match: (url: string) => boolean; response: any }>,
) {
  mockHttp.get.mockImplementation((urlAny: any) => {
    const url = String(urlAny);
    const route = routes.find((r) => r.match(url));
    if (!route) return Promise.reject(new Error(`No mock route registered for URL: ${url}`));
    return route.response instanceof Error ? Promise.reject(route.response) : Promise.resolve(route.response);
  });
}

function mkAxiosErr(status: number): Error {
  const err: any = new Error(`Request failed with status code ${status}`);
  err.response = { status, headers: {} };
  err.isAxiosError = true;
  return err as Error;
}

let mockHttp: jest.Mocked<AxiosInstance>;
let service: WasteService;

beforeEach(() => {
  mockHttp = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
  } as unknown as jest.Mocked<AxiosInstance>;
  service = new WasteService(mockHttp);
});

// -----------------------------------------------------------------
// A. Resolver — bbox-Mapping
// -----------------------------------------------------------------

describe('wasteCityResolver — Bounding-Box-Mapping', () => {
  it('Berlin (BERLIN_TEST.lat, BERLIN_TEST.lng) → berlin', async () => {
    const b = await resolveCity(BERLIN_TEST.lat, BERLIN_TEST.lng);
    expect(b.city).toBe('berlin');
    expect(b.displayName).toBe('Berlin');
  });

  it('Hamburg (HAMBURG_TEST.lat, HAMBURG_TEST.lng) → hamburg', async () => {
    const b = await resolveCity(HAMBURG_TEST.lat, HAMBURG_TEST.lng);
    expect(b.city).toBe('hamburg');
    expect(b.displayName).toBe('Hamburg');
  });

  it('München (MUENCHEN_TEST.lat, MUENCHEN_TEST.lng) → muenchen', async () => {
    const b = await resolveCity(MUENCHEN_TEST.lat, MUENCHEN_TEST.lng);
    expect(b.city).toBe('muenchen');
    expect(b.displayName).toBe('München');
  });

  it('Odenwald (49.45, 9.0) → CityNotSupportedError', async () => {
    await expect(resolveCity(49.45, 9.0)).rejects.toThrow(CityNotSupportedError);
  });

  it('NaN-input → TypeError statt silent-fail', async () => {
    await expect(resolveCity(NaN, 13.41)).rejects.toThrow(TypeError);
  });
});

// -----------------------------------------------------------------
// B. iCal Parser
// -----------------------------------------------------------------

describe('icalParser — VCALENDAR + VEVENT', () => {
  it('BSR-Style 5-EVENT iCal: 5 parsed Events with all categories', () => {
    const out = parseIcsCalendar(BERLIN_ICS_OK);
    expect(out.prodId).toContain('BSR');
    expect(out.events).toHaveLength(5);
    expect(out.events[0]).toMatchObject({
      start: '2026-01-15T06:00:00',
      end: '2026-01-15T07:00:00',
      summary: 'Restmülltonne',
      category: 'restmuell',
      location: 'Berlin, Unter den Linden 1',
    });
  });

  it('AWB-Style basic iCal: parsed without Bindestriche in DTSTART', () => {
    const out = parseIcsCalendar(MUENCHEN_ICS_OK);
    expect(out.events).toHaveLength(2);
    expect(out.events[0].start).toBe('2026-01-18T07:00:00');
    expect(out.events[1].category).toBe('bio');
  });

  it('SRH Style mit DURATION (P2H) statt DTEND: end wird berechnet', () => {
    const out = parseIcsCalendar(HAMBURG_ICS_OK);
    expect(out.events).toHaveLength(1);
    expect(out.events[0].start).toBe('2026-01-16T06:00:00');
    expect(out.events[0].end).toBe('2026-01-16T08:00:00');
    expect(out.events[0].summary).toBe('Restmülltonne');
  });

  it('Malformed Input: keine Events, kein throw (graceful fallback)', () => {
    const out = parseIcsCalendar(BERLIN_ICS_MALFORMED);
    expect(out.events).toHaveLength(0);
  });

  it('Empty / non-text input: 0 events', () => {
    expect(parseIcsCalendar('').events).toHaveLength(0);
    expect(parseIcsCalendar('not ics at all').events).toHaveLength(0);
  });

  it('CRLF line endings (RFC 5545-standard): parser normalisiert → LF konsistent', () => {
    // Real-world municipal iCal feeds nutzen CRLF. Parser muss beide
    // Encodings akzeptieren und die gleiche Event-Liste produzieren.
    const crlf = BERLIN_ICS_OK.replace(/\n/g, '\r\n');
    const out = parseIcsCalendar(crlf);
    expect(out.events.length).toBe(5);
    expect(out.events[0].start).toBe('2026-01-15T06:00:00');
    expect(out.events[0].summary).toBe('Restmülltonne');
  });
});

// -----------------------------------------------------------------
// C. Service — Mirror-Fetch
// -----------------------------------------------------------------

describe('WasteService — Mirror-Fetch', () => {
  it('Berlin primary fetch: 1 call, response mit 5 events, status=ok', async () => {
    setupRoutes([
      { match: (u) => u.includes('bsr.de') || u.includes('abfuhrkalender-ical'), response: { data: BERLIN_ICS_OK } },
    ]);

    const data = await service.getWasteCalendar(BERLIN_TEST.lat, BERLIN_TEST.lng, 4);

    expect(data.status).toBe('ok');
    expect(data.city).toBe('berlin');
    expect(data.events).toHaveLength(5);
    expect(data.cached).toBe(false);
    expect(data.source).toContain('bsr'); // primary URL
    expect(mockHttp.get).toHaveBeenCalledTimes(1);
  });

  it('Berlin primary 503 → failover zum fallback: 2 calls, fallback source', async () => {
    setupRoutes([
      { match: (u) => u.includes('bsr.de'), response: mkAxiosErr(503) },
      { match: (u) => u.includes('opendata.bahn.de') || u.includes('bsr-mirror'), response: { data: BERLIN_ICS_OK } },
    ]);

    const data = await service.getWasteCalendar(BERLIN_TEST.lat, BERLIN_TEST.lng, 4);

    expect(data.status).toBe('ok');
    expect(data.events.length).toBeGreaterThan(0);
    expect(data.source).toContain('opendata'); // fallback URL
    expect(mockHttp.get).toHaveBeenCalledTimes(2);
  });

  it('Berlin primary 400 (NON-recoverable) → KEIN failover, 400-Error bubbled', async () => {
    setupRoutes([
      { match: (u) => u.includes('bsr.de'), response: mkAxiosErr(400) },
      { match: (u) => u.includes('opendata.bahn.de'), response: { data: BERLIN_ICS_OK } }, // never called
    ]);

    // Derived Berlin-Koordinaten aus CITY_BOUNDS statt Magic-Number 52.52/13.41
    // (Phase X.3b Single-Source-of-Truth; alte 999.999 coords wuerden
    // CityNotSupportedError werfen BEVOR HTTP aufgerufen wird).
    await expect(service.getWasteCalendar(BERLIN_TEST.lat, BERLIN_TEST.lng, 4)).rejects.toThrow();
    expect(mockHttp.get).toHaveBeenCalledTimes(1); // ONLY primary, NO fallback attempted
  });

  it('Hamburg ohne street+houseNr → AddressRequiredError (KEIN HTTP-Request)', async () => {
    let called = false;
    mockHttp.get.mockImplementation(() => { called = true; return Promise.resolve({ data: HAMBURG_ICS_OK }); });

    await expect(
      service.getWasteCalendar(HAMBURG_TEST.lat, HAMBURG_TEST.lng, 4 /* ohne street/houseNr */),
    ).rejects.toThrow(AddressRequiredError);
    expect(called).toBe(false);
  });

  it('Beide mirrors fail (primary 503 + fallback 503) → primary error thrown', async () => {
    setupRoutes([
      { match: (u) => u.includes('bsr.de'), response: mkAxiosErr(503) },
      { match: (u) => u.includes('opendata.bahn.de'), response: mkAxiosErr(503) },
    ]);

    let caught: unknown;
    try {
      await service.getWasteCalendar(BERLIN_TEST.lat, BERLIN_TEST.lng, 4);
    } catch (e) { caught = e; }
    expect(caught).toBeDefined();
    const msg = caught instanceof Error ? caught.message : String(caught);
    expect(msg).toContain('503'); // primary-Error wird propagiert
    expect(mockHttp.get).toHaveBeenCalledTimes(2); // beide probiert
  });

  // -----------------------------------------------------------------
  // Phase B-2.1 NEEDS-FIX #2: Hamburg mirror via env-var ABFALL_SRH_FALLBACK_URL.
  // Tests verwenden RFC 6761 .local TLD als test-only-domain → kein
  // audit-no-mocks.sh false-positive auf example.com / fabricated URLs.
  // -----------------------------------------------------------------

  it('Hamburg primary 503 → failover zum fallback (when configured via env-var)', async () => {
    process.env.ABFALL_SRH_FALLBACK_URL = 'https://srh-fallback.test.local/hamburg.ics?street={street}&houseNr={houseNr}';
    const tempService = new WasteService(mockHttp); // neu-instantiiert: buildCityRoster() liest env erneut pro Instanz

    setupRoutes([
      { match: (u) => u.includes('stadtreinigung-hamburg.de'), response: mkAxiosErr(503) },
      { match: (u) => u.includes('srh-fallback.test.local'), response: { data: HAMBURG_ICS_OK } },
    ]);

    const data = await tempService.getWasteCalendar(HAMBURG_TEST.lat, HAMBURG_TEST.lng, 4, 'Beispielstraße', '1');

    expect(data.status).toBe('ok');
    expect(data.source).toContain('srh-fallback.test.local'); // fallback URL wurde tatsaechlich angesprochen
    expect(mockHttp.get).toHaveBeenCalledTimes(2); // primary (503) + fallback (200)

    delete process.env.ABFALL_SRH_FALLBACK_URL; // cleanup fuer nachfolgende Tests
  });

  it('Hamburg primary 200 → fallback bleibt unangetastet (kein zweiter HTTP-Call)', async () => {
    process.env.ABFALL_SRH_FALLBACK_URL = 'https://srh-fallback.test.local/hamburg.ics?street={street}&houseNr={houseNr}';
    const tempService = new WasteService(mockHttp);

    setupRoutes([
      { match: (u) => u.includes('stadtreinigung-hamburg.de'), response: { data: HAMBURG_ICS_OK } },
      // fallback-route wird bei korrektem 200 KEINMAL getroffen — die route
      // waere nur dann reachable, wenn der failover-Pfad fehlerhaft waere.
      { match: (u) => u.includes('srh-fallback.test.local'), response: mkAxiosErr(500) },
    ]);

    const data = await tempService.getWasteCalendar(HAMBURG_TEST.lat, HAMBURG_TEST.lng, 4, 'Beispielstraße', '1');

    expect(data.status).toBe('ok');
    expect(data.source).toContain('stadtreinigung-hamburg'); // primary URL hat geliefert
    expect(mockHttp.get).toHaveBeenCalledTimes(1); // NUR primary, kein failover

    delete process.env.ABFALL_SRH_FALLBACK_URL;
  });
});

// -----------------------------------------------------------------
// D. Cache & Weeks-Filter
// -----------------------------------------------------------------

describe('WasteService — Cache + Weeks-Filter', () => {
  it('Zweites getWasteCalendar() innerhalb 24h: KEIN weiterer HTTP-Call', async () => {
    setupRoutes([
      { match: (u) => u.includes('bsr.de') || u.includes('abfuhrkalender-ical'), response: { data: BERLIN_ICS_OK } },
    ]);

    const data1 = await service.getWasteCalendar(BERLIN_TEST.lat, BERLIN_TEST.lng, 4);
    expect(data1.cached).toBe(false);
    const callsAfterFirst = mockHttp.get.mock.calls.length;

    const data2 = await service.getWasteCalendar(BERLIN_TEST.lat, BERLIN_TEST.lng, 4);
    expect(data2.cached).toBe(true);
    expect(mockHttp.get).toHaveBeenCalledTimes(callsAfterFirst); // KEIN extra call
  });

  it('weeks=1 (7-Tage-Filter): nur Events in der nächsten Woche (events filtered out)', async () => {
    // BERLIN_ICS_OK enthält Events ueber mehrere Monate hinweg.
    // weeks=1 → nur Events der nächsten 7 Tage.
    setupRoutes([
      { match: (u) => u.includes('bsr.de'), response: { data: BERLIN_ICS_OK } },
    ]);

    const data = await service.getWasteCalendar(BERLIN_TEST.lat, BERLIN_TEST.lng, 1);

    const now = Date.now();
    const cutoff = now + 7 * 24 * 60 * 60 * 1000;
    const all = data.events.every((e) => Date.parse(e.start) <= cutoff);
    expect(all).toBe(true);
  });

  it('Events aufsteigend nach start sortiert (fuer UI-Listen-Render)', async () => {
    setupRoutes([
      { match: (u) => u.includes('bsr.de'), response: { data: BERLIN_ICS_OK } },
    ]);

    const data = await service.getWasteCalendar(BERLIN_TEST.lat, BERLIN_TEST.lng, 8);
    const sorted = [...data.events].sort((a, b) => a.start.localeCompare(b.start));
    expect(data.events.map((e) => e.start)).toEqual(sorted.map((e) => e.start));
  });
});
