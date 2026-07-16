import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { healthService } from '../services/healthService';

export const healthRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// GET /api/health/doctors — DB-Aerzte (optional: specialty, location Filter)
healthRouter.get('/doctors', asyncHandler(async (req: Request, res: Response) => {
  const { specialty, location } = req.query;
  const doctors = await healthService.searchDoctors(specialty as string, location as string);
  res.json({ status: 'ok', doctors, count: doctors.length });
}));

// GET /api/health/doctors/nearby — OSM + DB Aerzte im Umkreis (Karte)
healthRouter.get('/doctors/nearby', asyncHandler(async (req: Request, res: Response) => {
  const { lat, lng, radius, specialty } = req.query;
  if (!lat || !lng) throw new AppError('Latitude and longitude are required', 400);
  const latNum = parseFloat(lat as string);
  const lngNum = parseFloat(lng as string);
  if (isNaN(latNum) || isNaN(lngNum)) throw new AppError('Invalid coordinates', 400);
  const radiusNum = radius ? parseFloat(radius as string) : 3000;
  const doctors = await healthService.getNearbyDoctors(latNum, lngNum, radiusNum, specialty as string);
  res.json({ status: 'ok', doctors, count: doctors.length });
}));

// GET /api/health/doctors/:id — Einzelarzt
healthRouter.get('/doctors/:id', asyncHandler(async (req: Request, res: Response) => {
  const doctor = await healthService.getDoctorById(req.params.id);
  res.json({ status: 'ok', doctor });
}));

// POST /api/health/doctors — Arzt registrieren
healthRouter.post('/doctors', asyncHandler(async (req: Request, res: Response) => {
  const { name, specialty, address, phone, email, latitude, longitude } = req.body;
  if (!name || !specialty || !address) {
    throw new AppError('Name, specialty, and address are required', 400);
  }
  const doctor = await healthService.registerDoctor({
    name,
    specialty,
    address,
    phone,
    email,
    latitude,
    longitude,
  });
  res.status(201).json({ status: 'ok', doctor, message: 'Arzt registriert.' });
}));

// GET /api/health/doctors/:id/slots
healthRouter.get('/doctors/:id/slots', asyncHandler(async (req: Request, res: Response) => {
  const { date } = req.query;
  if (!date) throw new AppError('Date is required', 400);
  const slots = await healthService.getAvailableSlots(req.params.id, date as string);
  res.json({ status: 'ok', doctorId: req.params.id, date, slots, count: slots.length });
}));

// POST /api/health/appointments
healthRouter.post('/appointments', asyncHandler(async (req: Request, res: Response) => {
  const { doctorId, patientName, patientEmail, date, time } = req.body;
  if (!doctorId || !patientName || !date || !time) {
    throw new AppError('Doctor ID, patient name, date, and time are required', 400);
  }
  const appointment = await healthService.bookAppointment(doctorId, patientName, patientEmail || '', date, time);
  res.json({ status: 'ok', appointment, message: 'Appointment booked.' });
}));

// GET /api/health/appointments/:patientName
healthRouter.get('/appointments/:patientName', asyncHandler(async (req: Request, res: Response) => {
  const appointments = await healthService.getAppointments(req.params.patientName);
  res.json({ status: 'ok', appointments, count: appointments.length });
}));

// PUT /api/health/appointments/:id/cancel
healthRouter.put('/appointments/:id/cancel', asyncHandler(async (req: Request, res: Response) => {
  const appointment = await healthService.cancelAppointment(req.params.id);
  res.json({ status: 'ok', appointment, message: 'Appointment cancelled' });
}));

// PUT /api/health/appointments/:id/confirm
healthRouter.put('/appointments/:id/confirm', asyncHandler(async (req: Request, res: Response) => {
  const appointment = await healthService.confirmAppointment(req.params.id);
  res.json({ status: 'ok', appointment, message: 'Appointment confirmed' });
}));
