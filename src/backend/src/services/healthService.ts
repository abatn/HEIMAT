import { query, queryOne, execute } from '../config/database';
import { AppError } from '../middleware/errorHandler';

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  address: string;
  phone: string;
  email: string;
  latitude: number;
  longitude: number;
}

interface DoctorSlot {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface Appointment {
  id: string;
  doctor_id: string;
  patient_name: string;
  patient_email: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
}

export class HealthService {
  async searchDoctors(specialty?: string, location?: string): Promise<Doctor[]> {
    let sql = 'SELECT * FROM doctors WHERE 1=1';
    const params: any[] = [];

    if (specialty) {
      sql += ' AND specialty ILIKE $' + (params.length + 1);
      params.push(`%${specialty}%`);
    }

    if (location) {
      sql += ' AND address ILIKE $' + (params.length + 1);
      params.push(`%${location}%`);
    }

    sql += ' ORDER BY name';
    return query<Doctor>(sql, params);
  }

  async getDoctorById(id: string): Promise<Doctor> {
    const doctor = await queryOne<Doctor>('SELECT * FROM doctors WHERE id = $1', [id]);
    if (!doctor) {
      throw new AppError('Doctor not found', 404);
    }
    return doctor;
  }

  async getAvailableSlots(doctorId: string, date: string): Promise<string[]> {
    // Tag der Woche aus Datum berechnen (0=Sonntag, 6=Samstag)
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();

    const slots = await query<DoctorSlot>(
      'SELECT * FROM doctor_slots WHERE doctor_id = $1 AND day_of_week = $2 AND is_available = true',
      [doctorId, dayOfWeek]
    );

    // Bereits gebuchte Termine filtern
    const bookedSlots = await query<{ appointment_time: string }>(
      'SELECT appointment_time FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND status != $3',
      [doctorId, date, 'cancelled']
    );

    const bookedTimes = bookedSlots.map(s => s.appointment_time.substring(0, 5));
    const availableTimes: string[] = [];

    for (const slot of slots) {
      const start = slot.start_time.substring(0, 5);
      const end = slot.end_time.substring(0, 5);
      
      // 30-Minuten-Slots generieren
      let [hours, minutes] = start.split(':').map(Number);
      const [endHours] = end.split(':').map(Number);

      while (hours < endHours) {
        const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        if (!bookedTimes.includes(timeStr)) {
          availableTimes.push(timeStr);
        }
        minutes += 30;
        if (minutes >= 60) {
          hours++;
          minutes = 0;
        }
      }
    }

    return availableTimes;
  }

  async bookAppointment(
    doctorId: string,
    patientName: string,
    patientEmail: string,
    date: string,
    time: string
  ): Promise<Appointment> {
    // Prüfen ob Arzt existiert
    await this.getDoctorById(doctorId);

    // Prüfen ob Slot noch frei
    const availableSlots = await this.getAvailableSlots(doctorId, date);
    if (!availableSlots.includes(time)) {
      throw new AppError('This time slot is not available', 400);
    }

    // Termin erstellen
    const result = await queryOne<Appointment>(
      `INSERT INTO appointments (doctor_id, patient_name, patient_email, appointment_date, appointment_time, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [doctorId, patientName, patientEmail, date, time]
    );

    return result!;
  }

  async getAppointments(patientName: string): Promise<Appointment[]> {
    return query<Appointment>(
      'SELECT * FROM appointments WHERE patient_name = $1 AND status != $2 ORDER BY appointment_date, appointment_time',
      [patientName, 'cancelled']
    );
  }

  async cancelAppointment(appointmentId: string): Promise<Appointment> {
    const result = await queryOne<Appointment>(
      "UPDATE appointments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [appointmentId]
    );

    if (!result) {
      throw new AppError('Appointment not found', 404);
    }

    return result;
  }

  async confirmAppointment(appointmentId: string): Promise<Appointment> {
    const result = await queryOne<Appointment>(
      "UPDATE appointments SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [appointmentId]
    );

    if (!result) {
      throw new AppError('Appointment not found', 404);
    }

    return result;
  }
}

export const healthService = new HealthService();
