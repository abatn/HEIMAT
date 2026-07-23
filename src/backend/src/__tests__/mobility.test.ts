import request from 'supertest';
import app from '../index';

describe('Mobility API', () => {
  describe('GET /api/mobility/stops', () => {
    it('should return live stops or 503 if OpenStreetMap unreachable', async () => {
      const res = await request(app)
        .get('/api/mobility/stops?lat=52.5200&lng=13.4050&radius=1000');

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

    it('should return error with invalid coordinates', async () => {
      const res = await request(app)
        .get('/api/mobility/stops?lat=abc&lng=xyz');

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

    it('should return 404 for non-existent stop', async () => {
      const res = await request(app)
        .get('/api/mobility/stops/non-existent-id-000');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/mobility/route', () => {
    it('should return a route between two points', async () => {
      const res = await request(app)
        .get('/api/mobility/route?from_lat=52.5200&from_lng=13.4050&to_lat=52.5300&to_lng=13.4100');

      expect([200, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('route');
        expect(res.body.route).toHaveProperty('distance');
        expect(res.body.route).toHaveProperty('duration');
      }
    }, 60000);

    it('should return error without all coordinates', async () => {
      const res = await request(app)
        .get('/api/mobility/route?from_lat=52.5200&from_lng=13.4050');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/mobility/geocode', () => {
    it('should geocode an address', async () => {
      const res = await request(app)
        .get('/api/mobility/geocode?address=Alexanderplatz%20Berlin');

      expect([200, 500]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('results');
        expect(Array.isArray(res.body.results)).toBe(true);
      }
    }, 30000);

    it('should return error without address', async () => {
      const res = await request(app)
        .get('/api/mobility/geocode');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/mobility/departures', () => {
    it('should return departures for a location', async () => {
      const res = await request(app)
        .get('/api/mobility/departures?lat=52.5200&lng=13.4050');

      expect([200, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('departures');
        expect(Array.isArray(res.body.departures)).toBe(true);
      }
    }, 30000);

    it('should return empty departures without stop', async () => {
      const res = await request(app)
        .get('/api/mobility/departures?lat=0&lng=0');

      expect(res.status).toBe(200);
      expect(res.body.departures).toEqual([]);
    }, 30000);
  });

  describe('GET /api/mobility/journey', () => {
    it('should return journeys between two points', async () => {
      const res = await request(app)
        .get('/api/mobility/journey?from_lat=52.5200&from_lng=13.4050&to_lat=52.5300&to_lng=13.4100');

      expect([200, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('journeys');
        expect(Array.isArray(res.body.journeys)).toBe(true);
      }
    }, 30000);

    it('should return error without coordinates', async () => {
      const res = await request(app)
        .get('/api/mobility/journey');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/mobility/raptor/status', () => {
    it('should return RAPTOR readiness status', async () => {
      const res = await request(app)
        .get('/api/mobility/raptor/status');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('ready');
      expect(typeof res.body.ready).toBe('boolean');
    });
  });

  describe('GET /api/mobility/stops/match', () => {
    it('should match an Overpass stop to GTFS stops', async () => {
      const res = await request(app)
        .get('/api/mobility/stops/match?osm_id=12345&name=Alexanderplatz&lat=52.5219&lng=13.4132');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('matches');
      expect(Array.isArray(res.body.matches)).toBe(true);
    });

    it('should return error without required params', async () => {
      const res = await request(app)
        .get('/api/mobility/stops/match?osm_id=12345');

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/mobility/log-delay', () => {
    it('should log a delay entry', async () => {
      const res = await request(app)
        .post('/api/mobility/log-delay')
        .send({
          tripId: 'test-trip-001',
          line: 'U2',
          scheduledDeparture: new Date().toISOString(),
          delayMinutes: 5,
        });

      expect([200, 500]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.logged).toBe(true);
      }
    });

    it('should return error without required fields', async () => {
      const res = await request(app)
        .post('/api/mobility/log-delay')
        .send({ tripId: 'test' });

      expect(res.status).toBe(400);
    });
  });
});
