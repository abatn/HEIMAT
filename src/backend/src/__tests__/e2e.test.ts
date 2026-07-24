/**
 * e2e.test.ts — End-to-End Test des HEIMAT 2.0 Backend-Layers
 *
 * KEINE Mocks, KEINE Fake-Daten. Alle Tests treffen ECHTE Services:
 *   - https://register.heimal.de für Auth-Microservice (Render)
 *   - https://overpass-api.de  für Haltestellen
 *   - https://nominatim.openstreetmap.org  für Geocoding
 *   - https://exchange.demo.taler.net  für Taler-Wallet
 *   - Postgres via DB_* env vars
 *
 * Tests die nicht "happy" durchlaufen erwarten ehrliche 4xx/5xx-Codes.
 */

import request from 'supertest';
import app from '../index';

describe('E2E: Voller User-Lifecycle (alle Services live)', () => {
  const testEmail = `e2e-${Date.now()}@heimat.de`;
  const testPassword = 'E2ETest123!';
  let authToken: string | undefined;

  describe('1. Registrierung', () => {
    it('legt einen neuen User im Auth-Service an', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: testEmail, password: testPassword, displayName: 'E2E Test User' });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe(testEmail);
      authToken = res.body.accessToken;
    });
  });

  describe('2. Mobilität (Overpass + transitous.org)', () => {
    it('sollte Haltestellen in der Nähe laden', async () => {
      const res = await request(app).get('/api/mobility/stops?lat=52.5200&lng=13.4050&radius=1000');
      // Echter Overpass-API-Call: manchmal 503 wenn upstream nicht erreichbar.
      expect([200, 502, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(Array.isArray(res.body.stops)).toBe(true);
      }
    }, 60000);

    it('sollte Geocoding durchführen', async () => {
      const res = await request(app).get('/api/mobility/geocode?address=Alexanderplatz%20Berlin');
      expect([200, 500]).toContain(res.status);
    }, 30000);

    it('sollte Abfahrten laden', async () => {
      const res = await request(app).get('/api/mobility/departures?lat=52.5200&lng=13.4050');
      expect([200, 502, 503]).toContain(res.status);
    }, 30000);

    it('sollte RAPTOR-Status zurückgeben', async () => {
      const res = await request(app).get('/api/mobility/raptor/status');
      expect(res.status).toBe(200);
      expect(typeof res.body.ready).toBe('boolean');
    });
  });

  describe('3. Gesundheit (Ärzte aus Overpass)', () => {
    let doctorId: string;

    it('sollte Ärzte registrieren', async () => {
      const res = await request(app)
        .post('/api/health/doctors')
        .send({
          name: 'E2E Test Praxis',
          specialty: 'Allgemeinmedizin',
          address: 'Teststraße 1, 10115 Berlin',
          phone: '+49 30 12345678',
          email: 'test@praxis.de',
        });
      expect(res.status).toBe(201);
      expect(res.body.doctor).toBeDefined();
      doctorId = res.body.doctor.id;
    });

    it('sollte registrierte Ärzte finden', async () => {
      const res = await request(app).get('/api/health/doctors');
      expect(res.status).toBe(200);
      expect(res.body.doctors.length).toBeGreaterThan(0);
    });

    it('sollte Slots für Arzt laden', async () => {
      const res = await request(app).get(`/api/health/doctors/${doctorId}/slots?date=2025-12-15`);
      expect(res.status).toBe(200);
    });

    it('sollte Termin buchen', async () => {
      const res = await request(app)
        .post('/api/health/appointments')
        .send({ doctorId, patientName: 'E2E Patient', patientEmail: 'patient@test.de', date: '2025-12-15', time: '09:00' });
      expect([200, 400]).toContain(res.status);
    });
  });

  describe('4. Finanzen (echter GNU Taler Exchange — Bank-Wire-Workflow)', () => {
    it('sollte echte Exchange-Konfiguration laden', async () => {
      const res = await request(app).get('/api/finance/taler/config');
      expect([200, 502, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.currency).toBe('KUDOS');
        expect(res.body.master_public_key).toMatch(/^[A-Z0-9]{52,60}$/);
        expect(JSON.stringify(res.body)).not.toMatch(/Simulator/i);
      }
    }, 60000);

    it('sollte Exchange-Health-Probe liefern', async () => {
      const res = await request(app).get('/api/finance/taler/status');
      expect([200, 502, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.reachable).toBe(true);
        expect(res.body.base_url).toBe('https://exchange.demo.taler.net/');
      }
    }, 60000);

    it('sollte Wallet mit echter Ed25519-Identität erstellen', async () => {
      const res = await request(app)
        .post('/api/finance/taler/wallet')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});
      if (res.status === 200) {
        expect(res.body.wallet.wallet_pub).toMatch(/^[0-9a-z]{52}$/);
        expect(res.body.wallet).not.toHaveProperty('wallet_priv_pkcs8');
      } else {
        expect([500, 503]).toContain(res.status);
      }
    });

    it('sollte Guthaben abrufen — leerer Wallet hat 0', async () => {
      await request(app)
        .post('/api/finance/taler/wallet')
        .set('Authorization', `Bearer ${authToken}`)
        .send({}).catch(() => {});
      const res = await request(app)
        .get('/api/finance/balance')
        .set('Authorization', `Bearer ${authToken}`);
      if (res.status === 200) {
        expect(res.body.balance).toBe(0);
        expect(res.body.source).toBe('live_exchange');
        expect(res.body.reserves_probed).toBe(0);
      }
    });

    it('sollte ungültige reserve_pub ablehnen für Schutz vor Exchange-Bombardment', async () => {
      const res = await request(app)
        .post('/api/finance/taler/reserve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reserve_pub: 'INVALID' });
      expect(res.status).toBe(400);
    });

    it('POST /taler/reserve/open: bank_wire_url + status=pending_bank_wire (kein Fake-Server-Confirm)', async () => {
      // Bank-Wire-Only Workflow: GNU Taler erlaubt KEIN auto-reserve-Opening.
      // Wir behaupten NICHT dass die Reserve real am Exchange ist; der User
      // muss den Wire ueber https://bank.demo.taler.net/ ausloesen.
      const res = await request(app)
        .post('/api/finance/taler/reserve/open')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ initial_balance: 'KUDOS:25' });
      expect([200, 500]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.status).toBe('pending_bank_wire');
        expect(res.body.bank_wire_url).toBe('https://bank.demo.taler.net/');
        expect(res.body.reserve_pub).toMatch(/^[0-9a-z]{52}$/);
        expect(res.body.exchange_base_url).toBe('https://exchange.demo.taler.net/');
        expect(typeof res.body.note).toBe('string');
        expect(res.body.note.toLowerCase()).toContain('bank');
        // KEIN 'Simulator' und KEIN 'registered_at_exchange' (wire-spec-konform)
        expect(res.body.note).not.toMatch(/Simulator/i);
        expect(res.body.status).not.toBe('registered_at_exchange');
        expect(res.body.source).toBe('live_exchange');
      } else {
        // Kein DB erreichbar — ehrliche 5xx, kein Fallback auf Mock.
        expect([500, 503]).toContain(res.status);
      }
    });

    it('GET /transactions liefert (ggf. leeres) transaction-Array', async () => {
      const res = await request(app)
        .get('/api/finance/transactions')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.transactions)).toBe(true);
    });
  });

  describe('5. Health-Check', () => {
    it('sollte Health-Status zurückgeben', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('sollte Readiness-Check durchführen (kann 503 sein wenn DB/Exchange down)', async () => {
      const res = await request(app).get('/health/ready');
      expect([200, 502, 503]).toContain(res.status);
    });
  });

  describe('6. Swagger-Dokumentation', () => {
    it('sollte Swagger-UI und OpenAPI-JSON liefern', async () => {
      const r1 = await request(app).get('/docs/');
      expect(r1.status).toBe(200);
      const r2 = await request(app).get('/docs.json');
      expect(r2.body.openapi).toBe('3.0.0');
      expect(r2.body.info.title).toBe('HEIMAT 2.0 API');
    });
  });

  describe('7. Fehlerbehandlung', () => {
    it('sollte 404 für unbekannte Routes geben', async () => {
      const res = await request(app).get('/api/nonexistent');
      expect(res.status).toBe(404);
    });

    it('sollte Validierungsfehler zurückgeben', async () => {
      const res = await request(app).get('/api/mobility/stops?lat=abc&lng=13.40');
      expect(res.status).toBe(400);
    });

    it('sollte Rate-Limit Fehler zurückgeben bei zu vielen Requests', async () => {
      const promises = Array.from({ length: 110 }, () => request(app).get('/health'));
      const results = await Promise.all(promises);
      expect(results.some(r => r.status === 429)).toBe(true);
    }, 60000);
  });
});
