import { RaptorAlgorithmFactory, DepartAfterQuery, JourneyFactory, Service } from 'raptor-journey-planner';
import { query } from '../config/database';
import { logger } from '../utils/logger';
import { errorMessage } from '../utils/error';

interface JourneyResult {
  departure: { time: string; stop: string };
  arrival: { time: string; stop: string };
  legs: unknown[];
}

interface StopTimeRow {
  trip_id: string;
  stop_id: string;
  departure_time: string;
  arrival_time: string;
  stop_sequence: number;
}

interface TripRow {
  trip_id: string;
  route_id: string;
  service_id: string;
}

interface TransferRow {
  from_stop_id: string;
  to_stop_id: string;
  transfer_type: number;
  min_transfer_time: number;
}

function parseGtfsTime(t: string): number {
  if (!t) return 0;
  const parts = t.split(':');
  return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2] || '0');
}

class RaptorService {
  private static instance: RaptorService;
  private raptor: ReturnType<typeof RaptorAlgorithmFactory.create> | null = null;
  private initialized = false;
  private loading = false;

  private constructor() {}

  static getInstance(): RaptorService {
    if (!RaptorService.instance) {
      RaptorService.instance = new RaptorService();
    }
    return RaptorService.instance;
  }

  async initializeFromDb(): Promise<void> {
    if (this.initialized || this.loading) return;

    this.loading = true;
    logger.info('RAPTOR: Loading GTFS data from PostgreSQL...');

    try {
      const tripRows = await query<TripRow>('SELECT trip_id, route_id, service_id FROM gtfs_trips');
      if (tripRows.length === 0) {
        logger.warn('RAPTOR: No GTFS trips found in database');
        this.loading = false;
        return;
      }

      const stopTimeRows = await query<StopTimeRow>(
        'SELECT trip_id, stop_id, arrival_time, departure_time, stop_sequence FROM gtfs_stop_times ORDER BY trip_id, stop_sequence'
      );

      const transferRows = await query<TransferRow>(
        'SELECT from_stop_id, to_stop_id, transfer_type, min_transfer_time FROM gtfs_transfers'
      );

      const stopTimesByTrip: Record<string, { stop: string; departureTime: number; arrivalTime: number; pickUp: boolean; dropOff: boolean }[]> = {};
      for (const st of stopTimeRows) {
        if (!stopTimesByTrip[st.trip_id]) stopTimesByTrip[st.trip_id] = [];
        stopTimesByTrip[st.trip_id].push({
          stop: st.stop_id,
          departureTime: parseGtfsTime(st.departure_time),
          arrivalTime: parseGtfsTime(st.arrival_time),
          pickUp: true,
          dropOff: true,
        });
      }

      const trips: Parameters<typeof RaptorAlgorithmFactory.create>[0] = [];

      for (const t of tripRows) {
        const st = stopTimesByTrip[t.trip_id];
        if (st && st.length > 0) {
          trips.push({
            serviceId: t.service_id,
            tripId: t.trip_id,
            stopTimes: st,
            service: new Service(20240101, 20261231, { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true }, {}),
          } as never);
        }
      }

      const transfers: Record<string, { origin: string; destination: string; duration: number; startTime: number; endTime: number }[]> = {};
      const interchange: Record<string, number> = {};

      for (const tr of transferRows) {
        if (tr.from_stop_id === tr.to_stop_id) {
          interchange[tr.from_stop_id] = tr.min_transfer_time;
        } else {
          if (!transfers[tr.from_stop_id]) transfers[tr.from_stop_id] = [];
          transfers[tr.from_stop_id].push({
            origin: tr.from_stop_id,
            destination: tr.to_stop_id,
            duration: tr.min_transfer_time,
            startTime: 0,
            endTime: Number.MAX_SAFE_INTEGER,
          });
        }
      }

      this.raptor = RaptorAlgorithmFactory.create(trips, transfers, interchange);
      this.initialized = true;
      logger.info(`RAPTOR: Initialized from DB with ${trips.length} trips, ${Object.keys(transfers).length} transfer keys`);
    } catch (error: unknown) {
      logger.error(`RAPTOR: Initialization from DB failed: ${errorMessage(error)}`);
      throw error;
    } finally {
      this.loading = false;
    }
  }

  async findJourneys(
    from: string,
    to: string,
    departureTime: Date,
  ): Promise<JourneyResult[]> {
    if (!this.initialized || !this.raptor) {
      throw new Error('RAPTOR not initialized');
    }

    const query = new DepartAfterQuery(this.raptor, new JourneyFactory());
    const journeys = query.plan(from, to, departureTime, 14 * 60 * 60);

    return journeys.slice(0, 3) as unknown as JourneyResult[];
  }

  isReady(): boolean {
    return this.initialized;
  }
}

export default RaptorService.getInstance();
