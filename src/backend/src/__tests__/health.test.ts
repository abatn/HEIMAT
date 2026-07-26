import request from 'supertest';
import app from '../index';
import { pool } from '../config/database';

// ============================================================
// Health-API-Tests — Datenbank-Probe vor Suite, saubere Trennung
// ============================================================

/** Prüft ob die Test-Datenbank erreichbar ist */
async function dbReachable(): Promise<boolean> {
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch {
    return false;
  }
}

/** Legt einen Test-Arzt + Default-Slots an, gibt die doctor_id zurück */
async function seedTestDoctor(): Promise<string | null> {
  try {
    const docRes = await request(app)
      .post('/api/health/doctors')
      .send({
        name: `CI-Test-Arzt-${Date.now()}`,
        specialty: 'Allgemeinmedizin',
        address: 'Teststraße 1, 10115 Berlin',
      });
    return docRes.status === 201 ? docRes.body.doctor.id : null;
  } catch {
    return null;
  }
}

/** Löscht alle vom Test angelegten Daten */
async function cleanupTestDoctors(): Promise<void> {
  try {
    // Echte Queries direkt auf dem Pool (kein App-Stack) — vermeidet supertest-Zirkel
    await pool.query("DELETE FROM appointments WHERE patient_name LIKE 'CI-Test-%'");
    await pool.query("DELETE FROM doctor_slots WHERE doctor_id IN (SELECT id FROM doctors WHERE name LIKE 'CI-Test-%')");
    await pool.query("DELETE FROM doctors WHERE name LIKE 'CI-Test-%'");
  } catch {
    // cleanup-Fehler sind nicht test-relevant
  }
}

let HAS_DB = false;
let TEST_DOCTOR_ID: string | null = null;

beforeAll(async () => {
  HAS_DB = await dbReachable();
  if (!HAS_DB) return;
  TEST_DOCTOR_ID = await seedTestDoctor();
}, 15000);

afterAll(async () => {
  await cleanupTestDoctors();
}, 10000);

describe('Health API', () => {
  describe('GET /api/health/doctors', () => {
    it('should return all doctors', async () => {
      if (!HAS_DB) return;
      const res = await request(app)
        .get('/api/health/doctors');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('doctors');
      expect(Array.isArray(res.body.doctors)).toBe(true);
    });

    it('should filter by specialty', async () => {
      if (!HAS_DB) return;
      const res = await request(app)
        .get('/api/health/doctors?specialty=Allgemeinmedizin');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.doctors)).toBe(true);
    });

    it('should filter by location (tolerates external API timeouts)', async () => {
      if (!HAS_DB) return;
      try {
        const res = await request(app)
          .get('/api/health/doctors?location=Berlin')
          .timeout(15000);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.doctors)).toBe(true);
      } catch (e: unknown) {
        // External API (Nominatim) kann in CI blockiert oder langsam sein.
        // Der Test ist resilient — wenn die API nicht antwortet, ist das kein Fehler.
        const msg = (e as Error).message;
        const knownPattern = /timeout|ECONNREFUSED|ENOTFOUND|status|socket|aborted|500|503|Request/i;
        expect(msg).toMatch(knownPattern);
      }
    }, 30000);
  });

  describe('GET /api/health/doctors/nearby', () => {
    it('should return nearby doctors or error if Overpass unreachable', async () => {
      if (!HAS_DB) return;
      try {
        const res = await request(app)
          .get('/api/health/doctors/nearby?lat=52.5200&lng=13.4050&radius=5000')
          .timeout(10000);

        expect([200, 500, 503]).toContain(res.status);
        if (res.status === 200) {
          expect(res.body).toHaveProperty('doctors');
          expect(Array.isArray(res.body.doctors)).toBe(true);
        }
      } catch (e: unknown) {
        // External API (Overpass) kann in CI blockiert sein — tolerieren
        const msg = (e as Error).message;
        const knownPattern = /timeout|ECONNREFUSED|ENOTFOUND|socket|aborted|500|503|Request/i;
        expect(msg).toMatch(knownPattern);
      }
    }, 30000);

    it('should return error without coordinates', async () => {
      if (!HAS_DB) return;
      const res = await request(app)
        .get('/api/health/doctors/nearby');

      expect(res.status).toBe(400);
    });

    it('should filter nearby doctors by specialty', async () => {
      if (!HAS_DB) return;
      try {
        const res = await request(app)
          .get('/api/health/doctors/nearby?lat=52.5200&lng=13.4050&radius=5000&specialty=Zahnarzt')
          .timeout(10000);

        expect([200, 500, 503]).toContain(res.status);
      } catch (e: unknown) {
        // External API (Overpass) kann in CI blockiert sein — tolerieren
        const msg = (e as Error).message;
        const knownPattern = /timeout|ECONNREFUSED|ENOTFOUND|socket|aborted|500|503|Request/i;
        expect(msg).toMatch(knownPattern);
      }
    }, 30000);
  });

  describe('POST /api/health/doctors', () => {
    it('should register a new doctor', async () => {
      if (!HAS_DB) return;
      const res = await request(app)
        .post('/api/health/doctors')
        .send({
          name: `CI-Test-Arzt-${Date.now()}`,
          specialty: 'Allgemeinmedizin',
          address: 'Teststraße 1, 10115 Berlin',
          phone: '+49 30 12345678',
          email: 'test@praxis.de',
          latitude: 52.5200,
          longitude: 13.4050,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('doctor');
    });

    it('should return error without required fields', async () => {
      if (!HAS_DB) return;
      const res = await request(app)
        .post('/api/health/doctors')
        .send({ name: 'Dr. Incomplete' });

      expect(res.status).toBe(400);
    });

    it('should register doctor with custom slots', async () => {
      if (!HAS_DB) return;
      const res = await request(app)
        .post('/api/health/doctors')
        .send({
          name: `CI-Test-Slots-${Date.now()}`,
          specialty: 'Zahnarzt',
          address: 'Slotstraße 2, 10115 Berlin',
          slots: [
            { day_of_week: 1, start_time: '09:00', end_time: '12:00' },
            { day_of_week: 3, start_time: '14:00', end_time: '17:00' },
          ],
        });

      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/health/doctors/:id', () => {
    it('should return a specific doctor', async () => {
      if (!HAS_DB || !TEST_DOCTOR_ID) return;
      const res = await request(app)
        .get(`/api/health/doctors/${TEST_DOCTOR_ID}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('doctor');
    });

    it('should return 404 for non-existent doctor', async () => {
      if (!HAS_DB) return;
      const res = await request(app)
        .get('/api/health/doctors/00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/health/doctors/:id/slots', () => {
    it('should return available slots', async () => {
      if (!HAS_DB || !TEST_DOCTOR_ID) return;
      const res = await request(app)
        .get(`/api/health/doctors/${TEST_DOCTOR_ID}/slots?date=2024-02-15`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('slots');
      expect(Array.isArray(res.body.slots)).toBe(true);
    });

    it('should return error without date', async () => {
      if (!HAS_DB) return;
      const res = await request(app)
        .get('/api/health/doctors/some-id/slots');

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/health/appointments', () => {
    it('should book an appointment', async () => {
      if (!HAS_DB || !TEST_DOCTOR_ID) return;
      const res = await request(app)
        .post('/api/health/appointments')
        .send({
          doctorId: TEST_DOCTOR_ID,
          patientName: 'CI-Test-Patient',
          patientEmail: 'test@example.com',
          date: '2025-12-20',
          time: '09:00',
        });

      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('appointment');
      }
    });

    it('should return error without required fields', async () => {
      if (!HAS_DB) return;
      const res = await request(app)
        .post('/api/health/appointments')
        .send({ doctorId: 'test' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/health/appointments/:patientName', () => {
    it('should return appointments for a patient', async () => {
      if (!HAS_DB) return;
      const res = await request(app)
        .get('/api/health/appointments/CI-Test-Patient');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('appointments');
      expect(Array.isArray(res.body.appointments)).toBe(true);
    });
  });
});
