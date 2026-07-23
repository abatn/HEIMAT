import request from 'supertest';
import app from '../index';

describe('Zod Validation', () => {
  describe('Mobility - /stops', () => {
    it('should reject request without lat', async () => {
      const res = await request(app)
        .get('/api/mobility/stops?lng=13.4050');
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Validation error');
    });

    it('should reject request with invalid lat', async () => {
      const res = await request(app)
        .get('/api/mobility/stops?lat=999&lng=13.4050');
      expect(res.status).toBe(400);
    });

    it('should reject request with invalid lng', async () => {
      const res = await request(app)
        .get('/api/mobility/stops?lat=52.52&lng=abc');
      expect(res.status).toBe(400);
    });
  });

  describe('Mobility - /route', () => {
    it('should reject request without all coordinates', async () => {
      const res = await request(app)
        .get('/api/mobility/route?from_lat=52.52&from_lng=13.40');
      expect(res.status).toBe(400);
    });

    it('should reject request with non-numeric coordinates', async () => {
      const res = await request(app)
        .get('/api/mobility/route?from_lat=abc&from_lng=13.40&to_lat=52.51&to_lng=13.39');
      expect(res.status).toBe(400);
    });
  });

  describe('Mobility - /geocode', () => {
    it('should reject request without address', async () => {
      const res = await request(app)
        .get('/api/mobility/geocode');
      expect(res.status).toBe(400);
    });

    it('should reject request with empty address', async () => {
      const res = await request(app)
        .get('/api/mobility/geocode?address=');
      expect(res.status).toBe(400);
    });
  });

  describe('Mobility - /journey', () => {
    it('should reject request without coordinates', async () => {
      const res = await request(app)
        .get('/api/mobility/journey');
      expect(res.status).toBe(400);
    });
  });

  describe('Mobility - /stops/match', () => {
    it('should reject request without required params', async () => {
      const res = await request(app)
        .get('/api/mobility/stops/match?osm_id=123');
      expect(res.status).toBe(400);
    });
  });

  describe('Mobility - /log-delay', () => {
    it('should reject request without required fields', async () => {
      const res = await request(app)
        .post('/api/mobility/log-delay')
        .send({ tripId: 'test' });
      expect(res.status).toBe(400);
    });

    it('should reject request with negative delay', async () => {
      const res = await request(app)
        .post('/api/mobility/log-delay')
        .send({
          tripId: 'test',
          line: 'U2',
          scheduledDeparture: new Date().toISOString(),
          delayMinutes: -5,
        });
      expect(res.status).toBe(400);
    });
  });

  describe('Mobility - /ai/intent', () => {
    it('should reject request without message', async () => {
      const res = await request(app)
        .post('/api/mobility/ai/intent')
        .send({});
      expect(res.status).toBe(400);
    });

    it('should reject request with empty message', async () => {
      const res = await request(app)
        .post('/api/mobility/ai/intent')
        .send({ message: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('Finance - /pay', () => {
    it('should reject request without required fields', async () => {
      const res = await request(app)
        .post('/api/finance/pay')
        .send({ from: 'user1' });
      expect(res.status).toBe(400);
    });

    it('should reject request with negative amount', async () => {
      const res = await request(app)
        .post('/api/finance/pay')
        .send({ from: 'user1', to: 'user2', amount: -10 });
      expect(res.status).toBe(400);
    });

    it('should reject request with zero amount', async () => {
      const res = await request(app)
        .post('/api/finance/pay')
        .send({ from: 'user1', to: 'user2', amount: 0 });
      expect(res.status).toBe(400);
    });

    it('should reject request with non-number amount', async () => {
      const res = await request(app)
        .post('/api/finance/pay')
        .send({ from: 'user1', to: 'user2', amount: 'abc' });
      expect(res.status).toBe(400);
    });
  });

  describe('Finance - /taler/wallet', () => {
    it('should reject request without userId', async () => {
      const res = await request(app)
        .post('/api/finance/taler/wallet')
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('Health - /doctors/nearby', () => {
    it('should reject request without coordinates', async () => {
      const res = await request(app)
        .get('/api/health/doctors/nearby');
      expect(res.status).toBe(400);
    });

    it('should reject request with invalid coordinates', async () => {
      const res = await request(app)
        .get('/api/health/doctors/nearby?lat=abc&lng=13.40');
      expect(res.status).toBe(400);
    });
  });

  describe('Health - /doctors (POST)', () => {
    it('should reject request without required fields', async () => {
      const res = await request(app)
        .post('/api/health/doctors')
        .send({ name: 'Dr. Test' });
      expect(res.status).toBe(400);
    });

    it('should reject request with invalid email', async () => {
      const res = await request(app)
        .post('/api/health/doctors')
        .send({
          name: 'Dr. Test',
          specialty: 'Allgemeinmedizin',
          address: 'Teststraße 1',
          email: 'not-an-email',
        });
      expect(res.status).toBe(400);
    });
  });

  describe('Health - /appointments (POST)', () => {
    it('should reject request without required fields', async () => {
      const res = await request(app)
        .post('/api/health/appointments')
        .send({ doctorId: 'test' });
      expect(res.status).toBe(400);
    });

    it('should reject request with invalid date format', async () => {
      const res = await request(app)
        .post('/api/health/appointments')
        .send({
          doctorId: 'test',
          patientName: 'Test',
          date: '2024/02/15',
          time: '09:00',
        });
      expect(res.status).toBe(400);
    });

    it('should reject request with invalid time format', async () => {
      const res = await request(app)
        .post('/api/health/appointments')
        .send({
          doctorId: 'test',
          patientName: 'Test',
          date: '2024-02-15',
          time: '9am',
        });
      expect(res.status).toBe(400);
    });
  });
});
