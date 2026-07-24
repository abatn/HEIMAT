import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate';
import {
  doctorsQuerySchema,
  doctorsNearbyQuerySchema,
  registerDoctorBodySchema,
  doctorSlotsQuerySchema,
  bookAppointmentBodySchema,
} from '../middleware/schemas';
import { healthService } from '../services/healthService';

export const healthRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// GET /api/health/doctors — DB-Aerzte (optional: specialty, location Filter)
healthRouter.get('/doctors', validate(doctorsQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const { specialty, location } = req.query;
  const doctors = await healthService.searchDoctors(specialty as string, location as string);
  res.json({ status: 'ok', doctors, count: doctors.length });
}));

// GET /api/health/doctors/nearby — OSM + DB Aerzte im Umkreis (Karte)
healthRouter.get('/doctors/nearby', validate(doctorsNearbyQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const latNum = parseFloat(req.query.lat as string);
  const lngNum = parseFloat(req.query.lng as string);
  const radiusNum = req.query.radius ? parseFloat(req.query.radius as string) : 3000;
  const doctors = await healthService.getNearbyDoctors(latNum, lngNum, radiusNum, req.query.specialty as string);
  res.json({ status: 'ok', doctors, count: doctors.length });
}));

// GET /api/health/doctors/:id — Einzelarzt
healthRouter.get('/doctors/:id', asyncHandler(async (req: Request, res: Response) => {
  const doctor = await healthService.getDoctorById(req.params.id as string);
  res.json({ status: 'ok', doctor });
}));

// POST /api/health/doctors — Arzt registrieren (mit optionalen Slots)
healthRouter.post('/doctors', validate(registerDoctorBodySchema, 'body'), asyncHandler(async (req: Request, res: Response) => {
  const { name, specialty, address, phone, email, latitude, longitude, slots } = req.body;
  const doctor = await healthService.registerDoctor({
    name,
    specialty,
    address,
    phone,
    email,
    latitude,
    longitude,
    slots: slots || undefined,
  });
  res.status(201).json({ status: 'ok', doctor, message: 'Arzt registriert mit Standard-Slots (Mo-Fr 8-12, 13-17).' });
}));

// GET /api/health/doctors/:id/slots
healthRouter.get('/doctors/:id/slots', validate(doctorSlotsQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const slots = await healthService.getAvailableSlots(req.params.id as string, req.query.date as string);
  res.json({ status: 'ok', doctorId: req.params.id as string, date: req.query.date, slots, count: slots.length });
}));

// POST /api/health/appointments
healthRouter.post('/appointments', validate(bookAppointmentBodySchema, 'body'), asyncHandler(async (req: Request, res: Response) => {
  const { doctorId, patientName, patientEmail, date, time } = req.body;
  const appointment = await healthService.bookAppointment(doctorId, patientName, patientEmail || '', date, time);
  res.json({ status: 'ok', appointment, message: 'Appointment booked.' });
}));

// GET /api/health/appointments/:patientName
healthRouter.get('/appointments/:patientName', asyncHandler(async (req: Request, res: Response) => {
  const appointments = await healthService.getAppointments(req.params.patientName as string);
  res.json({ status: 'ok', appointments, count: appointments.length });
}));

// PUT /api/health/appointments/:id/cancel
healthRouter.put('/appointments/:id/cancel', asyncHandler(async (req: Request, res: Response) => {
  const appointment = await healthService.cancelAppointment(req.params.id as string);
  res.json({ status: 'ok', appointment, message: 'Appointment cancelled' });
}));

// PUT /api/health/appointments/:id/confirm
healthRouter.put('/appointments/:id/confirm', asyncHandler(async (req: Request, res: Response) => {
  const appointment = await healthService.confirmAppointment(req.params.id as string);
  res.json({ status: 'ok', appointment, message: 'Appointment confirmed' });
}));
