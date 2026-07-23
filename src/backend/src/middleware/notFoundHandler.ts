import { Request, Response } from 'express';
import { AppError } from './errorHandler';

export const notFoundHandler = (req: Request, _res: Response) => {
  throw new AppError(`Route not found: ${req.originalUrl}`, 404);
};
