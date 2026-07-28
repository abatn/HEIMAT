// ---------------------------------------------------------------------------
// airQuality.test.ts — Phase X.3a AirQualityService Refactor Regression-Tests
//
// Verifiziert dass airQualityService.ts Refactor (4 hardcoded URLs ersetzt
// via externalServices: openAirQualityUrl + userAgent + nominatimUrl) keinen
// Funktionsbruch verursacht. Pattern-Mirror zu evCharging.test.ts (Phase C-1):
// supertest-basiert + offline-resilient (expect [200, 502]).
//
// Endpoint (per routes/airQuality.ts inspection):
//   GET /api/air-quality/current?lat=&lng=
//   response: { status, airQuality, location, source } | 502 if upstream-failure
//
// 2 Tests:
//   1. Happy-Path: 200 OK oder 502 (offline-resilient) bei gueltigen coords
//   2. Invalid-Inputs: 400 BadRequest ohne coords
// ---------------------------------------------------------------------------

import request from 'supertest';
import app from '../index';

describe('Luftqualität API', () => {
  describe('GET /api/air-quality/current', () => {
    it('returns 200 (mit AirQuality-Payload) oder 502 wenn Open-Meteo-AQ nicht erreichbar', async () => {
      const res = await request(app)
        .get('/api/air-quality/current?lat=52.5200&lng=13.4050');

      // Offline-resilient: Render-Free-Tier kann Open-Meteo-AQ upstream nicht immer
      // erreichen. Pattern-Mirror zu evCharging/mobility/weather Tests.
      expect([200, 502]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('status', 'ok');
        expect(res.body).toHaveProperty('airQuality');
        expect(res.body).toHaveProperty('location');
        expect(res.body).toHaveProperty('source');
        // AirQuality hat europeanAqi + level/color
        expect(res.body.airQuality).toHaveProperty('europeanAqi');
        expect(res.body.airQuality).toHaveProperty('aqiLevel');
      } else {
        // 502-Body ist Open-Meteo-upstream-failure (NICHT 503 — Backend hat's versucht)
        expect(res.body).toHaveProperty('status', 'error');
      }
    }, 60000);

    it('returns 400 BadRequest ohne lat/lng Query-Parameter', async () => {
      const res = await request(app).get('/api/air-quality/current');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('status', 'error');
      expect(res.body.message).toMatch(/lat.*lng.*erforderlich/);
    });

    it('returns 400 BadRequest mit invalid lat/lng (NaN via parseFloat)', async () => {
      const res = await request(app)
        .get('/api/air-quality/current?lat=abc&lng=xyz');
      expect(res.status).toBe(400);
    });
  });
});
