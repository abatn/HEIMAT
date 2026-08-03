/**
 * search.ts — Universelle Suche über alle Services
 *
 * Ein einziges Suchfeld für ALLES:
 * - Ärzte (Overpass)
 * - Parkplätze (Overpass)
 * - E-Ladestationen (Overpass)
 * - Adressen (Nominatim)
 * - Events (Wikidata — TODO)
 *
 * GET /api/search?q=arzt+berlin&lat=52.52&lng=13.41
 *
 * Response: { results: [...], count: number, categories: {...} }
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { logger } from '../utils/logger';
import { ParkingService } from '../services/parkingService';
import { EvChargingService } from '../services/evChargingService';

export const searchRouter = Router();

interface SearchResult {
  id: string;
  category: 'doctor' | 'parking' | 'ev_charging' | 'address' | 'event';
  name: string;
  description: string;
  distance: number | null;
  lat: number | null;
  lng: number | null;
  relevance: number;
}

// Category detection from query
function detectCategories(query: string): string[] {
  const lower = query.toLowerCase();
  const categories: string[] = [];

  if (lower.match(/arzt|doktor|praxis|klinik|apotheke|gesundheit/)) {
    categories.push('doctor');
  }
  if (lower.match(/parken|parkplatz|garage|stellplatz/)) {
    categories.push('parking');
  }
  if (lower.match(/laden|ladestation|strom|ev|elektro/)) {
    categories.push('ev_charging');
  }
  if (lower.match(/event|veranstaltung|konzert|festival|markt/)) {
    categories.push('event');
  }
  if (lower.match(/straße|str\.|weg|platz|adresse/)) {
    categories.push('address');
  }

  // If no specific category detected, search all
  if (categories.length === 0) {
    categories.push('doctor', 'parking', 'ev_charging');
  }

  return categories;
}

// Search addresses via Nominatim
async function searchAddresses(
  query: string,
  lat: number,
  lng: number,
): Promise<SearchResult[]> {
  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search`,
      {
        params: {
          q: query,
          format: 'json',
          limit: 5,
          viewbox: `${lng - 0.05},${lat + 0.05},${lng + 0.05},${lat - 0.05}`,
          bounded: 1,
        },
        headers: { 'User-Agent': 'HEIMAT/2.0' },
        timeout: 10000,
      },
    );

    return response.data.map((item: any) => ({
      id: `address/${item.place_id}`,
      category: 'address' as const,
      name: item.display_name.split(',')[0],
      description: item.display_name,
      distance: null,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      relevance: 0.8,
    }));
  } catch (error) {
    logger.warn('Nominatim search failed:', error);
    return [];
  }
}

// Search parking spots
async function searchParking(
  lat: number,
  lng: number,
): Promise<SearchResult[]> {
  try {
    const service = new ParkingService();
    const spots = await service.getNearbySpots(lat, lng, 2);
    return spots.slice(0, 5).map((spot: any) => ({
      id: spot.id || `parking/${Math.random()}`,
      category: 'parking' as const,
      name: spot.name || 'Parkplatz',
      description: `${spot.fee === 'yes' ? 'Kostenpflichtig' : 'Kostenlos'}${spot.capacity ? ` · ${spot.capacity} Plätze` : ''}`,
      distance: spot.distance_km || null,
      lat: spot.latitude,
      lng: spot.longitude,
      relevance: 0.7,
    }));
  } catch (error) {
    logger.warn('Parking search failed:', error);
    return [];
  }
}

// Search EV charging stations
async function searchEvCharging(
  lat: number,
  lng: number,
): Promise<SearchResult[]> {
  try {
    const service = new EvChargingService();
    const stations = await service.getNearbyStations(lat, lng, 5);
    return stations.slice(0, 5).map((station: any) => ({
      id: station.id || `ev/${Math.random()}`,
      category: 'ev_charging' as const,
      name: station.name || 'Ladestation',
      description: `${station.sockets?.length || 0} Steckertypen${station.operator ? ` · ${station.operator}` : ''}`,
      distance: station.distance_km || null,
      lat: station.latitude,
      lng: station.longitude,
      relevance: 0.7,
    }));
  } catch (error) {
    logger.warn('EV Charging search failed:', error);
    return [];
  }
}

searchRouter.get('/', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    const lat = parseFloat(req.query.lat as string) || 52.52;
    const lng = parseFloat(req.query.lng as string) || 13.41;

    if (!query.trim()) {
      return res.status(400).json({ error: 'Suchbegriff erforderlich (q=...)' });
    }

    logger.info(`Search: "${query}" at ${lat},${lng}`);

    const categories = detectCategories(query);
    const results: SearchResult[] = [];

    // Search in parallel
    const searches = categories.map((cat) => {
      switch (cat) {
        case 'doctor':
          return searchAddresses(`${query} arzt`, lat, lng);
        case 'parking':
          return searchParking(lat, lng);
        case 'ev_charging':
          return searchEvCharging(lat, lng);
        case 'address':
          return searchAddresses(query, lat, lng);
        case 'event':
          return Promise.resolve([]); // TODO: Wikidata integration
        default:
          return Promise.resolve([]);
      }
    });

    const searchResults = await Promise.allSettled(searches);
    searchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push(...result.value);
      }
    });

    // Sort by relevance and distance
    results.sort((a, b) => {
      if (a.distance !== null && b.distance !== null) {
        return a.distance - b.distance;
      }
      return b.relevance - a.relevance;
    });

    // Count by category
    const categoryCounts: Record<string, number> = {};
    results.forEach((r) => {
      categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
    });

    res.json({
      query,
      count: results.length,
      categories: categoryCounts,
      results: results.slice(0, 20),
    });
  } catch (error) {
    logger.error('Search error:', error);
    res.status(500).json({ error: 'Suche fehlgeschlagen' });
  }
});
