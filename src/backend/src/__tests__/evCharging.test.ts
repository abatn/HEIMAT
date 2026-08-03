import request from 'supertest';
import app from '../index';
import { withRetry, isAcceptableStatus, TIMEOUTS } from '../utils/test-utils';

describe('E-Ladestationen API', () => {
  describe('GET /api/ev-charging/stations', () => {
    it('should return live stations or 503 if OpenStreetMap unreachable', async () => {
      const res = await withRetry(
        () =>
          request(app).get(
            '/api/ev-charging/stations?lat=52.5200&lng=13.4050&radius_km=5',
          ),
        { name: 'ev-charging', timeoutMs: TIMEOUTS.overpass },
      );

      expect(isAcceptableStatus(res.status)).toBe(true);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('stations');
        expect(Array.isArray(res.body.stations)).toBe(true);
        expect(res.body).toHaveProperty('count');
        expect(res.body).toHaveProperty('attribution', 'OpenStreetMap');
        expect(res.body).toHaveProperty('license', 'ODbL-1.0');
        if (res.body.stations.length > 0) {
          const station = res.body.stations[0];
          expect(station).toHaveProperty('id');
          expect(station).toHaveProperty('name');
          expect(station).toHaveProperty('latitude');
          expect(station).toHaveProperty('longitude');
          expect(station).toHaveProperty('attribution', 'OpenStreetMap');
          expect(station).toHaveProperty('sockets');
          expect(Array.isArray(station.sockets)).toBe(true);
        }
      }
    }, TIMEOUTS.overpass);

    it('should accept default radius when radius_km is omitted', async () => {
      const res = await withRetry(
        () =>
          request(app).get(
            '/api/ev-charging/stations?lat=52.5200&lng=13.4050',
          ),
        { name: 'ev-charging-default', timeoutMs: TIMEOUTS.overpass },
      );

      expect(isAcceptableStatus(res.status)).toBe(true);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('radius_km', 5);
      }
    }, TIMEOUTS.overpass);

    it('should return error without coordinates', async () => {
      const res = await request(app).get('/api/ev-charging/stations');
      expect(res.status).toBe(400);
    });

    it('should return error with invalid coordinates', async () => {
      const res = await request(app).get(
        '/api/ev-charging/stations?lat=abc&lng=xyz',
      );
      expect(res.status).toBe(400);
    });

    it('should return error with radius_km out of range', async () => {
      const res = await request(app).get(
        '/api/ev-charging/stations?lat=52.52&lng=13.41&radius_km=100',
      );
      expect(res.status).toBe(400);
    });

    it('should return error with negative radius_km', async () => {
      const res = await request(app).get(
        '/api/ev-charging/stations?lat=52.52&lng=13.41&radius_km=-5',
      );
      expect(res.status).toBe(400);
    });
  });
});
