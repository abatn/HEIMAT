import axios from 'axios';
import { AppError } from '../middleware/errorHandler';

interface Coordinates {
  lat: number;
  lng: number;
}

interface Connection {
  departure: string;
  arrival: string;
  duration: string;
  transfers: number;
  line: string;
  from: string;
  to: string;
}

interface Stop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  distance: number;
}

export class MobilityService {
  private readonly openRouteServiceUrl = 'https://router.project-osrm.org';
  private readonly nominatimUrl = 'https://nominatim.openstreetmap.org';

  async getConnections(from: Coordinates, to: Coordinates): Promise<Connection[]> {
    // Mock-Daten für Demo
    // In Produktion: GTFS-Daten abfragen
    const connections: Connection[] = [
      {
        departure: '08:30',
        arrival: '08:45',
        duration: '15 Min',
        transfers: 0,
        line: 'U2',
        from: 'Start',
        to: 'Ziel',
      },
      {
        departure: '08:35',
        arrival: '08:55',
        duration: '20 Min',
        transfers: 1,
        line: 'S-Bahn',
        from: 'Start',
        to: 'Ziel',
      },
      {
        departure: '08:40',
        arrival: '09:00',
        duration: '20 Min',
        transfers: 1,
        line: 'Bus 100',
        from: 'Start',
        to: 'Ziel',
      },
    ];

    return connections;
  }

  async getNearbyStops(lat: number, lng: number, radius: number = 500): Promise<Stop[]> {
    try {
      // Nominatim API für Haltestellen in der Nähe
      const response = await axios.get(`${this.nominatimUrl}/search`, {
        params: {
          q: 'haltestation',
          format: 'json',
          limit: 10,
          viewbox: `${lng - 0.01},${lat + 0.01},${lng + 0.01},${lat - 0.01}`,
        },
        headers: {
          'User-Agent': 'HEIMAT-App/1.0',
        },
      });

      const stops: Stop[] = response.data.map((item: any, index: number) => ({
        id: item.place_id?.toString() || index.toString(),
        name: item.display_name?.split(',')[0] || 'Haltestelle',
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        distance: this.calculateDistance(lat, lng, parseFloat(item.lat), parseFloat(item.lon)),
      }));

      return stops.filter(stop => stop.distance <= radius);
    } catch (error) {
      // Fallback: Mock-Daten
      return [
        {
          id: '1',
          name: 'Hauptbahnhof',
          lat: lat + 0.001,
          lng: lng + 0.001,
          distance: 100,
        },
        {
          id: '2',
          name: 'Marktplatz',
          lat: lat - 0.001,
          lng: lng - 0.001,
          distance: 200,
        },
      ];
    }
  }

  async getRoute(from: Coordinates, to: Coordinates, mode: string = 'driving'): Promise<any> {
    try {
      // OpenRouteService API
      const profile = this.getOsrmProfile(mode);
      const response = await axios.get(
        `${this.openRouteServiceUrl}/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}`,
        {
          params: {
            overview: 'full',
            geometries: 'geojson',
          },
        }
      );

      if (response.data.routes && response.data.routes.length > 0) {
        const route = response.data.routes[0];
        return {
          distance: route.distance,
          duration: route.duration,
          geometry: route.geometry,
        };
      }

      throw new AppError('No route found', 404);
    } catch (error) {
      if (error instanceof AppError) throw error;
      
      // Fallback: Direkte Linie
      const distance = this.calculateDistance(from.lat, from.lng, to.lat, to.lng);
      return {
        distance: distance,
        duration: distance / 50 * 60, // Geschwindigkeit 50 km/h
        geometry: {
          type: 'LineString',
          coordinates: [
            [from.lng, from.lat],
            [to.lng, to.lat],
          ],
        },
      };
    }
  }

  private getOsrmProfile(mode: string): string {
    const profiles: Record<string, string> = {
      driving: 'driving',
      walking: 'foot',
      cycling: 'cycling',
    };
    return profiles[mode] || 'driving';
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Erdradius in Metern
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

export const mobilityService = new MobilityService();
