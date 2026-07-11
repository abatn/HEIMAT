import request from 'supertest';
import app from '../index';

describe('Finance API', () => {
  describe('GET /api/finance/wallet/:userId', () => {
    it('should return wallet for user', async () => {
      const res = await request(app)
        .get('/api/finance/wallet/user1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('wallet');
      expect(res.body.wallet).toHaveProperty('balance');
    });
  });

  describe('POST /api/finance/pay', () => {
    it('should create a payment', async () => {
      const res = await request(app)
        .post('/api/finance/pay')
        .send({
          from: 'user1',
          to: 'user2',
          amount: 10.00,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('transaction');
    });

    it('should fail with invalid amount', async () => {
      const res = await request(app)
        .post('/api/finance/pay')
        .send({
          from: 'user1',
          to: 'user2',
          amount: -10,
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/finance/transactions/:userId', () => {
    it('should return transactions for user', async () => {
      const res = await request(app)
        .get('/api/finance/transactions/user1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('transactions');
      expect(Array.isArray(res.body.transactions)).toBe(true);
    });
  });
});
