import { createHash, randomUUID } from 'node:crypto';
import { query, queryOne } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import axios, { AxiosError } from 'axios';
import { externalServices } from '../config/externalServices';

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  address: string;
  phone: string;
  email: string;
  /** Explicit OSM website URL; never inferred from the domain. */
  website?: string;
  /** Explicit online appointment URL from OSM booking tags. */
  bookingUrl?: string;
  latitude: number;
  longitude: number;
  source: string; // 'db' | 'osm'
  distanceKm?: number; // Entfernung vom User-Standort in km
}

interface OverpassElement {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

/**
 * Keeps only explicitly tagged, safe web URLs from OSM.
 * We deliberately do not guess `/booking` paths from a practice domain.
 */
export function normalizeExternalUrl(value: string | undefined): string {
  const candidate = value?.trim();
  if (!candidate) return '';
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function firstExternalUrl(tags: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const url = normalizeExternalUrl(tags[key]);
    if (url) return url;
  }
  return '';
}

export function extractExternalLinks(tags: Record<string, string>): {
  website?: string;
  bookingUrl?: string;
} {
  const website = firstExternalUrl(tags, ['website', 'contact:website', 'url']);
  const bookingUrl = firstExternalUrl(tags, [
    'website:booking',
    'appointment:website',
    'booking:website',
    'contact:booking',
    'contact:appointment',
    'booking',
  ]);
  return {
    ...(website ? { website } : {}),
    ...(bookingUrl ? { bookingUrl } : {}),
  };
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
  status: string; // 'pending' | 'confirmed' | 'completed' | 'no-show' | 'cancelled'
  notes?: string;
  recurrence_id?: string | null;
}

interface WaitlistEntry {
  id: string;
  doctor_id: string;
  patient_name: string;
  patient_email: string;
  requested_date: string;
  requested_time: string;
  status: string; // 'waiting' | 'promoted'
}

/**
 * Erzeugt eine deterministische UUID aus einer OSM-Node-ID.
 * Nutzt SHA-256 Hash → UUID v5-Format (8-4-4-4-12 hex).
 * Garantiert: gleiche OSM-ID → immer gleiche UUID. Keine DB-Migration nötig.
 */
function osmIdToUuid(osmId: number): string {
  const hash = createHash('sha256').update(`heimat-osm-${osmId}`).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    // Version 5 nibble
    (parseInt(hash.slice(12, 14), 16) & 0x0f | 0x50).toString(16) + hash.slice(14, 16),
    // Variant 10xx
    (parseInt(hash.slice(16, 18), 16) & 0x3f | 0x80).toString(16) + hash.slice(18, 20),
    hash.slice(20, 32),
  ].join('-');
}

export class HealthService {
  private readonly userAgent = externalServices.userAgent;
  private readonly overpassMirrors = externalServices.overpassMirrors;

  /**
   * Klassifiziert die Fachrichtung eines Arztes aus OSM-Tags UND Name.
   *
   * Strategie: Ein konsolidierter Keyword-Check ueber alle verfuegbaren
   * Informationen (Tags + Name). Kein frueher Return — alle Quellen
   * werden gleichzeitig ausgewertet (verhindert dass "Allgemeinmedizin"
   * spezifischere Namen wie "Sportarztpraxis" ueberschreibt).
   *
   * Exportiert fuer Unit-Tests (classifySpecialty.test.ts).
   */
  classifySpecialty(tags: Record<string, string> = {}, name: string = ''): string {
    const tagSources = [
      tags['healthcare:speciality'],
      tags.specialty,
      tags.healthcare,
      tags.amenity,
    ].filter((v): v is string => !!v);
    const tagText = tagSources.join(' ').toLowerCase();
    const input = (tagText + ' ' + name).toLowerCase();

    // Einheitliche Keyword-Map: [keyword1, keyword2, ...] → Fachrichtung
    // Reihenfolge: spezifischere Matches ZUERST, Allgemeinmedizin als Fallback.
    // OSM-Tags (healthcare:speciality) UND deutsche Praxisnamen werden gleichermaßen
    // erkannt — damit Specialty-Chips tatsächlich verschiedene Ergebnisse liefern.
    const rules: [string[], string][] = [
      // --- Spezifisch: Augen ---
      [['augen', 'ophthalm', 'sehkraft'], 'Augenarzt'],
      // --- Spezifisch: Zähne ---
      [['zahn', 'dental', 'dentist', 'kiefer'], 'Zahnarzt'],
      // --- Spezifisch: HNO ---
      [['hno', 'hals-nasen', 'ohren', 'otolaryng'], 'HNO-Arzt'],
      // --- Spezifisch: Haut ---
      [['haut', 'dermat', 'dermatovenere'], 'Hautarzt'],
      // --- Spezifisch: Kinder ---
      [['kinder', 'päda', 'paediat', 'jugend'], 'Kinderarzt'],
      // --- Spezifisch: Frauen ---
      [['frauen', 'gyn', 'gynäkolog', 'gynaekolog', 'gynaecology', 'geburtshilf', 'hebamme', 'midwife'], 'Frauenarzt'],
      // --- Spezifisch: Herz ---
      [['herz', 'kardio', 'kardiolog', 'cardio'], 'Kardiologe'],
      // --- Spezifisch: Psyche ---
      [['psycho', 'psych', 'therapeut', 'psychiatrie'], 'Psychotherapeut'],
      // --- Spezifisch: Orthopädie (VOR Chirurg — orthopädische Praxen ≠ Chirurgen) ---
      [['orthopä', 'ortho', 'rüc', 'ruec', 'wirbel', 'orthopaed'], 'Orthopäde'],
      // --- Spezifisch: Neuro ---
      [['neurolog', 'nerven'], 'Neurologe'],
      // --- Spezifisch: Sport ---
      [['sportarzt', 'sportmedizin', 'sport'], 'Sportmedizin'],
      // --- Spezifisch: Lunge / Pneumologie ---
      [['lunge', 'pulmo', 'atmung', 'pneumo', 'pulmonol', 'respiratory'], 'Pneumologie'],
      // --- Spezifisch: Allergie ---
      [['allerg', 'allergo'], 'Allergologie'],
      // --- Spezifisch: Innere Medizin ---
      [['innere', 'internist', 'internal'], 'Innere Medizin'],
      // --- Spezifisch: Urologie ---
      [['urolog', 'nieren', 'prostat'], 'Urologe'],
      // --- Spezifisch: Physiotherapie ---
      [['physio', 'physiotherap', 'bewegungstherap', 'manualtherap'], 'Physiotherapie'],
      // --- Spezifisch: Rheumatologie ---
      [['rheum', 'rheumat'], 'Orthopäde'],
      // --- Spezifisch: Endokrinologie ---
      [['endokrin', 'endocrin', 'schilddrüse', 'thyroid', 'diabet'], 'Innere Medizin'],
      // --- Spezifisch: Gastroenterologie ---
      [['gastro', 'magendarm', 'hepatol', 'leber'], 'Innere Medizin'],
      // --- Spezifisch: Onkologie ---
      [['onkolog', 'oncolog', 'tumor', 'krebs'], 'Innere Medizin'],
      // --- Spezifisch: Radiologie ---
      [['radiolog', 'röntgen', 'radiology', 'imaging'], 'Radiologie'],
      // --- Spezifisch: Chirurgie (NUR wenn kein Orthopädie-Match) ---
      [['chirurg', 'unfallchirurg', 'surgery', 'operative'], 'Chirurg'],
      // --- Spezifisch: Naturheilkunde ---
      [['naturheilkund', 'naturopath', 'homöopath', 'homeopath', 'heilpraktik'], 'Naturheilkunde'],
      // --- Allgemeinmedizin: letzter Fallback ---
      [['allgemein', 'general', 'hausarzt', 'family'], 'Allgemeinmedizin'],
    ];

    for (const [keywords, specialty] of rules) {
      for (const keyword of keywords) {
        if (input.includes(keyword)) {
          return specialty;
        }
      }
    }

    return 'Allgemeinmedizin';
  }

  private async fetchDoctorsFromOverpass(
    lat: number,
    lng: number,
    radiusMeters: number
  ): Promise<OverpassElement[]> {
    const r = Math.min(radiusMeters, 10000);
    // NUR echte Ärzte, KEINE Apotheken:
    // - amenity=doctors: klassische Arztpraxis
    // - healthcare=doctor / healthcare=clinic: medizinische Einrichtungen (Regex filtert pharmacy raus)
    const q =
      `[out:json][timeout:25];(` +
      `node["amenity"="doctors"](around:${r},${lat},${lng});` +
      `node["healthcare"~"^(doctor|clinic)$"](around:${r},${lat},${lng});` +
      `way["amenity"="doctors"](around:${r},${lat},${lng});` +
      `way["healthcare"~"^(doctor|clinic)$"](around:${r},${lat},${lng});` +
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
        const elements = (response.data?.elements ?? []) as OverpassElement[];
        // Sicherheitsfilter: Apotheken explizit ausschließen
        return elements.filter(el => {
          const tags = el.tags ?? {};
          return tags.amenity !== 'pharmacy' && tags.healthcare !== 'pharmacy';
        });
      } catch (e) {
        lastError = e;
        const status = (e as AxiosError).response?.status;
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

    const externalLinks = extractExternalLinks(tags);
    return {
      id: osmIdToUuid(el.id),
      name: tags.name || tags['name:de'] || 'Praxis',
      specialty: this.classifySpecialty(tags, tags.name || tags['name:de'] || ''),
      address: address || '', // leer → wird später via Reverse-Geocoding gefüllt
      phone: tags.phone || tags['contact:phone'] || tags['phone:mobile'] || '',
      email: tags.email || tags['contact:email'] || '',
      ...externalLinks,
      latitude: el.lat,
      longitude: el.lon,
      source: 'osm',
    };
  }

  /**
   * Nominatim Reverse-Geocoding: Koordinaten → lesbare Adresse.
   * Rate-Limit: max 1 req/sec (Nominatim-Policy). Begrenzt auf maxDoctors
   * um Endpunkte nicht zu verlangsamen.
   */
  private async enrichAddresses(doctors: Doctor[], maxDoctors: number = 10): Promise<Doctor[]> {
    const needAddress = doctors.filter(d => d.source === 'osm' && !d.address);
    const toEnrich = needAddress.slice(0, maxDoctors);

    for (let i = 0; i < toEnrich.length; i++) {
      const doc = toEnrich[i];
      try {
        const url = `${externalServices.nominatimUrl}/reverse?lat=${doc.latitude}&lon=${doc.longitude}&format=json&addressdetails=1&zoom=18&accept-language=de`;
        const resp = await axios.get(url, {
          headers: { 'User-Agent': this.userAgent },
          timeout: 5000,
        });
        const data = resp.data;
        if (data && data.address) {
          const a = data.address;
          const parts = [
            [a.road, a.house_number].filter(Boolean).join(' '),
            [a.postcode, a.city || a.town || a.village || a.municipality].filter(Boolean).join(' '),
          ].filter(Boolean);
          doc.address = parts.join(', ') || data.display_name?.split(',').slice(0, 3).join(',').trim() || '';
        } else if (data?.display_name) {
          doc.address = data.display_name.split(',').slice(0, 3).join(',').trim();
        }
      } catch (e) {
        // Silent fallback — Adresse bleibt leer bei Nominatim-Fehler
        logger.debug(`Reverse-Geocoding fehlgeschlagen fuer ${doc.latitude},${doc.longitude}`);
      }
      // Nominatim Rate-Limit: max 1 req/sec (Policy)
      if (i < toEnrich.length - 1) {
        await new Promise(r => setTimeout(r, 1100));
      }
    }

    return doctors;
  }

  async searchDoctors(specialty?: string, location?: string): Promise<Doctor[]> {
    // 1. DB-Ärzte laden
    let sql = 'SELECT * FROM doctors WHERE 1=1';
    const params: string[] = [];

    if (specialty) {
      sql += ' AND specialty ILIKE $' + (params.length + 1);
      params.push(`%${specialty}%`);
    }

    if (location) {
      sql += ' AND address ILIKE $' + (params.length + 1);
      params.push(`%${location}%`);
    }

    sql += ' ORDER BY name';
    const dbDoctors: Doctor[] = (await query<Doctor>(sql, params)).map(d => ({
      ...d,
      source: 'db' as const,
    }));

    // 2. Wenn Location angegeben: Geocoding → Overpass nearby (OSM-Praxen)
    if (location && location.trim()) {
      try {
        const geoUrl = `${externalServices.nominatimUrl}/search?q=${encodeURIComponent(location)}&format=json&limit=1&countrycodes=de`;
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
            dbDoctors.map(d => `${d.name.toLowerCase()}|${Number(d.latitude ?? 0).toFixed(4)}|${Number(d.longitude ?? 0).toFixed(4)}`)
          );
          for (const osm of osmDoctors) {
            const key = `${osm.name.toLowerCase()}|${Number(osm.latitude ?? 0).toFixed(4)}|${Number(osm.longitude ?? 0).toFixed(4)}`;
            if (!seenKeys.has(key)) {
              dbDoctors.push(osm);
              seenKeys.add(key);
            }
          }
          // Adressen für OSM-Ärzte ohne addr:street via Nominatim auflösen
          await this.enrichAddresses(dbDoctors);
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
      `SELECT *,
        ROUND((6371 * acos(LEAST(1,
          cos(radians($2)) * cos(radians(latitude)) *
          cos(radians(longitude) - radians($1)) +
          sin(radians($2)) * sin(radians(latitude))
        )))::numeric, 1) AS distance_km
       FROM doctors
       WHERE (6371000 * acos(LEAST(1,
         cos(radians($2)) * cos(radians(latitude)) *
         cos(radians(longitude) - radians($1)) +
         sin(radians($2)) * sin(radians(latitude))
       ))) < $3
       ORDER BY distance_km`,
      [lng, lat, radiusMeters]
    );

    const dbMarked: Doctor[] = dbDoctors.map(d => {
      const distRaw = (d as any).distance_km;
      return { ...d, source: 'db' as const, distanceKm: distRaw != null ? Number(distRaw) : undefined };
    });

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
      dbMarked.map(d => `${d.name.toLowerCase()}|${Number(d.latitude ?? 0).toFixed(4)}|${Number(d.longitude ?? 0).toFixed(4)}`)
    );

    for (const osm of osmDoctors) {
      const key = `${osm.name.toLowerCase()}|${Number(osm.latitude ?? 0).toFixed(4)}|${Number(osm.longitude ?? 0).toFixed(4)}`;
      if (!seenKeys.has(key)) {
        merged.push(osm);
        seenKeys.add(key);
      }
    }

    // 3b. Adressen für OSM-Ärzte ohne addr:street via Nominatim auflösen
    await this.enrichAddresses(merged);

    // 3c. Entfernung für alle Ärzte berechnen (Haversine)
    for (const doc of merged) {
      if (doc.latitude && doc.longitude && !doc.distanceKm) {
        doc.distanceKm = this.haversineKm(lat, lng, doc.latitude, doc.longitude);
      }
    }

    // 4. Sortieren nach Entfernung
    merged.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));

    // 5. Optional nach Fachrichtung filtern
    if (specialty && specialty.trim()) {
      const lower = specialty.toLowerCase();
      return merged.filter(
        d => d.specialty.toLowerCase().includes(lower)
      );
    }

    return merged;
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
  }

  async getDoctorById(id: string): Promise<Doctor> {
    // DB-Query — funktioniert für DB-Ärzte UND OSM-Ärzte (deterministische UUID)
    const doctor = await queryOne<Doctor>(
      'SELECT * FROM doctors WHERE id = $1',
      [id]
    );
    if (!doctor) {
      throw new AppError(
        'Arzt nicht in Datenbank. Bitte zuerst Arztprofil laden (POST /doctors/ensure).',
        404
      );
    }
    return { ...doctor, source: 'db' };
  }

  /**
   * Stellt sicher, dass ein Overpass-Arzt in der DB existiert.
   * Wird aufgerufen, wenn der User ein OSM-Kontaktprofil öffnet. Die
   * expliziten Website-/Buchungsdaten werden idempotent gespeichert; keine
   * Verfügbarkeit wird erfunden.
   */
  async ensureDoctorInDb(doctor: Doctor): Promise<string> {
    // OSM-Arzt idempotent als Kontaktprofil speichern. Es werden keine
    // Default-Slots angelegt, weil OSM keine Praxisverfügbarkeit liefert.
    const result = await queryOne<{ id: string }>(
      `INSERT INTO doctors (id, name, specialty, address, phone, email, website, booking_url, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         specialty = EXCLUDED.specialty,
         address = EXCLUDED.address,
         phone = EXCLUDED.phone,
         email = EXCLUDED.email,
         website = EXCLUDED.website,
         booking_url = EXCLUDED.booking_url,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        doctor.id,
        doctor.name,
        doctor.specialty,
        doctor.address || '',
        doctor.phone || '',
        doctor.email || '',
        doctor.website || null,
        doctor.bookingUrl || null,
        doctor.latitude || null,
        doctor.longitude || null,
      ]
    );

    // OSM liefert keine Kalender-/Verfügbarkeitsdaten. Daher werden hier
    // bewusst KEINE HEIMAT-Slots erzeugt: Der echte Buchungsweg ist nur ein
    // expliziter bookingUrl/website/phone-Kontakt aus der Praxisquelle.
    const doctorDbId = result!.id;
    logger.info(`OSM-Arzt ${doctor.name} (${doctor.id}) als Kontaktprofil gespeichert`);
    return doctorDbId;
  }

  async registerDoctor(data: {
    name: string;
    specialty: string;
    address: string;
    phone?: string;
    email?: string;
    website?: string;
    bookingUrl?: string;
    latitude?: number;
    longitude?: number;
    slots?: Array<{ day_of_week: number; start_time: string; end_time: string }>;
  }): Promise<Doctor> {
    const result = await queryOne<Doctor>(
      `INSERT INTO doctors (name, specialty, address, phone, email, website, booking_url, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.name,
        data.specialty,
        data.address,
        data.phone || null,
        data.email || null,
        data.website || null,
        data.bookingUrl || null,
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
    // Arzt nicht in DB? → leere Slots (keine spezielle OSM-Prüfung nötig,
    // da deterministische UUIDs das Schema vereinheitlichen)
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
    time: string,
    notes?: string,
    recurrenceId?: string | null
  ): Promise<Appointment> {
    // Arzt muss in DB existieren (OSM-Aerzte werden dynamisch angelegt via ensureDoctorInDb)
    await this.getDoctorById(doctorId);

    const availableSlots = await this.getAvailableSlots(doctorId, date);
    if (!availableSlots.includes(time)) {
      throw new AppError('This time slot is not available', 400);
    }

    const result = await queryOne<Appointment>(
      `INSERT INTO appointments (doctor_id, patient_name, patient_email, appointment_date, appointment_time, status, notes, recurrence_id)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
       RETURNING *`,
      [doctorId, patientName, patientEmail, date, time, notes || null, recurrenceId ?? null]
    );

    return result!;
  }

  /**
   * Recurring Slots: Bucht dieselbe Uhrzeit an N aufeinanderfolgenden Wochen
   * (z.B. "jeden Dienstag 14:00" fuer 4 Wochen). Alle Termine teilen eine
   * recurrence_id, damit die Serie als Einheit verwaltet werden kann.
   */
  async bookRecurringAppointments(
    doctorId: string,
    patientName: string,
    patientEmail: string,
    startDate: string,
    time: string,
    weeks: number,
    notes?: string
  ): Promise<{ appointments: Appointment[]; recurrenceId: string; booked: number; failed: string[] }> {
    if (weeks < 1 || weeks > 12) {
      throw new AppError('weeks must be between 1 and 12', 400);
    }
    await this.getDoctorById(doctorId);

    const recurrenceId = randomUUID();
    const appointments: Appointment[] = [];
    const failed: string[] = [];

    // startDate ist 'YYYY-MM-DD' (UTC). Jede weitere Woche = +7 Tage (UTC),
    // dadurch bleibt der Wochentag der Serie identisch (z.B. immer Dienstag).
    const start = new Date(startDate + 'T00:00:00Z');

    for (let i = 0; i < weeks; i++) {
      const current = new Date(start);
      current.setUTCDate(start.getUTCDate() + i * 7);
      const dateStr = current.toISOString().slice(0, 10);

      try {
        const booked = await this.bookAppointment(
          doctorId, patientName, patientEmail, dateStr, time, notes, recurrenceId
        );
        appointments.push(booked);
      } catch {
        failed.push(dateStr);
      }
    }

    return { appointments, recurrenceId, booked: appointments.length, failed };
  }

  async getAppointments(patientName: string): Promise<Appointment[]> {
    return query<Appointment>(
      'SELECT * FROM appointments WHERE patient_name = $1 AND status != $2 ORDER BY appointment_date, appointment_time',
      [patientName, 'cancelled']
    );
  }

  async cancelAppointment(appointmentId: string): Promise<{ appointment: Appointment; promoted: WaitlistEntry | null }> {
    const result = await queryOne<Appointment>(
      "UPDATE appointments SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [appointmentId]
    );

    if (!result) {
      throw new AppError('Appointment not found', 404);
    }

    // Warteliste: Nach Stornierung automatisch ersten Wartenden nachruecken
    const promoted = await this.promoteFromWaitlist(
      result.doctor_id,
      result.appointment_date,
      result.appointment_time.substring(0, 5)
    );

    return { appointment: result, promoted };
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

  /** Status-Pipeline: Termin durchgefuehrt */
  async completeAppointment(appointmentId: string): Promise<Appointment> {
    const result = await queryOne<Appointment>(
      "UPDATE appointments SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [appointmentId]
    );
    if (!result) {
      throw new AppError('Appointment not found', 404);
    }
    return result;
  }

  /** Status-Pipeline: Patient ohne Absage nicht erschienen */
  async markNoShow(appointmentId: string): Promise<Appointment> {
    const result = await queryOne<Appointment>(
      "UPDATE appointments SET status = 'no-show', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
      [appointmentId]
    );
    if (!result) {
      throw new AppError('Appointment not found', 404);
    }
    return result;
  }

  /**
   * Warteliste: Eintrag fuer einen belegten Slot anlegen.
   * Idempotent: gleicher Patient + Slot wird nicht doppelt eingetragen.
   */
  async joinWaitlist(
    doctorId: string,
    patientName: string,
    patientEmail: string,
    date: string,
    time: string
  ): Promise<WaitlistEntry> {
    const result = await queryOne<WaitlistEntry>(
      `INSERT INTO appointment_waitlist (doctor_id, patient_name, patient_email, requested_date, requested_time, status)
       VALUES ($1, $2, $3, $4, $5, 'waiting')
       ON CONFLICT (doctor_id, requested_date, requested_time, patient_name)
       DO UPDATE SET patient_email = EXCLUDED.patient_email, status = 'waiting',
                     created_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [doctorId, patientName, patientEmail || null, date, time]
    );
    return result!;
  }

  /**
   * Warteliste: Ersten wartenden Patienten fuer einen freigewordenen Slot buchen.
   * Wird automatisch bei Stornierung aufgerufen (cancelAppointment).
   */
  async promoteFromWaitlist(
    doctorId: string,
    date: string,
    time: string
  ): Promise<WaitlistEntry | null> {
    const waiting = await queryOne<WaitlistEntry>(
      `SELECT * FROM appointment_waitlist
       WHERE doctor_id = $1 AND requested_date = $2 AND requested_time = $3 AND status = 'waiting'
       ORDER BY created_at ASC
       LIMIT 1`,
      [doctorId, date, time]
    );
    if (!waiting) return null;

    // Slot ist nach Stornierung frei — sofort buchen (auch wenn andere
    // zwischenzeitlich gebucht haben, schlaegt bookAppointment fehl und wir
    // lassen den Eintrag fuer den naechsten Promote-Zyklus stehen).
    try {
      await this.bookAppointment(
        doctorId,
        waiting.patient_name,
        waiting.patient_email || '',
        waiting.requested_date,
        waiting.requested_time.substring(0, 5),
        'Automatisch von der Warteliste nachgerueckt'
      );
      await query(
        "UPDATE appointment_waitlist SET status = 'promoted' WHERE id = $1",
        [waiting.id]
      );
      return { ...waiting, status: 'promoted' };
    } catch {
      return null; // Slot wurde doch wieder belegt — kein Ruecken
    }
  }

  /**
   * Push-Benachrichtigung (Termin-Erinnerung): Liefert bevorstehende Termine
   * eines Patienten innerhalb der naechsten X Stunden. Der Mobile-Client pollt
   * diesen Endpoint und zeigt "Termin in 1 Stunde".
   */
  async getUpcomingAppointments(
    patientEmail: string,
    withinHours: number = 2
  ): Promise<Appointment[]> {
    return query<Appointment>(
      `SELECT a.*, d.name AS doctor_name
       FROM appointments a
       LEFT JOIN doctors d ON d.id = a.doctor_id
       WHERE a.patient_email = $1
         AND a.status IN ('pending', 'confirmed')
         AND (a.appointment_date + a.appointment_time)::timestamp
             BETWEEN CURRENT_TIMESTAMP
             AND CURRENT_TIMESTAMP + ($2 || ' hours')::interval
       ORDER BY a.appointment_date, a.appointment_time
       LIMIT 10`,
      [patientEmail, withinHours]
    );
  }
}

export const healthService = new HealthService();
