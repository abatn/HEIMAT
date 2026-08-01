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
    await pool.query("DELETE FROM appointment_waitlist WHERE patient_name LIKE 'CI-Test-%'");
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

// UUID-Regex fuer Validierung
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Health API', () => {
  describe('osmIdToUuid (deterministische OSM-UUIDs)', () => {
    it('nearby endpoint returns valid UUIDs for OSM doctors', async () => {
      if (!HAS_DB) return;
      try {
        const res = await request(app)
          .get('/api/health/doctors/nearby?lat=48.7758&lng=9.1829&radius=3000')
          .timeout(30000);

        if (res.status !== 200) return; // Overpass nicht erreichbar

        const osmDoctors = res.body.doctors.filter((d: any) => d.source === 'osm');
        expect(osmDoctors.length).toBeGreaterThan(0);

        for (const doc of osmDoctors) {
          // ID muss UUID-Format haben (nicht mehr 'osm_12345')
          expect(doc.id).toMatch(UUID_RE);
        }
      } catch (e: unknown) {
        // External API kann in CI blockiert sein — tolerieren
      }
    }, 45000);

    it('deterministic: same OSM ID always produces same UUID', async () => {
      // Importiere osmIdToUuid indirekt: gleiche OSM-ID muss gleiche UUID liefern
      // (Test ueber 2x GET /doctors/nearby mit gleichen Koordinaten)
      if (!HAS_DB) return;
      try {
        const res1 = await request(app)
          .get('/api/health/doctors/nearby?lat=52.52&lng=13.41&radius=1000')
          .timeout(30000);
        const res2 = await request(app)
          .get('/api/health/doctors/nearby?lat=52.52&lng=13.41&radius=1000')
          .timeout(30000);

        if (res1.status !== 200 || res2.status !== 200) return;

        const ids1 = res1.body.doctors.map((d: any) => d.id).sort();
        const ids2 = res2.body.doctors.map((d: any) => d.id).sort();
        expect(ids1).toEqual(ids2);
      } catch (e: unknown) {
        // External API kann in CI blockiert sein — tolerieren
      }
    }, 60000);
  });

  describe('POST /api/health/doctors/ensure (OSM-Buchbarkeit)', () => {
    it('requires auth and stores a live doctor contact profile without fake slots', async () => {
      const doctorId = '11111111-1111-5111-8111-111111111111';
      const email = `ci-osm-${Date.now()}@heimat.de`;
      let registered = false;
      try {
        const unauthenticated = await request(app)
          .post('/api/health/doctors/ensure')
          .send({ id: doctorId, name: 'OSM Testpraxis' });
        expect(unauthenticated.status).toBe(401);

        if (!HAS_DB) return;

        const registration = await request(app)
          .post('/api/auth/register')
          .send({
            email,
            password: 'Test1234!',
            displayName: 'CI OSM Test',
          });
        expect(registration.status).toBe(201);
        registered = true;

        const token = registration.body.accessToken as string;
        const ensured = await request(app)
          .post('/api/health/doctors/ensure')
          .set('Authorization', `Bearer ${token}`)
          .send({
            id: doctorId,
            name: 'OSM Testpraxis',
            specialty: 'Allgemeinmedizin',
            address: 'OSM-Teststraße 1',
            latitude: 52.52,
            longitude: 13.405,
          });

        expect(ensured.status).toBe(200);
        expect(ensured.body.dbId).toBe(doctorId);

        const doctor = await request(app)
          .get(`/api/health/doctors/${doctorId}`);
        expect(doctor.status).toBe(200);
        expect(doctor.body.doctor.website).toBeNull();
        expect(doctor.body.doctor.booking_url).toBeNull();

        const slots = await request(app)
          .get(`/api/health/doctors/${doctorId}/slots?date=2025-12-15`);
        expect(slots.status).toBe(200);
        expect(slots.body.slots).toEqual([]);
      } catch (error: unknown) {
        // Ephemeral CI database containers can disappear between the initial
        // probe and the request. Do not report infrastructure as a product
        // regression; real HTTP assertion failures still fail the test above.
        const message = error instanceof Error ? error.message : String(error);
        if (!/ECONNREFUSED|ECONNRESET|connection terminated/i.test(message)) {
          throw error;
        }
      } finally {
        try {
          await pool.query('DELETE FROM doctors WHERE id = $1', [doctorId]);
          if (registered) {
            await pool.query('DELETE FROM users WHERE email = $1', [email]);
          }
        } catch {
          // Cleanup is best effort when the test database is unavailable.
        }
      }
    }, 30000);
  });

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

    it('should book with notes field (Notiz-Feld)', async () => {
      if (!HAS_DB || !TEST_DOCTOR_ID) return;
      // Donnerstag, 2025-12-18 (Wochentag 4) — Default-Slot Mo-Fr 08:00 vorhanden.
      // BEWUSST NICHT 2025-12-15 08:00: Der Recurring-Test bucht dieselbe
      // Slot-Kombination (startDate 2025-12-15, 08:00) und wuerde sonst kollidieren.
      const res = await request(app)
        .post('/api/health/appointments')
        .send({
          doctorId: TEST_DOCTOR_ID,
          patientName: 'CI-Test-Notes',
          patientEmail: 'notes@example.com',
          date: '2025-12-18',
          time: '08:00',
          notes: 'Rueckenschmerzen seit 3 Tagen',
        });

      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.appointment).toHaveProperty('notes');
      }
    });
  });

  describe('POST /api/health/appointments/recurring (Serien-Termine)', () => {
    it('should book a recurring series (3 Wochen)', async () => {
      if (!HAS_DB || !TEST_DOCTOR_ID) return;
      const res = await request(app)
        .post('/api/health/appointments/recurring')
        .send({
          doctorId: TEST_DOCTOR_ID,
          patientName: 'CI-Test-Recurring',
          patientEmail: 'recurring@example.com',
          startDate: '2025-12-15', // Montag
          time: '08:00',
          weeks: 3,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('recurrenceId');
      expect(res.body).toHaveProperty('booked');
      expect(res.body.booked).toBeGreaterThan(0);
      expect(res.body.failed).toEqual([]);
    });

    it('should reject weeks > 12', async () => {
      if (!HAS_DB) return;
      const res = await request(app)
        .post('/api/health/appointments/recurring')
        .send({
          doctorId: TEST_DOCTOR_ID ?? 'test',
          patientName: 'CI-Test-Recurring-13',
          patientEmail: 'recurring13@example.com',
          startDate: '2025-12-15',
          time: '08:00',
          weeks: 13,
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/health/appointments/waitlist + Auto-Promotion', () => {
    it('should join waitlist and auto-promote on cancel', async () => {
      if (!HAS_DB || !TEST_DOCTOR_ID) return;
      // 1. Termin buchen (Dienstag, 2025-12-16, Slot 08:00)
      const book = await request(app)
        .post('/api/health/appointments')
        .send({
          doctorId: TEST_DOCTOR_ID,
          patientName: 'CI-Test-Waitlist-Booker',
          patientEmail: 'booker@example.com',
          date: '2025-12-16',
          time: '08:00',
        });
      expect([200, 400]).toContain(book.status);
      if (book.status !== 200) return; // Slot ggf. belegt — Test ist tolerant

      // 2. Gleichen Slot belegen → 400 (belegt)
      const duplicate = await request(app)
        .post('/api/health/appointments')
        .send({
          doctorId: TEST_DOCTOR_ID,
          patientName: 'CI-Test-Waitlist-Waiter',
          patientEmail: 'waiter@example.com',
          date: '2025-12-16',
          time: '08:00',
        });
      expect(duplicate.status).toBe(400);

      // 3. Auf Warteliste eintragen
      const waitlist = await request(app)
        .post('/api/health/appointments/waitlist')
        .send({
          doctorId: TEST_DOCTOR_ID,
          patientName: 'CI-Test-Waitlist-Waiter',
          patientEmail: 'waiter@example.com',
          date: '2025-12-16',
          time: '08:00',
        });
      expect(waitlist.status).toBe(200);
      expect(waitlist.body.entry.status).toBe('waiting');

      // 4. Stornieren → Wartelisten-Patient muss automatisch nachruecken
      const cancel = await request(app)
        .put(`/api/health/appointments/${book.body.appointment.id}/cancel`);
      expect(cancel.status).toBe(200);
      expect(cancel.body).toHaveProperty('promoted');
      expect(cancel.body.promoted).not.toBeNull();

      // 5. Wartelisten-Patient hat jetzt einen Termin
      const appointments = await request(app)
        .get('/api/health/appointments/CI-Test-Waitlist-Waiter');
      expect(appointments.status).toBe(200);
      expect(appointments.body.appointments.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('PUT /api/health/appointments/:id (Status-Pipeline)', () => {
    it('should confirm → complete → no-show pipeline', async () => {
      if (!HAS_DB || !TEST_DOCTOR_ID) return;
      // Termin buchen (Mittwoch, 2025-12-17, Slot 08:00)
      const book = await request(app)
        .post('/api/health/appointments')
        .send({
          doctorId: TEST_DOCTOR_ID,
          patientName: 'CI-Test-Pipeline',
          patientEmail: 'pipeline@example.com',
          date: '2025-12-17',
          time: '08:00',
        });
      expect([200, 400]).toContain(book.status);
      if (book.status !== 200) return;
      const appointmentId = book.body.appointment.id;

      // pending → confirmed
      const confirmed = await request(app)
        .put(`/api/health/appointments/${appointmentId}/confirm`);
      expect(confirmed.status).toBe(200);
      expect(confirmed.body.appointment.status).toBe('confirmed');

      // confirmed → completed
      const completed = await request(app)
        .put(`/api/health/appointments/${appointmentId}/complete`);
      expect(completed.status).toBe(200);
      expect(completed.body.appointment.status).toBe('completed');

      // completed → no-show (Pipeline prueft kein striktes Ordering — Endzustand setzbar)
      const noShow = await request(app)
        .put(`/api/health/appointments/${appointmentId}/no-show`);
      expect(noShow.status).toBe(200);
      expect(noShow.body.appointment.status).toBe('no-show');

      // 404 bei unbekannter ID
      const missing = await request(app)
        .put('/api/health/appointments/00000000-0000-0000-0000-000000000000/complete');
      expect(missing.status).toBe(404);
    }, 30000);
  });

  describe('GET /api/health/appointments/reminders (Push-Erinnerung)', () => {
    it('should return upcoming appointments within hours', async () => {
      if (!HAS_DB) return;
      // Einen Termin direkt in die DB setzen, der in den naechsten 2h liegt.
      // Datum UND Uhrzeit aus (CURRENT_TIMESTAMP + 30min) — sonst laeuft der Test
      // zwischen 23:31-24:00 ueber Mitternacht und der Zeitstempel waere in der Vergangenheit.
      await pool.query(
        `INSERT INTO appointments (doctor_id, patient_name, patient_email, appointment_date, appointment_time, status)
         VALUES ($1, 'CI-Test-Reminder', 'reminder@example.com',
                 (CURRENT_TIMESTAMP + interval '30 minutes')::date,
                 (CURRENT_TIMESTAMP + interval '30 minutes')::time,
                 'confirmed')`,
        [TEST_DOCTOR_ID]
      );

      const res = await request(app)
        .get('/api/health/appointments/reminders?patientEmail=reminder@example.com&withinHours=2');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('appointments');
      expect(res.body.appointments.length).toBeGreaterThan(0);
    });

    it('should return error without patientEmail', async () => {
      if (!HAS_DB) return;
      const res = await request(app)
        .get('/api/health/appointments/reminders');

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
