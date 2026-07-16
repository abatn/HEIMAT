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
            date: '2024-02-20',
            time: '09:00',
          });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('appointment');
      }
    });
  });
});
