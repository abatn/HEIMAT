import request from 'supertest';
import app from '../index';
import { withRetry, isAcceptableStatus, TIMEOUTS } from '../utils/test-utils';

// CI-kritisch: Globaler Timeout für externe APIs (Overpass kann langsam sein)
jest.setTimeout(120_000);

describe('Parken API', () => {
  describe('GET /api/parking/spots', () => {
    it('should return live parking spots or 503 if OpenStreetMap unreachable', async () => {
      const res = await withRetry(
        () =>
          request(app).get(
            '/api/parking/spots?lat=52.5200&lng=13.4050&radius_km=2',
          ),
        { name: 'parking-spots', retries: 3, timeoutMs: TIMEOUTS.overpass },
      );

      expect(isAcceptableStatus(res.status)).toBe(true);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('spots');
        expect(Array.isArray(res.body.spots)).toBe(true);
        expect(res.body).toHaveProperty('count');
        expect(res.body).toHaveProperty('attribution', 'OpenStreetMap');
        expect(res.body).toHaveProperty('license', 'ODbL-1.0');
        if (res.body.spots.length > 0) {
          const spot = res.body.spots[0];
          expect(spot).toHaveProperty('id');
          expect(spot).toHaveProperty('name');
          expect(spot).toHaveProperty('latitude');
          expect(spot).toHaveProperty('longitude');
          expect(spot).toHaveProperty('attribution', 'OpenStreetMap');
        }
      }
    }, TIMEOUTS.overpass);

    it('should accept default radius when radius_km is omitted', async () => {
      const res = await withRetry(
        () =>
          request(app).get(
            '/api/parking/spots?lat=52.5200&lng=13.4050',
          ),
        { name: 'parking-default-radius', retries: 3, timeoutMs: TIMEOUTS.overpass },
      );

      expect(isAcceptableStatus(res.status)).toBe(true);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('radius_km', 2);
      }
    }, TIMEOUTS.overpass);

    it('should return error without coordinates', async () => {
      const res = await request(app).get('/api/parking/spots');
      expect(res.status).toBe(400);
    });

    it('should return error with invalid coordinates', async () => {
      const res = await request(app).get(
        '/api/parking/spots?lat=abc&lng=xyz',
      );
      expect(res.status).toBe(400);
    });

    it('should return error with radius_km out of range', async () => {
      const res = await request(app).get(
        '/api/parking/spots?lat=52.52&lng=13.41&radius_km=100',
      );
      expect(res.status).toBe(400);
    });

    it('should return error with negative radius_km', async () => {
      const res = await request(app).get(
        '/api/parking/spots?lat=52.52&lng=13.41&radius_km=-5',
      );
      expect(res.status).toBe(400);
    });
  });
});
