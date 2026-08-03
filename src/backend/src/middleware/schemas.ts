import { z } from 'zod';

// ---------------------------------------------------------------------------
// Mobility
// ---------------------------------------------------------------------------

export const stopsQuerySchema = z.object({
  lat: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= -90 && parseFloat(v) <= 90, 'Invalid latitude'),
  lng: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= -180 && parseFloat(v) <= 180, 'Invalid longitude'),
  radius: z.string().optional().refine(v => !v || (!isNaN(parseFloat(v)) && parseFloat(v) > 0), 'Radius must be positive'),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required').max(200),
});

export const routeQuerySchema = z.object({
  from_lat: z.string().refine(v => !isNaN(parseFloat(v)), 'Invalid from_lat'),
  from_lng: z.string().refine(v => !isNaN(parseFloat(v)), 'Invalid from_lng'),
  to_lat: z.string().refine(v => !isNaN(parseFloat(v)), 'Invalid to_lat'),
  to_lng: z.string().refine(v => !isNaN(parseFloat(v)), 'Invalid to_lng'),
});

export const geocodeQuerySchema = z.object({
  address: z.string().min(1, 'Address is required').max(500),
});

export const departuresQuerySchema = z.object({
  stopId: z.string().optional(),
  lat: z.string().optional().refine(v => !v || !isNaN(parseFloat(v)), 'Invalid latitude'),
  lng: z.string().optional().refine(v => !v || !isNaN(parseFloat(v)), 'Invalid longitude'),
  duration: z.string().optional().refine(v => !v || (!isNaN(parseInt(v)) && parseInt(v) > 0), 'Duration must be positive'),
}).refine(data => data.stopId || (data.lat && data.lng), 'Either stopId or lat+lng is required');

export const journeyQuerySchema = z.object({
  from_lat: z.string().refine(v => !isNaN(parseFloat(v)), 'Invalid from_lat'),
  from_lng: z.string().refine(v => !isNaN(parseFloat(v)), 'Invalid from_lng'),
  to_lat: z.string().refine(v => !isNaN(parseFloat(v)), 'Invalid to_lat'),
  to_lng: z.string().refine(v => !isNaN(parseFloat(v)), 'Invalid to_lng'),
});

export const raptorJourneyQuerySchema = z.object({
  from: z.string().min(1, 'From stop ID is required'),
  to: z.string().min(1, 'To stop ID is required'),
  departureTime: z.string().optional(),
});

export const stopsMatchQuerySchema = z.object({
  osm_id: z.string().refine(v => !isNaN(parseInt(v)), 'Invalid osm_id'),
  name: z.string().min(1, 'Name is required'),
  lat: z.string().refine(v => !isNaN(parseFloat(v)), 'Invalid latitude'),
  lng: z.string().refine(v => !isNaN(parseFloat(v)), 'Invalid longitude'),
});

export const logDelayBodySchema = z.object({
  tripId: z.string().min(1, 'tripId is required'),
  line: z.string().min(1, 'line is required'),
  stopId: z.string().optional(),
  stopName: z.string().optional(),
  scheduledDeparture: z.string().min(1, 'scheduledDeparture is required'),
  actualDeparture: z.string().optional(),
  delayMinutes: z.number().optional().refine(v => v === undefined || v >= 0, 'Delay must be non-negative'),
});

export const aiIntentBodySchema = z.object({
  message: z.string().min(1, 'message is required').max(1000),
});

export const aiPersonalRouteBodySchema = z.object({
  message: z.string().min(1, 'message is required').max(1000),
  origin: z.string().min(1, 'origin is required'),
  destination: z.string().min(1, 'destination is required'),
});

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

const externalHttpUrlSchema = z.string()
  .url('Invalid external URL')
  .max(2000)
  .refine(value => {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  }, 'Only http:// and https:// URLs are allowed');

export const doctorsQuerySchema = z.object({
  specialty: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
});

export const doctorsNearbyQuerySchema = z.object({
  lat: z.string().refine(v => !isNaN(parseFloat(v)), 'Invalid latitude'),
  lng: z.string().refine(v => !isNaN(parseFloat(v)), 'Invalid longitude'),
  radius: z.string().optional().refine(v => !v || (!isNaN(parseFloat(v)) && parseFloat(v) > 0), 'Radius must be positive'),
  specialty: z.string().max(100).optional(),
});

// ---------------------------------------------------------------------------
// Health AI Agent: Memory & Medications
// ---------------------------------------------------------------------------

export const healthMemoryQuerySchema = z.object({
  limit: z.string().optional().refine(v => !v || (!isNaN(parseInt(v)) && parseInt(v) > 0), 'Limit must be positive'),
  symptom: z.string().max(100).optional(),
  days: z.string().optional().refine(v => !v || (!isNaN(parseInt(v)) && parseInt(v) > 0), 'Days must be positive'),
  resolved: z.string().optional().refine(v => v === 'true' || v === 'false', 'Resolved must be true or false'),
});

export const createHealthMemoryBodySchema = z.object({
  symptom_text: z.string().min(1, 'symptom_text is required').max(1000),
  symptom_category: z.string().max(100).optional(),
  severity: z.number().int().min(1).max(10).optional(),
  duration: z.string().max(50).optional(),
  triage_level: z.enum(['NOTFALL', 'BEREITSCHAFT', 'ROUTINE']).optional(),
  triage_confidence: z.number().min(0).max(1).optional(),
  icd_codes: z.array(z.string()).optional(),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }).optional(),
  weather_condition: z.string().max(50).optional(),
  season: z.enum(['fruehling', 'sommer', 'herbst', 'winter']).optional(),
  medications_used: z.array(z.string()).optional(),
});

export const resolveHealthMemoryBodySchema = z.object({
  doctor_visit: z.boolean().optional(),
  doctor_id: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
});

export const userMedicationsQuerySchema = z.object({
  active_only: z.string().optional().refine(v => v === 'true' || v === 'false', 'active_only must be true or false'),
});

export const createMedicationBodySchema = z.object({
  name: z.string().min(1, 'name is required').max(255),
  active_ingredient: z.string().max(255).optional(),
  dosage: z.string().max(100).optional(),
  frequency: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  is_prescription: z.boolean().optional(),
  start_date: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export const updateMedicationBodySchema = z.object({
  name: z.string().max(255).optional(),
  active_ingredient: z.string().max(255).optional(),
  dosage: z.string().max(100).optional(),
  frequency: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  is_prescription: z.boolean().optional(),
  is_active: z.boolean().optional(),
  end_date: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export const checkInteractionsBodySchema = z.object({
  drugs: z.array(z.string().min(1)).min(2, 'At least 2 drugs required'),
});

export const ensureDoctorBodySchema = z.object({
  id: z.string().min(1, 'id is required'),
  name: z.string().min(1, 'name is required').max(255),
  specialty: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email('Invalid email format').max(255).optional(),
  website: externalHttpUrlSchema.optional(),
  bookingUrl: externalHttpUrlSchema.optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const registerDoctorBodySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  specialty: z.string().min(1, 'Specialty is required').max(100),
  address: z.string().min(1, 'Address is required').max(500),
  phone: z.string().max(50).optional(),
  email: z.string().email('Invalid email format').max(255).optional(),
  website: externalHttpUrlSchema.optional(),
  bookingUrl: externalHttpUrlSchema.optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  slots: z.array(z.object({
    day_of_week: z.number().min(0).max(6),
    start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
    end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  })).optional(),
});

export const doctorSlotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
});

export const bookAppointmentBodySchema = z.object({
  doctorId: z.string().min(1, 'doctorId is required'),
  patientName: z.string().min(1, 'patientName is required').max(255),
  patientEmail: z.string().email('Invalid email format').max(255).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  notes: z.string().max(1000).optional(),
});

export const bookRecurringAppointmentBodySchema = z.object({
  doctorId: z.string().min(1, 'doctorId is required'),
  patientName: z.string().min(1, 'patientName is required').max(255),
  patientEmail: z.string().email('Invalid email format').max(255).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  weeks: z.number().int().min(1).max(12, 'weeks must be 1-12'),
  notes: z.string().max(1000).optional(),
});

export const waitlistBodySchema = z.object({
  doctorId: z.string().min(1, 'doctorId is required'),
  patientName: z.string().min(1, 'patientName is required').max(255),
  patientEmail: z.string().email('Invalid email format').max(255).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
});

export const upcomingAppointmentsQuerySchema = z.object({
  patientEmail: z.string().email('Invalid email format'),
  withinHours: z.string().optional().refine(v => !v || (!isNaN(parseInt(v)) && parseInt(v) > 0 && parseInt(v) <= 72), 'withinHours must be 1-72'),
});

// ---------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------

export const payBodySchema = z.object({
  from: z.string().min(1, 'from is required'),
  to: z.string().min(1, 'to is required'),
  amount: z.number().positive('Amount must be positive').max(1000000, 'Amount too large'),
  currency: z.string().max(10).optional(),
  description: z.string().max(500).optional(),
});

export const talerPurseBodySchema = z.object({
  senderUserId: z.string().min(1, 'senderUserId is required'),
  receiverUserId: z.string().min(1, 'receiverUserId is required'),
  amount: z.number().positive('Amount must be positive').max(1000000),
  contractHash: z.string().max(128).optional(),
  description: z.string().max(500).optional(),
});

export const talerPurseActionBodySchema = z.object({
  senderUserId: z.string().optional(),
  receiverUserId: z.string().optional(),
  userId: z.string().optional(),
}).refine(
  data => data.senderUserId || data.receiverUserId || data.userId,
  'At least one user ID is required'
);

// ---------------------------------------------------------------------------
// E-Ladestationen (Phase C-1)
// ---------------------------------------------------------------------------

export const evChargingStationsQuerySchema = z.object({
  lat: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= -90 && parseFloat(v) <= 90, 'Invalid latitude'),
  lng: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= -180 && parseFloat(v) <= 180, 'Invalid longitude'),
  radius_km: z.string().optional().refine(v => !v || (!isNaN(parseFloat(v)) && parseFloat(v) > 0 && parseFloat(v) <= 50), 'Radius must be 1-50 km'),
});

// ---------------------------------------------------------------------------
// Parken (Phase C-2)
// ---------------------------------------------------------------------------

export const parkingSpotsQuerySchema = z.object({
  lat: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= -90 && parseFloat(v) <= 90, 'Invalid latitude'),
  lng: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= -180 && parseFloat(v) <= 180, 'Invalid longitude'),
  radius_km: z.string().optional().refine(v => !v || (!isNaN(parseFloat(v)) && parseFloat(v) > 0 && parseFloat(v) <= 20), 'Radius must be 1-20 km'),
});

// ---------------------------------------------------------------------------
// Health AI Agent Phase 2: Mental Health, Prävention, Nachsorge
// ---------------------------------------------------------------------------

export const phq9AnswersSchema = z.object({
  q1_lustlos: z.number().int().min(0).max(3),
  q2_niedergeschlagen: z.number().int().min(0).max(3),
  q3_schlafprobleme: z.number().int().min(0).max(3),
  q4_muedigkeit: z.number().int().min(0).max(3),
  q5_appetit: z.number().int().min(0).max(3),
  q6_schlecht: z.number().int().min(0).max(3),
  q7_konzentration: z.number().int().min(0).max(3),
  q8_bewegung: z.number().int().min(0).max(3),
  q9_selbstverletzung: z.number().int().min(0).max(3),
});

export const createPhq9BodySchema = z.object({
  answers: phq9AnswersSchema,
  additional_notes: z.string().max(1000).optional(),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }).optional(),
});

export const phq9HistoryQuerySchema = z.object({
  limit: z.string().optional().refine(v => !v || (!isNaN(parseInt(v)) && parseInt(v) > 0), 'Limit must be positive'),
});

export const preventionGenerateBodySchema = z.object({}).passthrough();

export const completePreventionBodySchema = z.object({
  doctor_id: z.string().uuid().optional(),
});

export const respondFollowUpBodySchema = z.object({
  text: z.string().min(1, 'response text is required').max(2000),
  severity: z.number().int().min(1).max(10),
});

export const followUpHistoryQuerySchema = z.object({
  limit: z.string().optional().refine(v => !v || (!isNaN(parseInt(v)) && parseInt(v) > 0), 'Limit must be positive'),
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const adminMigrateBodySchema = z.object({}).passthrough();
