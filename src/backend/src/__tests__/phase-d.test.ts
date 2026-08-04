/**
 * phase-d.test.ts — E2E Tests für Phase D: Events, Hotels, Bürgeramt
 *
 * Testet die3 Backend-Routen mit echten API-Calls (Wikidata, Overpass, Nominatim).
 * KEINE Mocks — echte externe APIs wie in Production.
 */

import axios from 'axios';
import { withRetry, isAcceptableStatus, TIMEOUTS } from '../utils/test-utils';

const BASE_URL = 'http://localhost:3000';

// E2E tests with external APIs need longer timeouts
jest.setTimeout(120000);

describe('Phase D: Events + Hotels + Bürgeramt', () => {
  // =========================================================================
  // Events — GET /api/events
  // =========================================================================

  describe('GET /api/events', () => {
    it('should return events or empty array for Berlin Mitte', async () => {
      const response = await withRetry(
        () =>
          axios.get(`${BASE_URL}/api/events`, {
            params: { lat: 52.52, lng: 13.41, radius: 5 },
            timeout: TIMEOUTS.overpass,
          }),
        { retries: 2, timeoutMs: TIMEOUTS.overpass },
      );

      expect(isAcceptableStatus(response.status)).toBe(true);
      expect(response.data).toHaveProperty('count');
      expect(response.data).toHaveProperty('events');
      expect(response.data).toHaveProperty('center');
      expect(response.data).toHaveProperty('radius');
      expect(Array.isArray(response.data.events)).toBe(true);
      expect(typeof response.data.count).toBe('number');
    });

    it('should accept default parameters', async () => {
      const response = await withRetry(
        () =>
          axios.get(`${BASE_URL}/api/events`, {
            timeout: TIMEOUTS.overpass,
          }),
        { retries: 2, timeoutMs: TIMEOUTS.overpass },
      );

      expect(isAcceptableStatus(response.status)).toBe(true);
      if (response.status === 200) {
        expect(response.data.center).toEqual({ lat: 52.52, lng: 13.41 });
        expect(response.data.radius).toBe(10);
      }
    });

    it('should return events with correct structure', async () => {
      const response = await withRetry(
        () =>
          axios.get(`${BASE_URL}/api/events`, {
            params: { lat: 52.52, lng: 13.41, radius: 2 },
            timeout: TIMEOUTS.overpass,
          }),
        { retries: 2, timeoutMs: TIMEOUTS.overpass },
      );

      expect(isAcceptableStatus(response.status)).toBe(true);

      if (response.status === 200 && response.data.events.length > 0) {
        const event = response.data.events[0];
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
      const response = await withRetry(
        () =>
          axios.get(`${BASE_URL}/api/hotels`, {
            params: { lat: 52.52, lng: 13.41, radius: 2 },
            timeout: TIMEOUTS.overpass,
          }),
        { retries: 2, timeoutMs: TIMEOUTS.overpass },
      );

      expect(isAcceptableStatus(response.status)).toBe(true);
      expect(response.data).toHaveProperty('count');
      expect(response.data).toHaveProperty('hotels');
      expect(response.data).toHaveProperty('center');
      expect(response.data).toHaveProperty('radius');
      expect(Array.isArray(response.data.hotels)).toBe(true);
      expect(typeof response.data.count).toBe('number');
    });

    it('should accept default parameters', async () => {
      const response = await withRetry(
        () =>
          axios.get(`${BASE_URL}/api/hotels`, {
            timeout: TIMEOUTS.overpass,
          }),
        { retries: 2, timeoutMs: TIMEOUTS.overpass },
      );

      expect(isAcceptableStatus(response.status)).toBe(true);
      if (response.status === 200) {
        expect(response.data.center).toEqual({ lat: 52.52, lng: 13.41 });
        expect(response.data.radius).toBe(5);
      }
    });

    it('should return hotels with correct structure', async () => {
      const response = await withRetry(
        () =>
          axios.get(`${BASE_URL}/api/hotels`, {
            params: { lat: 52.52, lng: 13.41, radius: 5 },
            timeout: TIMEOUTS.overpass,
          }),
        { retries: 2, timeoutMs: TIMEOUTS.overpass },
      );

      expect(isAcceptableStatus(response.status)).toBe(true);

      if (response.status === 200 && response.data.hotels.length > 0) {
        const hotel = response.data.hotels[0];
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
      const response = await withRetry(
        () =>
          axios.get(`${BASE_URL}/api/buergeramt`, {
            params: { lat: 52.52, lng: 13.41, radius: 5 },
            timeout: TIMEOUTS.nominatim,
          }),
        { retries: 2, timeoutMs: TIMEOUTS.nominatim },
      );

      expect(isAcceptableStatus(response.status)).toBe(true);
      expect(response.data).toHaveProperty('count');
      expect(response.data).toHaveProperty('aemter');
      expect(response.data).toHaveProperty('center');
      expect(response.data).toHaveProperty('radius');
      expect(Array.isArray(response.data.aemter)).toBe(true);
      expect(typeof response.data.count).toBe('number');
    });

    it('should accept default parameters', async () => {
      const response = await withRetry(
        () =>
          axios.get(`${BASE_URL}/api/buergeramt`, {
            timeout: TIMEOUTS.nominatim,
          }),
        { retries: 2, timeoutMs: TIMEOUTS.nominatim },
      );

      expect(isAcceptableStatus(response.status)).toBe(true);
      if (response.status === 200) {
        expect(response.data.center).toEqual({ lat: 52.52, lng: 13.41 });
        expect(response.data.radius).toBe(10);
      }
    });

    it('should return Bürgerämter with correct structure', async () => {
      const response = await withRetry(
        () =>
          axios.get(`${BASE_URL}/api/buergeramt`, {
            params: { lat: 52.52, lng: 13.41, radius: 5 },
            timeout: TIMEOUTS.nominatim,
          }),
        { retries: 2, timeoutMs: TIMEOUTS.nominatim },
      );

      expect(isAcceptableStatus(response.status)).toBe(true);

      if (response.status === 200 && response.data.aemter.length > 0) {
        const amt = response.data.aemter[0];
        expect(amt).toHaveProperty('id');
        expect(amt).toHaveProperty('name');
        expect(amt).toHaveProperty('type');
        expect(amt).toHaveProperty('lat');
        expect(amt).toHaveProperty('lng');
        expect(typeof amt.lat).toBe('number');
        expect(typeof amt.lng).toBe('number');
      }
    });

    it('should find Bürgerämter in Berlin (non-empty)', async () => {
      const response = await withRetry(
        () =>
          axios.get(`${BASE_URL}/api/buergeramt`, {
            params: { lat: 52.52, lng: 13.41, radius: 10 },
            timeout: TIMEOUTS.nominatim,
          }),
        { retries: 2, timeoutMs: TIMEOUTS.nominatim },
      );

      expect(isAcceptableStatus(response.status)).toBe(true);
      // Berlin should have at least some government buildings (when API responds 200)
      if (response.status === 200) {
        expect(response.data.aemter.length).toBeGreaterThan(0);
      }
    });
  });

  // =========================================================================
  // Cross-Service — Parallel-Aufrufe
  // =========================================================================

  describe('Cross-Service Parallel', () => {
    it('should handle parallel requests for all Phase D services', async () => {
      const params = { lat: 52.52, lng: 13.41, radius: 5 };

      const [events, hotels, buergeramt] = await Promise.allSettled([
        withRetry(
          () =>
            axios.get(`${BASE_URL}/api/events`, {
              params,
              timeout: TIMEOUTS.overpass,
            }),
          { retries: 2, timeoutMs: TIMEOUTS.overpass },
        ),
        withRetry(
          () =>
            axios.get(`${BASE_URL}/api/hotels`, {
              params,
              timeout: TIMEOUTS.overpass,
            }),
          { retries: 2, timeoutMs: TIMEOUTS.overpass },
        ),
        withRetry(
          () =>
            axios.get(`${BASE_URL}/api/buergeramt`, {
              params,
              timeout: TIMEOUTS.nominatim,
            }),
          { retries: 2, timeoutMs: TIMEOUTS.nominatim },
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
