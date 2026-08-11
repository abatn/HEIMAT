/**
 * search.ts — Universelle Suche über alle Services
 *
 * Ein einziges Suchfeld für ALLES:
 * - Ärzte (Overpass)
 * - Parkplätze (Overpass)
 * - E-Ladestationen (Overpass)
 * - Adressen (Nominatim)
 * - Events (Wikidata + OpenStreetMap)
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
import { EventService, Event } from '../services/eventService';
import { HotelService } from '../services/hotelService';
import { BuergeramtService } from '../services/buergeramtService';
import { healthService } from '../services/healthService';
import { jobService } from '../services/jobService';

export const searchRouter = Router();

// Module-level singletons (consistent with hotels.ts, buergeramt.ts patterns)
const parkingService = new ParkingService();
const evChargingService = new EvChargingService();
const eventService = new EventService();
const hotelService = new HotelService();
const buergeramtService = new BuergeramtService();

interface SearchResult {
  id: string;
  category: 'doctor' | 'parking' | 'ev_charging' | 'address' | 'event' | 'hotel' | 'buergeramt' | 'job';
  name: string;
  description: string;
  distance: number | null;
  lat: number | null;
  lng: number | null;
  relevance: number;
}

// Category detection from query (exportiert für Unit-Tests)
export function detectCategories(query: string): string[] {
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
  if (lower.match(/event|veranstaltung|konzert|festival|markt|museum|theater|kino|ausstellung/)) {
    categories.push('event');
  }
  if (lower.match(/hotel|hostel|pension|unterkunft|übernachtung/)) {
    categories.push('hotel');
  }
  if (lower.match(/bürgeramt|amt|behörde|verwaltung/)) {
    categories.push('buergeramt');
  }
  if (lower.match(/job|stelle|arbeit|karriere|firma/)) {
    categories.push('job');
  }
  if (lower.match(/straße|str\.|weg|platz|adresse/)) {
    categories.push('address');
  }

  // If no specific category detected, search all
  if (categories.length === 0) {
    categories.push('doctor', 'parking', 'ev_charging', 'event');
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

// Reine Kategorie-Begriffe (mit Wortgrenzen) — nur "arzt"/"praxis"/... sind
// reine Kategorie-Wörter und werden entfernt. Spezialisierungen wie
// "zahnarzt", "hautarzt" oder "augenarzt" enthalten zwar "arzt", sind aber
// echte Filter-Begriffe und bleiben erhalten.
export const doctorCategoryPattern = /^(arzt|ärzte|doktor|praxis|klinik|apotheke|gesundheit)$/i;

/**
 * Filtert Ärzte nach dem Suchbegriff, ignoriert aber reine Kategorie-Wörter
 * ("arzt", "praxis", ...), damit "arzt"-Suchen ALLE nahen Praxen liefern
 * statt 0 Ergebnisse. Spezifische Begriffe ("zahnarzt", "haut", "müller")
 * werden als UND-Filter angewendet. Exportiert für Unit-Tests (search.test.ts).
 */
export function filterDoctorsByQuery(
  doctors: Array<{ name?: string; specialty?: string; address?: string }>,
  query: string,
): Array<{ name?: string; specialty?: string; address?: string }> {
  const terms = query
    .split(/\s+/)
    .filter((term) => !doctorCategoryPattern.test(term))
    .map((term) => term.toLowerCase())
    .filter(Boolean);
  if (terms.length === 0) {
    return doctors;
  }
  return doctors.filter((d) => {
    const haystack = [d.name, d.specialty, d.address]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

// Search doctors via Overpass (same as healthService)
// Hinweis: Die Suche ist standort-anchored (lat/lng bestimmen den Umkreis).
// Ortsnamen im Query (z.B. "arzt münchen" an Berliner Koordinaten) werden
// als Filter-Text behandelt und können das Ergebnis ausdünnen — bekannte
// Limitation des Standort-basierten Designs.
async function searchDoctors(
  query: string,
  lat: number,
  lng: number,
): Promise<SearchResult[]> {
  try {
    const doctors = await healthService.getNearbyDoctors(lat, lng, 2000);
    const matching = filterDoctorsByQuery(doctors, query);
    return matching.slice(0, 5).map((d: any) => ({
      id: d.id || `doctor/${d.name}`,
      category: 'doctor' as const,
      name: d.name,
      description: d.specialty || 'Arzt',
      distance: d.distanceKm ?? null,
      lat: d.latitude,
      lng: d.longitude,
      relevance: 0.9,
    }));
  } catch (error) {
    logger.warn('Doctor search failed:', error);
    return [];
  }
}

// Search parking spots
async function searchParking(
  lat: number,
  lng: number,
): Promise<SearchResult[]> {
  try {
    const spots = await parkingService.getNearbySpots(lat, lng, 2);
    return spots.slice(0, 5).map((spot: any) => ({
      id: spot.id || `parking/${spot.name}`,
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

const eventOnlyPattern = /event|veranstaltung|konzert|festival|markt/i;

// Helper: Promise mit Timeout
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

// Search events from the existing Overpass service (Wikidata wikibase:around instabil)
async function searchEvents(
  query: string,
  lat: number,
  lng: number,
): Promise<SearchResult[]> {
  try {
    // 20s Timeout fuer Events (Overpass + Wikidata)
    const events = await withTimeout(eventService.getNearbyEvents(lat, lng, 10), 20000);
    const categoryQuery = eventOnlyPattern.test(query);
    const searchTerm = query
      .split(/\s+/)
      .filter((term) => !eventOnlyPattern.test(term))
      .join(' ')
      .trim()
      .toLowerCase();
    const matchingEvents = categoryQuery && !searchTerm
      ? events
      : events.filter((event) =>
          [event.name, event.description, event.category, event.location]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(searchTerm),
        );

    return matchingEvents.slice(0, 10).map((event: Event) => ({
      id: event.id,
      category: 'event' as const,
      name: event.name,
      description: event.description
        ? `${event.category} · ${event.description}`
        : event.category || 'Veranstaltung',
      distance: null,
      lat: event.lat,
      lng: event.lng,
      relevance: 0.7,
    }));
  } catch (error) {
    logger.warn('Event search failed:', (error as Error).message);
    return [];
  }
}

// Search EV charging stations
async function searchEvCharging(
  lat: number,
  lng: number,
): Promise<SearchResult[]> {
  try {
    const stations = await evChargingService.getNearbyStations(lat, lng, 5);
    return stations.slice(0, 5).map((station: any) => ({
      id: station.id || `ev/${station.name}`,
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

// Search hotels via Overpass
async function searchHotels(
  lat: number,
  lng: number,
): Promise<SearchResult[]> {
  try {
    const hotels = await hotelService.getNearbyHotels(lat, lng, 5);
    return hotels.slice(0, 5).map((hotel: any) => ({
      id: hotel.id || `hotel/${hotel.name}`,
      category: 'hotel' as const,
      name: hotel.name,
      description: `${hotel.type || 'Unterkunft'}${hotel.stars ? ` · ${hotel.stars} Sterne` : ''}`,
      distance: hotel.distance_km || null,
      lat: hotel.lat,
      lng: hotel.lng,
      relevance: 0.7,
    }));
  } catch (error) {
    logger.warn('Hotel search failed:', error);
    return [];
  }
}

// Search Bürgeramt via Nominatim
async function searchBuergeramt(
  lat: number,
  lng: number,
): Promise<SearchResult[]> {
  try {
    const aemter = await buergeramtService.getNearbyAemter(lat, lng, 5);
    return aemter.slice(0, 5).map((amt: any) => ({
      id: amt.id || `amt/${amt.name}`,
      category: 'buergeramt' as const,
      name: amt.name,
      description: amt.address || 'Bürgeramt',
      distance: amt.distance_km || null,
      lat: amt.lat,
      lng: amt.lng,
      relevance: 0.7,
    }));
  } catch (error) {
    logger.warn('Bürgeramt search failed:', error);
    return [];
  }
}

// Search jobs via Arbeitnow
async function searchJobs(
  query: string,
): Promise<SearchResult[]> {
  try {
    const result = await jobService.searchJobs(query, undefined, undefined, 0, 5);
    return (result.jobs || []).map((job: any) => ({
      id: job.id || `job/${job.title}`,
      category: 'job' as const,
      name: job.title,
      description: `${job.company || ''}${job.location ? ` · ${job.location}` : ''}`,
      distance: null,
      lat: null,
      lng: null,
      relevance: 0.7,
    }));
  } catch (error) {
    logger.warn('Job search failed:', error);
    return [];
  }
}

searchRouter.get('/', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    const latStr = req.query.lat as string;
    const lngStr = req.query.lng as string;
    if (!latStr || !lngStr || isNaN(parseFloat(latStr)) || isNaN(parseFloat(lngStr))) {
      return res.status(400).json({ error: 'lat und lng als Query-Parameter erforderlich' });
    }
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (!query.trim()) {
      return res.status(400).json({ error: 'Suchbegriff erforderlich (q=...)' });
    }

    logger.info(`Search: "${query}" at ${lat},${lng}`);

    const categories = detectCategories(query);
    const results: SearchResult[] = [];

    // Search in parallel — jedes mit eigenem Timeout (30s max gesamt)
    const SEARCH_TIMEOUT = 15000; // 15s pro Kategorie
    const searches = categories.map((cat) => {
      let promise: Promise<SearchResult[]>;
      switch (cat) {
        case 'doctor':
          promise = searchDoctors(query, lat, lng);
          break;
        case 'parking':
          promise = searchParking(lat, lng);
          break;
        case 'ev_charging':
          promise = searchEvCharging(lat, lng);
          break;
        case 'address':
          promise = searchAddresses(query, lat, lng);
          break;
        case 'event':
          promise = searchEvents(query, lat, lng);
          break;
        case 'hotel':
          promise = searchHotels(lat, lng);
          break;
        case 'buergeramt':
          promise = searchBuergeramt(lat, lng);
          break;
        case 'job':
          promise = searchJobs(query);
          break;
        default:
          promise = Promise.resolve([]);
      }
      return withTimeout(promise, SEARCH_TIMEOUT).catch(() => []);
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
