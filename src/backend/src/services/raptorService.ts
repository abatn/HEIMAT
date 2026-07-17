import { gtfsService, GtfsStop, GtfsRoute, GtfsTrip, GtfsStopTime } from './gtfsService';
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
  trips: Map<string, GtfsStopTime[]>;
}

interface Footpath {
  from_stop: string;
  to_stop: string;
  duration_sec: number;
}

export class RaptorService {
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

  // Lädt relevante GTFS-Daten aus der DB (Bounding-Box um Start/Ziel) und baut
  // einen lokalen Graphen. RAM-schonend: nur Stops in der Nähe werden geladen.
  private async buildGraph(fromLat: number, fromLng: number, toLat: number, toLng: number): Promise<{ stops: Map<string, RaptorStop>; footpaths: Footpath[] }> {
    const delta = 0.15; // ~16km Box
    const stops = new Map<string, RaptorStop>();

    const fromStops = await gtfsService.getStopsInBox(fromLat, fromLng, delta);
    const toStops = await gtfsService.getStopsInBox(toLat, toLng, delta);
    for (const s of [...fromStops, ...toStops]) {
      if (!stops.has(s.stop_id)) {
        stops.set(s.stop_id, { stop_id: s.stop_id, name: s.name, lat: s.latitude, lng: s.longitude, routes: new Set(), trips: new Map() });
      }
    }

    if (stops.size === 0) return { stops, footpaths: [] };

    // Trips die diese Stops bedienen
    const stopIds = Array.from(stops.keys());
    const stopTimes = await gtfsService.getStopTimesByTrips(
      // Wir laden stop_times über die stop_ids indirekt: getStopTimesByTrips braucht trip_ids.
      // Stattdessen laden wir alle Trips der betroffenen Routen via SQL in gtfsService.
      await this.tripIdsForStops(stopIds),
    );

    // Trips + Routen sammeln
    const tripIds = Array.from(new Set(stopTimes.map(st => st.trip_id)));
    const trips = await gtfsService.getTripsByIds(tripIds);
    const routeIds = Array.from(new Set(trips.map(t => t.route_id)));
    const routes = await gtfsService.getRoutesByIds(routeIds);
    const routeMap = new Map(routes.map(r => [r.route_id, r]));

    // stop_times pro Trip sortieren
    const tripStopTimes = new Map<string, GtfsStopTime[]>();
    for (const st of stopTimes) {
      if (!tripStopTimes.has(st.trip_id)) tripStopTimes.set(st.trip_id, []);
      tripStopTimes.get(st.trip_id)!.push(st);
    }
    for (const times of tripStopTimes.values()) times.sort((a, b) => a.stop_sequence - b.stop_sequence);

    for (const trip of trips) {
      const times = tripStopTimes.get(trip.trip_id);
      if (!times) continue;
      for (const st of times) {
        const stop = stops.get(st.stop_id);
        if (!stop) continue;
        stop.routes.add(trip.route_id);
        if (!stop.trips.has(trip.trip_id)) stop.trips.set(trip.trip_id, []);
        stop.trips.get(trip.trip_id)!.push(st);
      }
    }

    // Walking-Footpaths (200m) zwischen geladenen Stops
    const footpaths: Footpath[] = [];
    const arr = Array.from(stops.values());
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j];
        const dist = this.haversineMeters(a.lat, a.lng, b.lat, b.lng);
        if (dist <= 200) {
          const dur = Math.round(dist / 1.4);
          footpaths.push({ from_stop: a.stop_id, to_stop: b.stop_id, duration_sec: dur });
          footpaths.push({ from_stop: b.stop_id, to_stop: a.stop_id, duration_sec: dur });
        }
      }
    }

    return { stops, footpaths };
  }

  // Lädt trip_ids die an den gegebenen Stops halten (SQL)
  private async tripIdsForStops(stopIds: string[]): Promise<string[]> {
    if (stopIds.length === 0) return [];
    const params = stopIds.map((_, i) => `$${i + 1}`).join(',');
    const rows = await gtfsService.getStopTimesByStops(stopIds);
    return Array.from(new Set(rows.map(r => r.trip_id)));
  }

  findNearbyStops(stops: Map<string, RaptorStop>, lat: number, lng: number, maxDist = 1000, limit = 5): { stop: RaptorStop; distance: number }[] {
    const results: { stop: RaptorStop; distance: number }[] = [];
    for (const stop of stops.values()) {
      const dist = this.haversineMeters(lat, lng, stop.lat, stop.lng);
      if (dist <= maxDist) results.push({ stop, distance: dist });
    }
    return results.sort((a, b) => a.distance - b.distance).slice(0, limit);
  }

  async findJourneys(fromLat: number, fromLng: number, toLat: number, toLng: number, maxTransfers = 3): Promise<Journey[]> {
    const { stops, footpaths } = await this.buildGraph(fromLat, fromLng, toLat, toLng);

    if (stops.size === 0) {
      logger.warn('RAPTOR: Keine GTFS-Stops in der Nähe');
      return [];
    }

    const nearbyFrom = this.findNearbyStops(stops, fromLat, fromLng, 1500, 8);
    const nearbyTo = this.findNearbyStops(stops, toLat, toLng, 1500, 8);

    if (nearbyFrom.length === 0 || nearbyTo.length === 0) return [];

    const now = new Date();
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

    const journeys: Journey[] = [];

    for (const fromEntry of nearbyFrom) {
      for (const toEntry of nearbyTo) {
        if (fromEntry.stop.stop_id === toEntry.stop.stop_id) continue;

        for (const [tripId, fromTimes] of fromEntry.stop.trips) {
          const toTimes = toEntry.stop.trips.get(tripId);
          if (!toTimes || toTimes.length === 0) continue;

          const fromTime = fromTimes.find(t => t.departure_time >= currentHHMM);
          if (!fromTime) continue;

          const toTime = toTimes.find(t => t.stop_sequence > fromTime.stop_sequence);
          if (!toTime) continue;

          const trip = (await gtfsService.getTripsByIds([tripId]))[0];
          if (!trip) continue;
          const route = (await gtfsService.getRoutesByIds([trip.route_id]))[0];

          const depMin = this.hhmmToMinutes(fromTime.departure_time);
          const arrMin = this.hhmmToMinutes(toTime.arrival_time || toTime.departure_time);
          const transitDuration = arrMin - depMin;
          if (transitDuration <= 0) continue;

          const walkToFrom = Math.round(fromEntry.distance / 1.4);
          const walkFromTo = Math.round(toEntry.distance / 1.4);
          const totalDuration = Math.round(walkToFrom / 60) + transitDuration + Math.round(walkFromTo / 60);

          const legs: JourneyLeg[] = [];
          if (fromEntry.distance > 50) {
            legs.push({
              type: 'walk', from: `${fromLat.toFixed(5)}, ${fromLng.toFixed(5)}`, to: fromEntry.stop.name,
              from_lat: fromLat, from_lng: fromLng, to_lat: fromEntry.stop.lat, to_lng: fromEntry.stop.lng,
              departure: currentHHMM, arrival: fromTime.departure_time, duration_min: Math.round(walkToFrom / 60),
            });
          }
          legs.push({
            type: 'transit', from: fromEntry.stop.name, to: toEntry.stop.name,
            from_lat: fromEntry.stop.lat, from_lng: fromEntry.stop.lng, to_lat: toEntry.stop.lat, to_lng: toEntry.stop.lng,
            route: route?.short_name || '', route_color: route?.route_color || '#6B7280',
            route_type: route?.route_type || 3, headsign: trip.headsign,
            departure: fromTime.departure_time, arrival: toTime.arrival_time || toTime.departure_time,
            duration_min: transitDuration, trip_id: tripId,
          });
          if (toEntry.distance > 50) {
            legs.push({
              type: 'walk', from: toEntry.stop.name, to: `${toLat.toFixed(5)}, ${toLng.toFixed(5)}`,
              from_lat: toEntry.stop.lat, from_lng: toEntry.stop.lng, to_lat: toLat, to_lng: toLng,
              departure: toTime.arrival_time || toTime.departure_time, arrival: this.minutesToHhmm(depMin + totalDuration),
              duration_min: Math.round(walkFromTo / 60),
            });
          }

          journeys.push({
            legs, total_duration_min: totalDuration, total_transfers: 0,
            departure: legs[0].departure, arrival: legs[legs.length - 1].arrival,
          });
        }
      }
    }

    journeys.sort((a, b) => a.total_duration_min - b.total_duration_min);
    const seen = new Set<string>();
    return journeys.filter(j => {
      const key = `${j.departure}-${j.arrival}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5);
  }
}

export const raptorService = new RaptorService();
