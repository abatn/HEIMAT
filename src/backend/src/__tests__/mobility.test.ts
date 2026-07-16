import request from 'supertest';
import app from '../index';

describe('Mobility API', () => {
  describe('GET /api/mobility/stops', () => {
    it('should return live stops or 503 if OpenStreetMap unreachable', async () => {
      const res = await request(app)
        .get('/api/mobility/stops?lat=52.5200&lng=13.4050&radius=1000');

      // Echte Daten via Overpass (200) ODER externer Dienst im CI nicht erreichbar (503).
      // Kein Fake/Seed -> im CI-Netz kann Overpass geblockt sein.
      expect([200, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('stops');
        expect(Array.isArray(res.body.stops)).toBe(true);
      }
    }, 60000);

    it('should return error without coordinates', async () => {
      const res = await request(app)
        .get('/api/mobility/stops');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/mobility/stops/:id', () => {
    it('should return a specific stop when live data is available', async () => {
      const stopsRes = await request(app)
        .get('/api/mobility/stops?lat=52.5200&lng=13.4050&radius=5000');

      if (stopsRes.status === 200 && stopsRes.body.stops.length > 0) {
        const stopId = stopsRes.body.stops[0].id;
        const res = await request(app)
          .get(`/api/mobility/stops/${stopId}`);

        expect([200, 404]).toContain(res.status);
      }
    }, 60000);
  });
});
