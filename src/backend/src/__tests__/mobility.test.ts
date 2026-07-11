import request from 'supertest';
import app from '../index';

describe('Mobility API', () => {
  describe('GET /api/mobility/stops', () => {
    it('should return stops near coordinates', async () => {
      const res = await request(app)
        .get('/api/mobility/stops?lat=52.5200&lng=13.4050&radius=1000');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('stops');
      expect(Array.isArray(res.body.stops)).toBe(true);
    });

    it('should return error without coordinates', async () => {
      const res = await request(app)
        .get('/api/mobility/stops');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/mobility/stops/:id', () => {
    it('should return a specific stop', async () => {
      // First get a stop ID
      const stopsRes = await request(app)
        .get('/api/mobility/stops?lat=52.5200&lng=13.4050&radius=5000');

      if (stopsRes.body.stops.length > 0) {
        const stopId = stopsRes.body.stops[0].id;
        const res = await request(app)
          .get(`/api/mobility/stops/${stopId}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('stop');
      }
    });
  });
});
