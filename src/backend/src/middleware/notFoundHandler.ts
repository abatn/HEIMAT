import { Request, Response } from 'express';
import { AppError } from './errorHandler';

export const notFoundHandler = (req: Request, res: Response) => {
  throw new AppError(`Route not found: ${req.originalUrl}`, 404);
};
