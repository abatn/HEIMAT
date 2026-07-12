import { query, queryOne } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import axios from 'axios';

interface Stop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  stop_type: string;
}

interface Connection {
  id: string;
  departure_stop: string;
  arrival_stop: string;
  departure_time: string;
  arrival_time: string;
  line: string;
  transport_type: string;
}

export class MobilityService {
  private readonly nominatimUrl = 'https://nominatim.openstreetmap.org';
  private readonly osrmUrl = 'https://router.project-osrm.org';

  async getNearbyStops(lat: number, lng: number, radiusMeters: number = 1000): Promise<Stop[]> {
    // Haversine-Formel für Entfernungsberechnung (kein PostGIS nötig)
    const stops = await query<Stop>(
      `SELECT id, name, latitude, longitude, stop_type,
              (6371000 * acos(
                cos(radians($2)) * cos(radians(latitude)) *
                cos(radians(longitude) - radians($1)) +
                sin(radians($2)) * sin(radians(latitude))
              )) AS distance
       FROM stops
       WHERE (6371000 * acos(
                cos(radians($2)) * cos(radians(latitude)) *
                cos(radians(longitude) - radians($1)) +
                sin(radians($2)) * sin(radians(latitude))
              )) < $3
       ORDER BY distance
       LIMIT 10`,
      [lng, lat, radiusMeters]
    );

    return stops;
  }

  async getStopById(id: string): Promise<Stop> {
    const stop = await queryOne<Stop>('SELECT * FROM stops WHERE id = $1', [id]);
    if (!stop) {
      throw new AppError('Stop not found', 404);
    }
    return stop;
  }

  async searchStops(query_text: string): Promise<Stop[]> {
    return query<Stop>(
      'SELECT * FROM stops WHERE name ILIKE $1 ORDER BY name LIMIT 20',
      [`%${query_text}%`]
    );
  }

  async getConnections(fromStopId: string, toStopId: string): Promise<Connection[]> {
    return query<Connection>(
      `SELECT c.*, 
              fs.name as departure_stop_name, 
              as.name as arrival_stop_name
       FROM connections c
       JOIN stops fs ON c.departure_stop_id = fs.id
       JOIN stops as ON c.arrival_stop_id = as.id
       WHERE c.departure_stop_id = $1 AND c.arrival_stop_id = $2
       ORDER BY c.departure_time`,
      [fromStopId, toStopId]
    );
  }

  async geocodeAddress(address: string): Promise<{ lat: number; lng: number; display_name: string }[]> {
    try {
      const response = await axios.get(`${this.nominatimUrl}/search`, {
        params: {
          q: address,
          format: 'json',
          limit: 5,
          countrycodes: 'de',
        },
        headers: {
          'User-Agent': 'HEIMAT-App/1.0 (https://github.com/abatn/HEIMAT)',
        },
      });

      return response.data.map((item: any) => ({
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        display_name: item.display_name,
      }));
    } catch (error) {
      throw new AppError('Geocoding failed', 500);
    }
  }

  async getRoute(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<any> {
    try {
      const response = await axios.get(
        `${this.osrmUrl}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}`,
        {
          params: {
            overview: 'full',
            geometries: 'geojson',
          },
        }
      );

      if (response.data.routes && response.data.routes.length > 0) {
        return response.data.routes[0];
      }

      throw new AppError('No route found', 404);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Routing service unavailable', 503);
    }
  }
}

export const mobilityService = new MobilityService();
