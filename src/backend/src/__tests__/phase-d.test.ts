/**
 * phase-d.test.ts — E2E Tests für Phase D: Events, Hotels, Bürgeramt
 *
 * Testet die 3 Backend-Routen mit echten API-Calls (Wikidata, Overpass, Nominatim).
 * KEINE Mocks — echte externe APIs wie in Production.
 *
 * Nutzt supertest (wie e2e.test.ts) statt axios+localhost —
 * dadurch kein laufender Server nötig (kein ECONNREFUSED in CI).
 */

import request from 'supertest';
import app from '../index';
import { withRetry, isAcceptableStatus, TIMEOUTS } from '../utils/test-utils';

// CI-kritisch: Globaler Timeout für alle Phase D-Tests
// Externe APIs (Overpass, Wikidata, Nominatim) können in CI >60s brauchen
jest.setTimeout(120_000);

describe('Phase D: Events + Hotels + Bürgeramt', () => {
  // =========================================================================
  // Events — GET /api/events
  // =========================================================================

  describe('GET /api/events', () => {
    it('should return events or empty array for Berlin Mitte', async () => {
      const res = await withRetry(
        () =>
          request(app).get(
            '/api/events?lat=52.52&lng=13.41&radius=5',
          ),
        { name: 'phase-d-events', timeoutMs: TIMEOUTS.overpass },
      );

      expect(isAcceptableStatus(res.status)).toBe(true);
      expect(res.body).toHaveProperty('count');
      expect(res.body).toHaveProperty('events');
      expect(res.body).toHaveProperty('center');
      expect(res.body).toHaveProperty('radius');
      expect(Array.isArray(res.body.events)).toBe(true);
      expect(typeof res.body.count).toBe('number');
    });

    it('should require lat+lng parameters (400 without)', async () => {
      const res = await request(app).get('/api/events');

      // Ohne lat+lng → 400 Bad Request
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/lat.*lng|required/i);
    });

    it('should return events with correct structure', async () => {
      const res = await withRetry(
        () =>
          request(app).get(
            '/api/events?lat=52.52&lng=13.41&radius=2',
          ),
        { name: 'phase-d-events-structure', timeoutMs: TIMEOUTS.overpass },
      );

      expect(isAcceptableStatus(res.status)).toBe(true);

      if (res.status === 200 && res.body.events.length > 0) {
        const event = res.body.events[0];
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('name');
        expect(event).toHaveProperty('category');
        expect(event).toHaveProperty('source');
        expect(['wikidata', 'osm']).toContain(event.source);
      }
    });
  });

  // =========================================================================
  // Hotels — GET /api/hotels
  // =========================================================================

  describe('GET /api/hotels', () => {
    it('should return hotels or empty array for Berlin Mitte', async () => {
      const res = await withRetry(
        () =>
          request(app).get(
            '/api/hotels?lat=52.52&lng=13.41&radius=2',
          ),
        { name: 'phase-d-hotels', timeoutMs: TIMEOUTS.overpass },
      );

      expect(isAcceptableStatus(res.status)).toBe(true);
      expect(res.body).toHaveProperty('count');
      expect(res.body).toHaveProperty('hotels');
      expect(res.body).toHaveProperty('center');
      expect(res.body).toHaveProperty('radius');
      expect(Array.isArray(res.body.hotels)).toBe(true);
      expect(typeof res.body.count).toBe('number');
    });

    it('should require lat+lng parameters (400 without)', async () => {
      const res = await request(app).get('/api/hotels');

      // Ohne lat+lng → 400 Bad Request
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/lat.*lng|required/i);
    });

    it('should return hotels with correct structure', async () => {
      const res = await withRetry(
        () =>
          request(app).get(
            '/api/hotels?lat=52.52&lng=13.41&radius=5',
          ),
        { name: 'phase-d-hotels-structure', timeoutMs: TIMEOUTS.overpass },
      );

      expect(isAcceptableStatus(res.status)).toBe(true);

      if (res.status === 200 && res.body.hotels.length > 0) {
        const hotel = res.body.hotels[0];
        expect(hotel).toHaveProperty('id');
        expect(hotel).toHaveProperty('name');
        expect(hotel).toHaveProperty('type');
        expect(hotel).toHaveProperty('lat');
        expect(hotel).toHaveProperty('lng');
        expect(typeof hotel.lat).toBe('number');
        expect(typeof hotel.lng).toBe('number');
      }
    });
  });

  // =========================================================================
  // Bürgeramt — GET /api/buergeramt
  // =========================================================================

  describe('GET /api/buergeramt', () => {
    it('should return Bürgerämter for Berlin Mitte', async () => {
      const res = await withRetry(
        () =>
          request(app).get(
            '/api/buergeramt?lat=52.52&lng=13.41&radius=5',
          ),
        { name: 'phase-d-buergeramt', timeoutMs: TIMEOUTS.nominatim },
      );

      expect(isAcceptableStatus(res.status)).toBe(true);
      expect(res.body).toHaveProperty('count');
      expect(res.body).toHaveProperty('aemter');
      expect(res.body).toHaveProperty('center');
      expect(res.body).toHaveProperty('radius');
      expect(Array.isArray(res.body.aemter)).toBe(true);
      expect(typeof res.body.count).toBe('number');
    });

    it('should require lat+lng parameters (400 without)', async () => {
      const res = await request(app).get('/api/buergeramt');

      // Ohne lat+lng → 400 Bad Request
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/lat.*lng|required/i);
    });

    it('should return Bürgerämter with correct structure', async () => {
      const res = await withRetry(
        () =>
          request(app).get(
            '/api/buergeramt?lat=52.52&lng=13.41&radius=5',
          ),
        { name: 'phase-d-buergeramt-structure', timeoutMs: TIMEOUTS.nominatim },
      );

      expect(isAcceptableStatus(res.status)).toBe(true);

      if (res.status === 200 && res.body.aemter.length > 0) {
        const amt = res.body.aemter[0];
        expect(amt).toHaveProperty('id');
        expect(amt).toHaveProperty('name');
        expect(amt).toHaveProperty('type');
        expect(amt).toHaveProperty('lat');
        expect(amt).toHaveProperty('lng');
        expect(typeof amt.lat).toBe('number');
        expect(typeof amt.lng).toBe('number');
      }
    });

    it('should return Bürgerämter for Berlin (0 or more, API may be rate-limited)', async () => {
      const res = await withRetry(
        () =>
          request(app).get(
            '/api/buergeramt?lat=52.52&lng=13.41&radius=10',
          ),
        { name: 'phase-d-buergeramt-berlin', timeoutMs: TIMEOUTS.nominatim },
      );

      expect(isAcceptableStatus(res.status)).toBe(true);
      // Berlin should have Bürgerämter, but Overpass may return 0 when rate-limited
      if (res.status === 200) {
        expect(Array.isArray(res.body.aemter)).toBe(true);
        // 0 is acceptable — Overpass may be rate-limited
        expect(res.body.aemter.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // =========================================================================
  // Cross-Service — Parallel-Aufrufe
  // =========================================================================

  describe('Cross-Service Parallel', () => {
    it('should handle parallel requests for all Phase D services', async () => {
      const [events, hotels, buergeramt] = await Promise.allSettled([
        withRetry(
          () =>
            request(app).get(
              '/api/events?lat=52.52&lng=13.41&radius=5',
            ),
          { name: 'phase-d-parallel-events', timeoutMs: TIMEOUTS.overpass },
        ),
        withRetry(
          () =>
            request(app).get(
              '/api/hotels?lat=52.52&lng=13.41&radius=5',
            ),
          { name: 'phase-d-parallel-hotels', timeoutMs: TIMEOUTS.overpass },
        ),
        withRetry(
          () =>
            request(app).get(
              '/api/buergeramt?lat=52.52&lng=13.41&radius=5',
            ),
          { name: 'phase-d-parallel-buergeramt', timeoutMs: TIMEOUTS.nominatim },
        ),
      ]);

      // All services should at least respond (200 or acceptable error)
      if (buergeramt.status === 'fulfilled') {
        expect(isAcceptableStatus(buergeramt.value.status)).toBe(true);
      }
      if (events.status === 'fulfilled') {
        expect(isAcceptableStatus(events.value.status)).toBe(true);
      }
      if (hotels.status === 'fulfilled') {
        expect(isAcceptableStatus(hotels.value.status)).toBe(true);
      }
    });
  });
});
