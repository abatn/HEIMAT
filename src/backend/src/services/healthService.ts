import { AppError } from '../middleware/errorHandler';

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  address: string;
  phone: string;
  availableSlots: string[];
}

interface Appointment {
  id: string;
  doctorId: string;
  doctorName: string;
  patientName: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'cancelled';
}

export class HealthService {
  private doctors: Doctor[] = [
    {
      id: 'doc1',
      name: 'Dr. Anna Schmidt',
      specialty: 'Allgemeinmedizin',
      address: 'Hauptstraße 10, 10115 Berlin',
      phone: '+49 30 12345678',
      availableSlots: ['09:00', '09:30', '10:00', '10:30', '14:00', '14:30'],
    },
    {
      id: 'doc2',
      name: 'Dr. Markus Weber',
      specialty: 'Zahnarzt',
      address: 'Berlinstraße 20, 10178 Berlin',
      phone: '+49 30 87654321',
      availableSlots: ['08:00', '08:30', '11:00', '11:30', '15:00'],
    },
    {
      id: 'doc3',
      name: 'Dr. Lisa Müller',
      specialty: 'Augenarzt',
      address: 'Auguststraße 5, 10117 Berlin',
      phone: '+49 30 11223344',
      availableSlots: ['09:00', '10:00', '11:00', '14:00', '15:00'],
    },
  ];

  private appointments: Appointment[] = [];

  async searchDoctors(specialty?: string, location?: string): Promise<Doctor[]> {
    let results = this.doctors;

    if (specialty) {
      results = results.filter(doc =>
        doc.specialty.toLowerCase().includes(specialty.toLowerCase())
      );
    }

    if (location) {
      results = results.filter(doc =>
        doc.address.toLowerCase().includes(location.toLowerCase())
      );
    }

    return results;
  }

  async getDoctorById(id: string): Promise<Doctor> {
    const doctor = this.doctors.find(doc => doc.id === id);
    if (!doctor) {
      throw new AppError('Doctor not found', 404);
    }
    return doctor;
  }

  async getAvailableSlots(doctorId: string, date: string): Promise<string[]> {
    const doctor = await this.getDoctorById(doctorId);

    // Bereits gebuchte Termine für diesen Tag filtern
    const bookedSlots = this.appointments
      .filter(apt => apt.doctorId === doctorId && apt.date === date && apt.status !== 'cancelled')
      .map(apt => apt.time);

    return doctor.availableSlots.filter(slot => !bookedSlots.includes(slot));
  }

  async bookAppointment(
    doctorId: string,
    patientName: string,
    date: string,
    time: string
  ): Promise<Appointment> {
    const doctor = await this.getDoctorById(doctorId);

    // Prüfen, ob der Slot noch frei ist
    const availableSlots = await this.getAvailableSlots(doctorId, date);
    if (!availableSlots.includes(time)) {
      throw new AppError('This time slot is not available', 400);
    }

    const appointment: Appointment = {
      id: `apt_${Date.now()}`,
      doctorId,
      doctorName: doctor.name,
      patientName,
      date,
      time,
      status: 'pending',
    };

    this.appointments.push(appointment);
    return appointment;
  }

  async getAppointments(patientName: string): Promise<Appointment[]> {
    return this.appointments.filter(
      apt => apt.patientName === patientName && apt.status !== 'cancelled'
    );
  }

  async cancelAppointment(appointmentId: string): Promise<Appointment> {
    const appointment = this.appointments.find(apt => apt.id === appointmentId);
    if (!appointment) {
      throw new AppError('Appointment not found', 404);
    }

    appointment.status = 'cancelled';
    return appointment;
  }

  async confirmAppointment(appointmentId: string): Promise<Appointment> {
    const appointment = this.appointments.find(apt => apt.id === appointmentId);
    if (!appointment) {
      throw new AppError('Appointment not found', 404);
    }

    appointment.status = 'confirmed';
    return appointment;
  }
}

export const healthService = new HealthService();
