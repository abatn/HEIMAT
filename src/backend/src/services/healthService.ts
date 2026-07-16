import { query, queryOne, execute } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import axios from 'axios';

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  address: string;
  phone: string;
  email: string;
  latitude: number;
  longitude: number;
  source: string; // 'db' | 'osm'
}

interface OverpassElement {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
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
  private readonly userAgent = 'HEIMAT-App/1.0 (https://github.com/abatn/HEIMAT)';
  private readonly overpassMirrors = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ];

  private classifySpecialty(tags: Record<string, string> = {}): string {
    const specialty =
      tags.healthcare ||
      tags.amenity === 'doctors'
        ? (tags.specialty || tags.healthcare_speciality || 'Allgemeinmedizin')
        : 'Allgemeinmedizin';

    const lower = specialty.toLowerCase();
    if (lower.includes('zahn') || lower.includes('dental')) return 'Zahnarzt';
    if (lower.includes('augen') || lower.includes('ophthalm')) return 'Augenarzt';
    if (lower.includes('hno') || lower.includes('ohr')) return 'HNO-Arzt';
    if (lower.includes('haut') || lower.includes('dermat')) return 'Hautarzt';
    if (lower.includes('kinder') || lower.includes('päda')) return 'Kinderarzt';
    if (lower.includes('frau') || lower.includes('gyn')) return 'Frauenarzt';
    if (lower.includes('herz') || lower.includes('kardio')) return 'Kardiologe';
    if (lower.includes('psycho') || lower.includes('psych')) return 'Psychotherapeut';
    return specialty.charAt(0).toUpperCase() + specialty.slice(1);
  }

  private async fetchDoctorsFromOverpass(
    lat: number,
    lng: number,
    radiusMeters: number
  ): Promise<OverpassElement[]> {
    const r = Math.min(radiusMeters, 10000);
    const q =
      `[out:json][timeout:25];(` +
      `node["amenity"="doctors"](around:${r},${lat},${lng});` +
      `node["healthcare"](around:${r},${lat},${lng});` +
      `way["amenity"="doctors"](around:${r},${lat},${lng});` +
      `way["healthcare"](around:${r},${lat},${lng});` +
      `);out body 50;`;

    let lastError: unknown;
    for (const mirror of this.overpassMirrors) {
      try {
        const response = await axios.post(mirror, `data=${encodeURIComponent(q)}`, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': this.userAgent,
          },
          timeout: 25000,
        });
        return (response.data?.elements ?? []) as OverpassElement[];
      } catch (e) {
        lastError = e;
        const status = (e as any)?.response?.status;
        logger.warn(`Overpass-Mirror ${mirror} fehlgeschlagen (status ${status ?? 'timeout'})`);
      }
    }
    throw lastError;
  }

  private overpassToDoctor(el: OverpassElement): Doctor {
    const tags = el.tags ?? {};
    const street = tags['addr:street'] || '';
    const number = tags['addr:housenumber'] || '';
    const city = tags['addr:city'] || '';
    const postcode = tags['addr:postcode'] || '';
    const address = [street, number ? number : '', postcode, city].filter(Boolean).join(', ');

    return {
      id: `osm_${el.id}`,
      name: tags.name || tags['name:de'] || 'Praxis',
      specialty: this.classifySpecialty(tags),
      address: address || `Koordinaten: ${el.lat}, ${el.lon}`,
      phone: tags.phone || tags['contact:phone'] || '',
      email: tags.email || tags['contact:email'] || '',
      latitude: el.lat,
      longitude: el.lon,
      source: 'osm',
    };
  }

  async searchDoctors(specialty?: string, location?: string): Promise<Doctor[]> {
    // 1. DB-Ärzte laden
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
    const dbDoctors = (await query<Doctor>(sql, params)).map(d => ({
      ...d,
      source: 'db' as const,
    }));

    // 2. Wenn Location angegeben: Geocoding → Overpass nearby (OSM-Praxen)
    if (location && location.trim()) {
      try {
        const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1&countrycodes=de`;
        const geoResp = await axios.get(geoUrl, {
          headers: { 'User-Agent': this.userAgent },
          timeout: 10000,
        });
        if (geoResp.data?.length > 0) {
          const lat = parseFloat(geoResp.data[0].lat);
          const lng = parseFloat(geoResp.data[0].lon);
          const elements = await this.fetchDoctorsFromOverpass(lat, lng, 5000);
          const osmDoctors = elements
            .filter(el => el.tags && (el.tags.name || el.tags['name:de']))
            .map(el => this.overpassToDoctor(el));

          // Mergen: DB hat Vorrang
          const seenKeys = new Set(
            dbDoctors.map(d => `${d.name.toLowerCase()}|${d.latitude?.toFixed(4)}|${d.longitude?.toFixed(4)}`)
          );
          for (const osm of osmDoctors) {
            const key = `${osm.name.toLowerCase()}|${osm.latitude.toFixed(4)}|${osm.longitude.toFixed(4)}`;
            if (!seenKeys.has(key)) {
              dbDoctors.push(osm);
              seenKeys.add(key);
            }
          }
        }
      } catch (e) {
        logger.warn(`Overpass-Suche fuer Location "${location}" fehlgeschlagen: ${e}`);
      }
    }

    // 3. Optional nach Fachrichtung filtern (auch OSM-Einträge)
    if (specialty && specialty.trim()) {
      const lower = specialty.toLowerCase();
      return dbDoctors.filter(d => d.specialty.toLowerCase().includes(lower));
    }

    return dbDoctors;
  }

  async getNearbyDoctors(
    lat: number,
    lng: number,
    radiusMeters: number = 3000,
    specialty?: string
  ): Promise<Doctor[]> {
    // 1. DB-Ärzte im Umkreis laden (via Haversine)
    const dbDoctors = await query<Doctor>(
      `SELECT * FROM doctors
       WHERE (6371000 * acos(LEAST(1,
         cos(radians($2)) * cos(radians(latitude)) *
         cos(radians(longitude) - radians($1)) +
         sin(radians($2)) * sin(radians(latitude))
       ))) < $3
       ORDER BY name`,
      [lng, lat, radiusMeters]
    );

    const dbMarked = dbDoctors.map(d => ({ ...d, source: 'db' as const }));

    // 2. Overpass: echte OSM-Praxen
    let osmDoctors: Doctor[] = [];
    try {
      const elements = await this.fetchDoctorsFromOverpass(lat, lng, radiusMeters);
      osmDoctors = elements
        .filter(el => el.tags && (el.tags.name || el.tags['name:de']))
        .map(el => this.overpassToDoctor(el));
    } catch (e) {
      logger.warn(`Overpass-Aerzte fehlgeschlagen, nutze nur DB: ${e}`);
    }

    // 3. Mergen: DB hat Vorrang bei Name+Adresse-Duplikaten
    const merged = [...dbMarked];
    const seenKeys = new Set(
      dbMarked.map(d => `${d.name.toLowerCase()}|${d.latitude.toFixed(4)}|${d.longitude.toFixed(4)}`)
    );

    for (const osm of osmDoctors) {
      const key = `${osm.name.toLowerCase()}|${osm.latitude.toFixed(4)}|${osm.longitude.toFixed(4)}`;
      if (!seenKeys.has(key)) {
        merged.push(osm);
        seenKeys.add(key);
      }
    }

    // 4. Optional nach Fachrichtung filtern
    if (specialty && specialty.trim()) {
      const lower = specialty.toLowerCase();
      return merged.filter(
        d => d.specialty.toLowerCase().includes(lower)
      );
    }

    return merged;
  }

  async getDoctorById(id: string): Promise<Doctor> {
    // OSM-Ärzte sind nicht in DB
    if (id.startsWith('osm_')) {
      throw new AppError(
        'OSM-Aerzte sind nur ueber die Karte verfuegbar. Nur registrierte Aerzte haben Profile.',
        404
      );
    }
    const doctor = await queryOne<Doctor>(
      'SELECT * FROM doctors WHERE id = $1',
      [id]
    );
    if (!doctor) {
      throw new AppError('Doctor not found', 404);
    }
    return { ...doctor, source: 'db' };
  }

  async registerDoctor(data: {
    name: string;
    specialty: string;
    address: string;
    phone?: string;
    email?: string;
    latitude?: number;
    longitude?: number;
    slots?: Array<{ day_of_week: number; start_time: string; end_time: string }>;
  }): Promise<Doctor> {
    const result = await queryOne<Doctor>(
      `INSERT INTO doctors (name, specialty, address, phone, email, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.name,
        data.specialty,
        data.address,
        data.phone || null,
        data.email || null,
        data.latitude || null,
        data.longitude || null,
      ]
    );

    // Slots erstellen: entweder explizite oder Default (Mo-Fr 8-12, 13-17)
    const doctorId = result!.id;
    const slotsToCreate = data.slots && data.slots.length > 0
      ? data.slots
      : this.defaultSlots();

    for (const slot of slotsToCreate) {
      await query(
        `INSERT INTO doctor_slots (doctor_id, day_of_week, start_time, end_time)
         VALUES ($1, $2, $3, $4)`,
        [doctorId, slot.day_of_week, slot.start_time, slot.end_time]
      );
    }

    return { ...result!, source: 'db' };
  }

  private defaultSlots(): Array<{ day_of_week: number; start_time: string; end_time: string }> {
    const slots: Array<{ day_of_week: number; start_time: string; end_time: string }> = [];
    // Montag(1) bis Freitag(5): 8:00-12:00, 13:00-17:00
    for (let day = 1; day <= 5; day++) {
      slots.push({ day_of_week: day, start_time: '08:00', end_time: '12:00' });
      slots.push({ day_of_week: day, start_time: '13:00', end_time: '17:00' });
    }
    return slots;
  }

  async getAvailableSlots(doctorId: string, date: string): Promise<string[]> {
    if (doctorId.startsWith('osm_')) {
      return []; // OSM-Ärzte haben keine Slots
    }

    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();

    const slots = await query<DoctorSlot>(
      'SELECT * FROM doctor_slots WHERE doctor_id = $1 AND day_of_week = $2 AND is_available = true',
      [doctorId, dayOfWeek]
    );

    const bookedSlots = await query<{ appointment_time: string }>(
      'SELECT appointment_time FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND status != $3',
      [doctorId, date, 'cancelled']
    );

    const bookedTimes = bookedSlots.map(s => s.appointment_time.substring(0, 5));
    const availableTimes: string[] = [];

    for (const slot of slots) {
      const start = slot.start_time.substring(0, 5);
      const end = slot.end_time.substring(0, 5);

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
    if (doctorId.startsWith('osm_')) {
      throw new AppError(
        'OSM-Aerzte unterstuetzen keine Online-Terminbuchung. Bitte kontaktieren Sie die Praxis direkt.',
        400
      );
    }

    await this.getDoctorById(doctorId);

    const availableSlots = await this.getAvailableSlots(doctorId, date);
    if (!availableSlots.includes(time)) {
      throw new AppError('This time slot is not available', 400);
    }

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
