import request from 'supertest';
import app from '../index';

describe('Auth API', () => {
  const testEmail = `test-${Date.now()}@heimat.de`;
  const testPassword = 'Test1234!';
  const testName = 'Test User';
  let authToken: string;

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          displayName: testName,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user.display_name).toBe(testName);
      authToken = res.body.accessToken;
    });

    it('should reject duplicate email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          displayName: testName,
        });

      expect(res.status).toBe(409);
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'not-an-email',
          password: testPassword,
          displayName: testName,
        });

      expect(res.status).toBe(400);
    });

    it('should reject short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: `short-${Date.now()}@test.de`,
          password: '123',
          displayName: testName,
        });

      expect(res.status).toBe(400);
    });

    it('should reject missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@test.de' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      authToken = res.body.accessToken;
    });

    it('should reject wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'wrong-password',
        });

      expect(res.status).toBe(401);
    });

    it('should reject non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.de',
          password: testPassword,
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user profile with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(testEmail);
    });

    it('should reject request without token', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('should update display name', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ displayName: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.user.display_name).toBe('Updated Name');
    });
  });

  describe('PUT /api/auth/password', () => {
    it('should change password', async () => {
      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: testPassword,
          newPassword: 'NewPass123!',
        });

      expect(res.status).toBe(200);
    });

    it('should reject wrong current password', async () => {
      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'wrong-password',
          newPassword: 'NewPass123!',
        });

      expect(res.status).toBe(401);
    });
  });
});
