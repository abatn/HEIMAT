import { Router, Request, Response } from 'express';
import { AppError } from '../middleware/errorHandler';
import { healthService } from '../services/healthService';

export const healthRouter = Router();

// Search doctors
healthRouter.get('/doctors', async (req: Request, res: Response) => {
  const { specialty, location } = req.query;

  const doctors = await healthService.searchDoctors(
    specialty as string,
    location as string
  );

  res.json({
    status: 'ok',
    doctors,
    count: doctors.length,
  });
});

// Get doctor by ID
healthRouter.get('/doctors/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const doctor = await healthService.getDoctorById(id);

  res.json({
    status: 'ok',
    doctor,
  });
});

// Get available slots
healthRouter.get('/doctors/:id/slots', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { date } = req.query;

  if (!date) {
    throw new AppError('Date is required', 400);
  }

  const slots = await healthService.getAvailableSlots(id, date as string);

  res.json({
    status: 'ok',
    doctorId: id,
    date,
    slots,
    count: slots.length,
  });
});

// Book appointment
healthRouter.post('/appointments', async (req: Request, res: Response) => {
  const { doctorId, patientName, date, time } = req.body;

  if (!doctorId || !patientName || !date || !time) {
    throw new AppError('Doctor ID, patient name, date, and time are required', 400);
  }

  const appointment = await healthService.bookAppointment(
    doctorId,
    patientName,
    date,
    time
  );

  res.json({
    status: 'ok',
    appointment,
    message: 'Appointment booked. Waiting for doctor confirmation.',
  });
});

// Get appointments for patient
healthRouter.get('/appointments/:patientName', async (req: Request, res: Response) => {
  const { patientName } = req.params;

  const appointments = await healthService.getAppointments(patientName);

  res.json({
    status: 'ok',
    appointments,
    count: appointments.length,
  });
});

// Cancel appointment
healthRouter.put('/appointments/:id/cancel', async (req: Request, res: Response) => {
  const { id } = req.params;

  const appointment = await healthService.cancelAppointment(id);

  res.json({
    status: 'ok',
    appointment,
    message: 'Appointment cancelled',
  });
});

// Confirm appointment (for doctors)
healthRouter.put('/appointments/:id/confirm', async (req: Request, res: Response) => {
  const { id } = req.params;

  const appointment = await healthService.confirmAppointment(id);

  res.json({
    status: 'ok',
    appointment,
    message: 'Appointment confirmed',
  });
});
