import { gtfsService, GtfsStop, GtfsRoute, GtfsTrip, GtfsStopTime, GtfsDeparture } from './gtfsService';
import { logger } from '../utils/logger';

export interface JourneyLeg {
  type: 'walk' | 'transit';
  from: string;
  to: string;
  from_lat: number;
  from_lng: number;
  to_lat: number;
  to_lng: number;
  route?: string;
  route_color?: string;
  route_type?: number;
  headsign?: string;
  departure: string;
  arrival: string;
  duration_min: number;
  trip_id?: string;
}

export interface Journey {
  legs: JourneyLeg[];
  total_duration_min: number;
  total_transfers: number;
  departure: string;
  arrival: string;
}

interface RaptorStop {
  stop_id: string;
  name: string;
  lat: number;
  lng: number;
  routes: Set<string>;
  trips: Map<string, GtfsStopTime[]>; // trip_id -> stop_times
}

interface Footpath {
  from_stop: string;
  to_stop: string;
  duration_sec: number;
}

export class RaptorService {
  private stops = new Map<string, RaptorStop>();
  private footpaths: Footpath[] = [];
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await gtfsService.ensureLoaded();

    const gtfsStops = gtfsService.getStops();
    const gtfsTrips = gtfsService.getTrips();
    const gtfsStopTimes = gtfsService.getStopTimes();

    // Stop-Index aufbauen
    for (const s of gtfsStops) {
      this.stops.set(s.stop_id, {
        stop_id: s.stop_id,
        name: s.name,
        lat: s.latitude,
        lng: s.longitude,
        routes: new Set(),
        trips: new Map(),
      });
    }

    // Trips zu Stops zuordnen
    const tripStopTimes = new Map<string, GtfsStopTime[]>();
    for (const st of gtfsStopTimes) {
      if (!tripStopTimes.has(st.trip_id)) tripStopTimes.set(st.trip_id, []);
      tripStopTimes.get(st.trip_id)!.push(st);
    }

    // Sortiere stop_times pro Trip nach sequence
    for (const [tripId, times] of tripStopTimes) {
      times.sort((a, b) => a.stop_sequence - b.stop_sequence);
      const trip = gtfsTrips.find(t => t.trip_id === tripId);
      if (!trip) continue;

      for (const st of times) {
        const stop = this.stops.get(st.stop_id);
        if (!stop) continue;
        stop.routes.add(trip.route_id);
        if (!stop.trips.has(tripId)) stop.trips.set(tripId, []);
        stop.trips.get(tripId)!.push(st);
      }
    }

    // Walking-Footpaths: Stops innerhalb 200m verbinden
    const stopArray = Array.from(this.stops.values());
    for (let i = 0; i < stopArray.length; i++) {
      for (let j = i + 1; j < stopArray.length; j++) {
        const a = stopArray[i], b = stopArray[j];
        const dist = this.haversineMeters(a.lat, a.lng, b.lat, b.lng);
        if (dist <= 200) {
          const walkDuration = Math.round(dist / 1.4); // 1.4 m/s = 5 km/h
          this.footpaths.push({ from_stop: a.stop_id, to_stop: b.stop_id, duration_sec: walkDuration });
          this.footpaths.push({ from_stop: b.stop_id, to_stop: a.stop_id, duration_sec: walkDuration });
        }
      }
    }

    this.initialized = true;
    logger.info(`RAPTOR initialisiert: ${this.stops.size} Stops, ${this.footpaths.length} Footpaths`);
  }

  // Finde nächste Haltestellen in der Nähe
  findNearbyStops(lat: number, lng: number, maxDist: number = 1000, limit: number = 5): { stop: RaptorStop; distance: number }[] {
    if (gtfsService.getStops().length === 0) {
      logger.warn('RAPTOR: Keine GTFS-Daten verfügbar');
      return [];
    }
    const results: { stop: RaptorStop; distance: number }[] = [];
    for (const stop of this.stops.values()) {
      const dist = this.haversineMeters(lat, lng, stop.lat, stop.lng);
      if (dist <= maxDist) {
        results.push({ stop, distance: dist });
      }
    }
    return results.sort((a, b) => a.distance - b.distance).slice(0, limit);
  }

  // Vereinfachter RAPTOR: Findet Verbindungen von A nach B
  async findJourneys(fromLat: number, fromLng: number, toLat: number, toLng: number, maxTransfers: number = 3): Promise<Journey[]> {
    await this.initialize();

    if (gtfsService.getStops().length === 0) {
      logger.warn('RAPTOR: Keine GTFS-Daten verfügbar');
      return [];
    }

    const nearbyFrom = this.findNearbyStops(fromLat, fromLng, 1000, 5);
    const nearbyTo = this.findNearbyStops(toLat, toLng, 1000, 5);

    if (nearbyFrom.length === 0 || nearbyTo.length === 0) {
      // Keine GTFS-Stops in der Nähe → OSRM-Fallback
      return [];
    }

    const now = new Date();
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

    const journeys: Journey[] = [];

    // Für jeden Start- und Ziel-Stop: Alle Trips durchsuchen
    for (const fromEntry of nearbyFrom) {
      for (const toEntry of nearbyTo) {
        if (fromEntry.stop.stop_id === toEntry.stop.stop_id) continue;

        // Alle Trips durchsuchen, die BOTH Stops bedienen
        for (const [tripId, fromTimes] of fromEntry.stop.trips) {
          const toTimes = toEntry.stop.trips.get(tripId);
          if (!toTimes || toTimes.length === 0) continue;

          const fromTime = fromTimes.find(t => t.departure_time >= currentHHMM);
          if (!fromTime) continue;

          const toTime = toTimes.find(t => t.stop_sequence > fromTime.stop_sequence);
          if (!toTime) continue;

          const trip = gtfsService.getTrips().find(t => t.trip_id === tripId);
          if (!trip) continue;
          const route = gtfsService.getRoutes().find(r => r.route_id === trip.route_id);

          const depMin = this.hhmmToMinutes(fromTime.departure_time);
          const arrMin = this.hhmmToMinutes(toTime.arrival_time || toTime.departure_time);
          const transitDuration = arrMin - depMin;
          if (transitDuration <= 0) continue;

          const walkToFrom = Math.round(fromEntry.distance / 1.4);
          const walkFromTo = Math.round(toEntry.distance / 1.4);
          const totalDuration = Math.round(walkToFrom / 60) + transitDuration + Math.round(walkFromTo / 60);

          const legs: JourneyLeg[] = [];

          // Walk to departure
          if (fromEntry.distance > 50) {
            legs.push({
              type: 'walk',
              from: `${fromLat.toFixed(5)}, ${fromLng.toFixed(5)}`,
              to: fromEntry.stop.name,
              from_lat: fromLat, from_lng: fromLng,
              to_lat: fromEntry.stop.lat, to_lng: fromEntry.stop.lng,
              departure: currentHHMM,
              arrival: fromTime.departure_time,
              duration_min: Math.round(walkToFrom / 60),
            });
          }

          // Transit leg
          legs.push({
            type: 'transit',
            from: fromEntry.stop.name,
            to: toEntry.stop.name,
            from_lat: fromEntry.stop.lat, from_lng: fromEntry.stop.lng,
            to_lat: toEntry.stop.lat, to_lng: toEntry.stop.lng,
            route: route?.short_name || '',
            route_color: route?.route_color || '#6B7280',
            route_type: route?.route_type || 3,
            headsign: trip.headsign,
            departure: fromTime.departure_time,
            arrival: toTime.arrival_time || toTime.departure_time,
            duration_min: transitDuration,
            trip_id: tripId,
          });

          // Walk to destination
          if (toEntry.distance > 50) {
            legs.push({
              type: 'walk',
              from: toEntry.stop.name,
              to: `${toLat.toFixed(5)}, ${toLng.toFixed(5)}`,
              from_lat: toEntry.stop.lat, from_lng: toEntry.stop.lng,
              to_lat: toLat, to_lng: toLng,
              departure: toTime.arrival_time || toTime.departure_time,
              arrival: this.minutesToHhmm(depMin + totalDuration),
              duration_min: Math.round(walkFromTo / 60),
            });
          }

          journeys.push({
            legs,
            total_duration_min: totalDuration,
            total_transfers: 0,
            departure: legs[0].departure,
            arrival: legs[legs.length - 1].arrival,
          });
        }
      }
    }

    // Pareto-sortiert: zuerst nach Dauer, dann nach Transfers
    journeys.sort((a, b) => a.total_duration_min - b.total_duration_min);

    // Dedupliziere (max 5 Ergebnisse)
    const seen = new Set<string>();
    return journeys.filter(j => {
      const key = `${j.departure}-${j.arrival}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5);
  }

  private haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private hhmmToMinutes(time: string): number {
    const parts = time.split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }

  private minutesToHhmm(min: number): string {
    const h = Math.floor(((min % (24 * 60)) + 24 * 60) % (24 * 60) / 60);
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  }
}

export const raptorService = new RaptorService();
