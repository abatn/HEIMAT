import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AppError('Authentifizierung erforderlich', 401));
    return;
  }

  const token = authHeader.substring(7);

  try {
    const { userId } = authService.verifyToken(token);
    req.userId = userId;
    next();
  } catch {
    next(new AppError('Ungültiges Token', 401));
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const { userId } = authService.verifyToken(authHeader.substring(7));
      req.userId = userId;
    } catch {
      // Token ungültig, aber optional → weitermachen
    }
  }

  next();
}
