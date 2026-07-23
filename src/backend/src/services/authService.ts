import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { queryOne, query } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'heimat-jwt-secret-change-in-production';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';
const SALT_ROUNDS = 10;

export interface User {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface AuthTokens {
  accessToken: string;
  user: User;
}

export class AuthService {
  async register(email: string, password: string, displayName: string): Promise<AuthTokens> {
    const existing = await queryOne<User>('SELECT id FROM users WHERE email = $1', [email]);
    if (existing) {
      throw new AppError('E-Mail bereits registriert', 409);
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await queryOne<User>(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, created_at`,
      [email, passwordHash, displayName]
    );

    if (!user) {
      throw new AppError('Registrierung fehlgeschlagen', 500);
    }

    const token = this.generateToken(user.id);
    logger.info(`User registered: ${email}`);

    return { accessToken: token, user };
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    const row = await queryOne<{ id: string; email: string; display_name: string; password_hash: string }>(
      'SELECT id, email, display_name, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (!row) {
      throw new AppError('Ungültige Anmeldedaten', 401);
    }

    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) {
      throw new AppError('Ungültige Anmeldedaten', 401);
    }

    const token = this.generateToken(row.id);
    logger.info(`User logged in: ${email}`);

    return {
      accessToken: token,
      user: { id: row.id, email: row.email, display_name: row.display_name, created_at: '' },
    };
  }

  async getProfile(userId: string): Promise<User> {
    const user = await queryOne<User>(
      'SELECT id, email, display_name, created_at FROM users WHERE id = $1',
      [userId]
    );
    if (!user) {
      throw new AppError('User nicht gefunden', 404);
    }
    return user;
  }

  async updateProfile(userId: string, data: { displayName?: string }): Promise<User> {
    const updates: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values: any[] = [];
    let idx = 1;

    if (data.displayName) {
      updates.push(`display_name = $${idx++}`);
      values.push(data.displayName);
    }

    if (updates.length === 0) {
      throw new AppError('Keine Änderungen angegeben', 400);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const user = await queryOne<User>(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}
       RETURNING id, email, display_name, created_at`,
      values
    );

    if (!user) {
      throw new AppError('User nicht gefunden', 404);
    }

    return user;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const row = await queryOne<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (!row) {
      throw new AppError('User nicht gefunden', 404);
    }

    const valid = await bcrypt.compare(currentPassword, row.password_hash);
    if (!valid) {
      throw new AppError('Aktuelles Passwort ist falsch', 401);
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, userId]);
    logger.info(`Password changed for user ${userId}`);
  }

  verifyToken(token: string): { userId: string } {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      return { userId: payload.userId };
    } catch {
      throw new AppError('Ungültiges Token', 401);
    }
  }

  private generateToken(userId: string): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
  }
}

export const authService = new AuthService();
