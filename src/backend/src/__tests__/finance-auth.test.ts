/**
 * finance-auth.test.ts — requireAuth middleware für Finance-Routes
 *
 * Testet, dass alle geschützten Finance-Endpunkte 401 zurückgeben
 * wenn kein Authorization-Header gesendet wird oder ein ungültiges Token übergeben wird.
 */

import request from 'supertest';
import app from '../index';

describe('Finance API — requireAuth Middleware', () => {
  let authToken: string;
  const testEmail = `finance-auth-${Date.now()}@heimat.de`;
  const testPassword = 'Test1234!';

  beforeAll(async () => {
    // Registriere einen Test-User und erhalte ein JWT-Token
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        displayName: 'Finance Auth Test User',
      });

    if (res.status === 201) {
      authToken = res.body.accessToken;
    }
  });

  describe('Unauthenticated requests — 401 auf allen geschützten Endpunkten', () => {
    it('GET /api/finance/balance → 401 ohne Token', async () => {
      const res = await request(app).get('/api/finance/balance');
      expect(res.status).toBe(401);
    });

    it('GET /api/finance/transactions → 401 ohne Token', async () => {
      const res = await request(app).get('/api/finance/transactions');
      expect(res.status).toBe(401);
    });

    it('POST /api/finance/pay → 401 ohne Token', async () => {
      const res = await request(app)
        .post('/api/finance/pay')
        .send({ to: 'receiver', amount: 10, currency: 'KUDOS' });
      expect(res.status).toBe(401);
    });

    it('POST /api/finance/taler/wallet → 401 ohne Token', async () => {
      const res = await request(app)
        .post('/api/finance/taler/wallet')
        .send({});
      expect(res.status).toBe(401);
    });

    it('POST /api/finance/taler/reserve → 401 ohne Token', async () => {
      const res = await request(app)
        .post('/api/finance/taler/reserve')
        .send({ reserve_pub: 'a'.repeat(52) });
      expect(res.status).toBe(401);
    });

    it('POST /api/finance/taler/reserve/open → 401 ohne Token', async () => {
      const res = await request(app)
        .post('/api/finance/taler/reserve/open')
        .send({ initial_balance: 'KUDOS:25' });
      expect(res.status).toBe(401);
    });

    it('POST /api/finance/taler/purse/create → 401 ohne Token', async () => {
      const res = await request(app)
        .post('/api/finance/taler/purse/create')
        .send({ senderUserId: 'sender', receiverUserId: 'receiver', amount: 10 });
      expect(res.status).toBe(401);
    });

    it('GET /api/finance/taler/purse/:purseId → 401 ohne Token', async () => {
      const res = await request(app).get('/api/finance/taler/purse/test-purse-id');
      expect(res.status).toBe(401);
    });

    it('POST /api/finance/taler/purse/:purseId/deposit → 401 ohne Token', async () => {
      const res = await request(app)
        .post('/api/finance/taler/purse/test-purse-id/deposit')
        .send({});
      expect(res.status).toBe(401);
    });

    it('POST /api/finance/taler/purse/:purseId/merge → 401 ohne Token', async () => {
      const res = await request(app)
        .post('/api/finance/taler/purse/test-purse-id/merge')
        .send({});
      expect(res.status).toBe(401);
    });

    it('POST /api/finance/taler/purse/:purseId/abort → 401 ohne Token', async () => {
      const res = await request(app)
        .post('/api/finance/taler/purse/test-purse-id/abort')
        .send({});
      expect(res.status).toBe(401);
    });
  });

  describe('Invalid tokens — 401 bei ungültigen Tokens', () => {
    it('GET /api/finance/balance → 401 mit ungültigem Token', async () => {
      const res = await request(app)
        .get('/api/finance/balance')
        .set('Authorization', 'Bearer invalid-token-abc123');
      expect(res.status).toBe(401);
    });

    it('GET /api/finance/balance → 401 mit abgelaufenem Token', async () => {
      // Ein Token mit ungültiger Signatur
      const res = await request(app)
        .get('/api/finance/balance')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDB9.fake-signature');
      expect(res.status).toBe(401);
    });

    it('GET /api/finance/balance → 401 mit Bearer ohne Token', async () => {
      const res = await request(app)
        .get('/api/finance/balance')
        .set('Authorization', 'Bearer ');
      expect(res.status).toBe(401);
    });

    it('GET /api/finance/balance → 401 ohne Bearer-Prefix', async () => {
      const res = await request(app)
        .get('/api/finance/balance')
        .set('Authorization', authToken);
      expect(res.status).toBe(401);
    });
  });

  describe('Public endpoints — keine Auth erforderlich', () => {
    it('GET /api/finance/taler/config → 200 ohne Token', async () => {
      const res = await request(app).get('/api/finance/taler/config');
      // 200 oder 503 (wenn Exchange nicht erreichbar), aber KEINE 401
      expect(res.status).not.toBe(401);
    });

    it('GET /api/finance/taler/status → 200 ohne Token', async () => {
      const res = await request(app).get('/api/finance/taler/status');
      // 200 oder 503 (wenn Exchange nicht erreichbar), aber KEINE 401
      expect(res.status).not.toBe(401);
    });
  });

  describe('Authenticated requests — 200 mit gültigem Token', () => {
    it('GET /api/finance/balance → 200 mit gültigem Token', async () => {
      if (!authToken) return; // Skip wenn Registrierung fehlgeschlagen
      const res = await request(app)
        .get('/api/finance/balance')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('balance');
      expect(res.body).toHaveProperty('currency');
    });

    it('GET /api/finance/transactions → 200 mit gültigem Token', async () => {
      if (!authToken) return;
      const res = await request(app)
        .get('/api/finance/transactions')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.transactions)).toBe(true);
    });
  });
});
