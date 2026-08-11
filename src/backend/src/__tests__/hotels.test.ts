import request from 'supertest';
import app from '../index';
import { withRetry, isAcceptableStatus, TIMEOUTS } from '../utils/test-utils';

// CI-kritisch: Globaler Timeout für externe APIs (Overpass)
jest.setTimeout(120_000);

describe('Hotels API', () => {
  describe('GET /api/hotels', () => {
    it('should return live hotels or empty array if Overpass unreachable', async () => {
      const res = await withRetry(
        () =>
          request(app).get(
            '/api/hotels?lat=52.52&lng=13.41&radius=2',
          ),
        { name: 'hotels-search', retries: 3, timeoutMs: TIMEOUTS.overpass },
      );

      expect(isAcceptableStatus(res.status)).toBe(true);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('hotels');
        expect(Array.isArray(res.body.hotels)).toBe(true);
        expect(res.body).toHaveProperty('count');
        expect(typeof res.body.count).toBe('number');
      }
    }, TIMEOUTS.overpass);

    it('should return error without coordinates', async () => {
      const res = await request(app).get('/api/hotels');
      expect(res.status).toBe(400);
    });

    it('should return error with invalid coordinates', async () => {
      const res = await request(app).get(
        '/api/hotels?lat=abc&lng=xyz',
      );
      expect(res.status).toBe(400);
    });

    it('should respect custom radius parameter', async () => {
      const res = await withRetry(
        () =>
          request(app).get(
            '/api/hotels?lat=52.52&lng=13.41&radius=1',
          ),
        { name: 'hotels-radius', retries: 3, timeoutMs: TIMEOUTS.overpass },
      );

      expect(isAcceptableStatus(res.status)).toBe(true);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('radius');
        expect(res.body.radius).toBe(1);
      }
    }, TIMEOUTS.overpass);

    it('should return hotels with required fields', async () => {
      const res = await withRetry(
        () =>
          request(app).get(
            '/api/hotels?lat=52.52&lng=13.41&radius=2',
          ),
        { name: 'hotels-fields', retries: 3, timeoutMs: TIMEOUTS.overpass },
      );

      expect(isAcceptableStatus(res.status)).toBe(true);
      if (res.status === 200 && res.body.hotels.length > 0) {
        const hotel = res.body.hotels[0];
        expect(hotel).toHaveProperty('id');
        expect(hotel).toHaveProperty('name');
        expect(hotel).toHaveProperty('type');
        expect(hotel).toHaveProperty('lat');
        expect(hotel).toHaveProperty('lng');
        expect(hotel).toHaveProperty('distance_km');
      }
    }, TIMEOUTS.overpass);
  });
});
