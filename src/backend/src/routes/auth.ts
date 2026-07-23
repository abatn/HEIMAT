import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { authService } from '../services/authService';
import { z } from 'zod';

export const authRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next); };

const registerSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen lang sein'),
  displayName: z.string().min(1, 'Name ist erforderlich').max(100),
});

const loginSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(1, 'Passwort ist erforderlich'),
});

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Aktuelles Passwort ist erforderlich'),
  newPassword: z.string().min(8, 'Neues Passwort muss mindestens 8 Zeichen lang sein'),
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Neuen User registrieren
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, displayName]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@heimat.de
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: SecurePass123!
 *               displayName:
 *                 type: string
 *                 example: Max Mustermann
 *     responses:
 *       201:
 *         description: Registrierung erfolgreich
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       409:
 *         description: E-Mail bereits registriert
 */
authRouter.post('/register', validate(registerSchema, 'body'), asyncHandler(async (req: Request, res: Response) => {
  const { email, password, displayName } = req.body;
  const result = await authService.register(email, password, displayName);
  res.status(201).json({ status: 'ok', ...result });
}));

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Benutzer anmelden
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Anmeldung erfolgreich
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Ungültige Anmeldedaten
 */
authRouter.post('/login', validate(loginSchema, 'body'), asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  res.json({ status: 'ok', ...result });
}));

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Eigenes Profil abrufen
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profil erfolgreich abgerufen
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Nicht authentifiziert
 */
authRouter.get('/me', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getProfile((req as AuthRequest).userId!);
  res.json({ status: 'ok', user });
}));

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     tags: [Auth]
 *     summary: Profil aktualisieren
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *                 example: Neuer Name
 *     responses:
 *       200:
 *         description: Profil aktualisiert
 *       401:
 *         description: Nicht authentifiziert
 */
authRouter.put('/profile', requireAuth, validate(updateProfileSchema, 'body'), asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.updateProfile((req as AuthRequest).userId!, req.body);
  res.json({ status: 'ok', user });
}));

/**
 * @swagger
 * /api/auth/password:
 *   put:
 *     tags: [Auth]
 *     summary: Passwort ändern
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Passwort geändert
 *       401:
 *         description: Falsches aktuelles Passwort
 */
authRouter.put('/password', requireAuth, validate(changePasswordSchema, 'body'), asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword((req as AuthRequest).userId!, currentPassword, newPassword);
  res.json({ status: 'ok', message: 'Passwort geändert' });
}));
