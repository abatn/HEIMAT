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

export const registerDoctorBodySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  specialty: z.string().min(1, 'Specialty is required').max(100),
  address: z.string().min(1, 'Address is required').max(500),
  phone: z.string().max(50).optional(),
  email: z.string().email('Invalid email format').max(255).optional(),
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
// Admin
// ---------------------------------------------------------------------------

export const adminMigrateBodySchema = z.object({}).passthrough();
