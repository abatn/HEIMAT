import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { healthService } from '../services/healthService';

export const healthRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next); };

healthRouter.get('/doctors', asyncHandler(async (req: Request, res: Response) => {
  const { specialty, location } = req.query;
  const doctors = await healthService.searchDoctors(specialty as string, location as string);
  res.json({ status: 'ok', doctors, count: doctors.length });
}));

healthRouter.get('/doctors/:id', asyncHandler(async (req: Request, res: Response) => {
  const doctor = await healthService.getDoctorById(req.params.id);
  res.json({ status: 'ok', doctor });
}));

healthRouter.get('/doctors/:id/slots', asyncHandler(async (req: Request, res: Response) => {
  const { date } = req.query;
  if (!date) throw new AppError('Date is required', 400);
  const slots = await healthService.getAvailableSlots(req.params.id, date as string);
  res.json({ status: 'ok', doctorId: req.params.id, date, slots, count: slots.length });
}));

healthRouter.post('/appointments', asyncHandler(async (req: Request, res: Response) => {
  const { doctorId, patientName, patientEmail, date, time } = req.body;
  if (!doctorId || !patientName || !date || !time) throw new AppError('Doctor ID, patient name, date, and time are required', 400);
  const appointment = await healthService.bookAppointment(doctorId, patientName, patientEmail || '', date, time);
  res.json({ status: 'ok', appointment, message: 'Appointment booked.' });
}));

healthRouter.get('/appointments/:patientName', asyncHandler(async (req: Request, res: Response) => {
  const appointments = await healthService.getAppointments(req.params.patientName);
  res.json({ status: 'ok', appointments, count: appointments.length });
}));

healthRouter.put('/appointments/:id/cancel', asyncHandler(async (req: Request, res: Response) => {
  const appointment = await healthService.cancelAppointment(req.params.id);
  res.json({ status: 'ok', appointment, message: 'Appointment cancelled' });
}));

healthRouter.put('/appointments/:id/confirm', asyncHandler(async (req: Request, res: Response) => {
  const appointment = await healthService.confirmAppointment(req.params.id);
  res.json({ status: 'ok', appointment, message: 'Appointment confirmed' });
}));
