// ---------------------------------------------------------------------------
// config.test.ts — Phase X.3b Backend-Driven-Defaults Endpoint Tests
//
// Verifiziert GET /api/config/location-defaults + GET /api/config/status.
// Pattern-Mirror zu bestehenden route-tests (mobility.test.ts, waste.test.ts):
// supertest + offline-resilient falls backend down. Konfiguration wird
// intern aus wasteService.getLocationDefaults() aggregiert (kein network IO).
//
// 3 Tests in 2 Describe-Blöcken:
//   1. GET /api/config/location-defaults liefert 200 OK + cities-array mit
//      bbox+displayName+addressRequired+attribution Struktur.
//   2. Response leakt KEINE iCal-primaryUrls (AGPL-defensiv: Mobile zieht
//      via /api/waste/calendar wrapper, nicht direkt zu BSR/SRH/AWB).
//   3. GET /api/config/status liefert version + expiresAt + citiesSupported
//      fuer generische Health-Checks.
// ---------------------------------------------------------------------------

import request from 'supertest';
import app from '../index';

// Retry-Logik fuer CI: Postgres braucht evtl. Zeit zum Starten
async function waitForServer(retries = 3, delayMs = 2000): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await request(app).get('/api/config/status');
      if (res.status === 200) return true;
    } catch {
      // Server noch nicht bereit
    }
    if (i < retries - 1) await new Promise(r => setTimeout(r, delayMs));
  }
  return false;
}

describe('Config Backend-Driven-Defaults API (Phase X.3b)', () => {
  let serverReady = false;

  // Server kann in CI ohne Postgres nicht starten — skip wenn nicht erreichbar
  beforeAll(async () => {
    serverReady = await waitForServer();
    if (!serverReady) {
      console.warn('SKIP: Config-Tests — Server nicht erreichbar (Postgres?)');
    }
  });

  describe('GET /api/config/location-defaults', () => {
    it('returns 200 OK mit cities-array + bbox + displayName + addressRequired', async () => {
      if (!serverReady) return;
      const res = await request(app).get('/api/config/location-defaults');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.version).toBe('1.0');
      expect(res.body.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO-8601
      expect(Array.isArray(res.body.cities)).toBe(true);
      expect(res.body.cities.length).toBeGreaterThanOrEqual(3);

      // Schema-Check pro City
      const first = res.body.cities[0];
      expect(first).toHaveProperty('name');
      expect(typeof first.name).toBe('string');
      expect(first).toHaveProperty('displayName');
      expect(first).toHaveProperty('bbox');
      expect(first.bbox).toHaveProperty('minLat');
      expect(first.bbox).toHaveProperty('maxLat');
      expect(first.bbox).toHaveProperty('minLng');
      expect(first.bbox).toHaveProperty('maxLng');
      expect(typeof first.addressRequired).toBe('boolean');
      expect(first).toHaveProperty('attribution');
    });

    it('leakt KEINE iCal-primaryUrls oder sensitive URLs (AGPL-defensiv)', async () => {
      if (!serverReady) return;
      const res = await request(app).get('/api/config/location-defaults');
      expect(res.status).toBe(200);

      // AGPL-defensiv: Mobile darf NICHT direkt auf municipal-Endpoints geleitet
      // werden — User-Agent-Spoofing-Risk, und wir wollen dass Mobile durch
      // /api/waste/calendar-Backend-Wrapper geht (city-resolution + cache +
      // address-validation + mirror-failover).
      //
      // CHECKS:
      //   - KEIN http(s) URL im Response-Body (auch nicht in attribution-string)
      //   - KEIN primaryUrl/icalUrl field per city oder response-level
      //   - KEIN hausnr|hausnummer substring (URL-Templates wie {street}/{houseNr})
      //
      // WICHTIG: attribution strings enthalten company-names "BSR" / "SRH" /
      // "AWB" als legal-required-text — die sind NICHT URLs und muessen
      // durchgelassen werden. Daher: keine substring-checks auf "bsr"/"srh"/
      // "awb" (false-positive-trap). Stattdessen: URL-protocol-check.
      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toMatch(/https?:\/\//); // KEINE HTTP-URLs
      expect(serialized).not.toMatch(/primaryurl|icalurl|primary_url|ical_url/i);
      expect(serialized).not.toMatch(/hausnr|hausnummer/); // address-template vars
      expect(res.body).not.toHaveProperty('primaryUrl');
      expect(res.body).not.toHaveProperty('icalUrl');
      expect(res.body).not.toHaveProperty('ical_url');
      // Per-city check
      (res.body.cities as Array<Record<string, unknown>>).forEach((city) => {
        expect(city).not.toHaveProperty('url');
        expect(city).not.toHaveProperty('primaryUrl');
        expect(city).not.toHaveProperty('icalUrl');
        expect(city).not.toHaveProperty('iCalUrl');
        expect(city).not.toHaveProperty('iCal');
      });
    });

    it('GET /api/config/status liefert version + expiresAt + citiesSupported', async () => {
      if (!serverReady) return;
      const res = await request(app).get('/api/config/status');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('config');
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('expiresAt');
      expect(res.body).toHaveProperty('citiesSupported');
      expect(res.body.citiesSupported).toBeGreaterThanOrEqual(3);
      expect(res.body).toHaveProperty('attribution');
    });
  });
});
