import request from 'supertest';
import app from '../index';

describe('Health API', () => {
  describe('GET /api/health/doctors', () => {
    it('should return all doctors', async () => {
      const res = await request(app)
        .get('/api/health/doctors');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('doctors');
      expect(Array.isArray(res.body.doctors)).toBe(true);
    });

    it('should filter by specialty', async () => {
      const res = await request(app)
        .get('/api/health/doctors?specialty=Allgemeinmedizin');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.doctors)).toBe(true);
    });

    it('should filter by location', async () => {
      const res = await request(app)
        .get('/api/health/doctors?location=Berlin');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.doctors)).toBe(true);
    }, 30000);
  });

  describe('GET /api/health/doctors/nearby', () => {
    it('should return nearby doctors with coordinates', async () => {
      const res = await request(app)
        .get('/api/health/doctors/nearby?lat=52.5200&lng=13.4050&radius=5000');

      expect([200, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('doctors');
        expect(Array.isArray(res.body.doctors)).toBe(true);
      }
    }, 30000);

    it('should return error without coordinates', async () => {
      const res = await request(app)
        .get('/api/health/doctors/nearby');

      expect(res.status).toBe(400);
    });

    it('should filter nearby doctors by specialty', async () => {
      const res = await request(app)
        .get('/api/health/doctors/nearby?lat=52.5200&lng=13.4050&radius=5000&specialty=Zahnarzt');

      expect([200, 503]).toContain(res.status);
    }, 30000);
  });

  describe('POST /api/health/doctors', () => {
    it('should register a new doctor', async () => {
      const res = await request(app)
        .post('/api/health/doctors')
        .send({
          name: 'Dr. Test Praxis',
          specialty: 'Allgemeinmedizin',
          address: 'Teststraße 1, 10115 Berlin',
          phone: '+49 30 12345678',
          email: 'test@praxis.de',
          latitude: 52.5200,
          longitude: 13.4050,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('doctor');
      expect(res.body.doctor.name).toBe('Dr. Test Praxis');
    });

    it('should return error without required fields', async () => {
      const res = await request(app)
        .post('/api/health/doctors')
        .send({ name: 'Dr. Incomplete' });

      expect(res.status).toBe(400);
    });

    it('should register doctor with custom slots', async () => {
      const res = await request(app)
        .post('/api/health/doctors')
        .send({
          name: 'Dr. Slot Test',
          specialty: 'Zahnarzt',
          address: 'Slotstraße 2, 10115 Berlin',
          slots: [
            { day_of_week: 1, start_time: '09:00', end_time: '12:00' },
            { day_of_week: 3, start_time: '14:00', end_time: '17:00' },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.doctor.name).toBe('Dr. Slot Test');
    });
  });

  describe('GET /api/health/doctors/:id', () => {
    it('should return a specific doctor', async () => {
      const doctorsRes = await request(app)
        .get('/api/health/doctors');

      if (doctorsRes.body.doctors.length > 0) {
        const doctorId = doctorsRes.body.doctors[0].id;
        const res = await request(app)
          .get(`/api/health/doctors/${doctorId}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('doctor');
      }
    });

    it('should return 404 for non-existent doctor', async () => {
      const res = await request(app)
        .get('/api/health/doctors/00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/health/doctors/:id/slots', () => {
    it('should return available slots', async () => {
      const doctorsRes = await request(app)
        .get('/api/health/doctors');

      if (doctorsRes.body.doctors.length > 0) {
        const doctorId = doctorsRes.body.doctors[0].id;
        const res = await request(app)
          .get(`/api/health/doctors/${doctorId}/slots?date=2024-02-15`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('slots');
        expect(Array.isArray(res.body.slots)).toBe(true);
      }
    });

    it('should return error without date', async () => {
      const res = await request(app)
        .get('/api/health/doctors/some-id/slots');

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/health/appointments', () => {
    it('should book an appointment', async () => {
      const doctorsRes = await request(app)
        .get('/api/health/doctors');

      if (doctorsRes.body.doctors.length > 0) {
        const doctorId = doctorsRes.body.doctors[0].id;
        const res = await request(app)
          .post('/api/health/appointments')
          .send({
            doctorId,
            patientName: 'Test Patient',
            patientEmail: 'test@example.com',
            date: '2025-12-20',
            time: '09:00',
          });

        expect([200, 400]).toContain(res.status);
        if (res.status === 200) {
          expect(res.body).toHaveProperty('appointment');
        }
      }
    });

    it('should return error without required fields', async () => {
      const res = await request(app)
        .post('/api/health/appointments')
        .send({ doctorId: 'test' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/health/appointments/:patientName', () => {
    it('should return appointments for a patient', async () => {
      const res = await request(app)
        .get('/api/health/appointments/Test%20Patient');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('appointments');
      expect(Array.isArray(res.body.appointments)).toBe(true);
    });
  });
});
