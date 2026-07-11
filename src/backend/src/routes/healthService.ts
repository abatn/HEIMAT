import { Router, Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler';

export const healthRouter = Router();

// Search doctors
healthRouter.get('/doctors', async (req: Request, res: Response) => {
  const { specialty, location, date } = req.query;

  if (!specialty && !location) {
    throw new AppError('Specialty or location is required', 400);
  }

  // TODO: Query doctor database
  res.json({
    status: 'ok',
    doctors: [],
    message: 'Doctor search - coming soon',
  });
});

// Get available appointments
healthRouter.get('/appointments', async (req: Request, res: Response) => {
  const { doctorId, date } = req.query;

  if (!doctorId) {
    throw new AppError('Doctor ID is required', 400);
  }

  // TODO: Query Cal.com integration
  res.json({
    status: 'ok',
    appointments: [],
    message: 'Appointment availability - coming soon',
  });
});

// Book appointment
healthRouter.post('/appointments', async (req: Request, res: Response) => {
  const { doctorId, date, time, patientName } = req.body;

  if (!doctorId || !date || !time) {
    throw new AppError('Doctor ID, date, and time are required', 400);
  }

  // TODO: Integrate with Cal.com
  res.json({
    status: 'ok',
    appointmentId: null,
    message: 'Appointment booking - coming soon',
  });
});
