/**
 * buergeramtService.ts — Bürgerämter & Behörden
 *
 * Datenquelle: OpenStreetMap Nominatim
 * KEINE hardcodierten Seiten — alles echte API-Calls.
 *
 * OSM-Tags für Bürgerämter:
 * - amenity=townhall
 * - office=government
 * - office=public_bath
 * - amenity=community_centre + government
 */

import axios from 'axios';
import { logger } from '../utils/logger';

export interface Buergeramt {
  id: string;
  name: string;
  type: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  lat: number;
  lng: number;
  distance_km: number | null;
  openingHours: string | null;
}

export class BuergeramtService {
  private readonly nominatimEndpoint = 'https://nominatim.openstreetmap.org';

  /**
   * Bürgerämter in der Nähe laden
   */
  async getNearbyAemter(
    lat: number,
    lng: number,
    radiusKm: number = 10,
  ): Promise<Buergeramt[]> {
    try {
      // Search for government buildings near coordinates
      const response = await axios.get(
        `${this.nominatimEndpoint}/search`,
        {
          params: {
            q: 'Bürgeramt',
            format: 'json',
            limit: 10,
            viewbox: `${lng - 0.1},${lat + 0.1},${lng + 0.1},${lat - 0.1}`,
            bounded: 1,
          },
          headers: { 'User-Agent': 'HEIMAT/2.0 (https://github.com/abatn/HEIMAT)' },
          timeout: 10000,
        },
      );

      const results = response.data || [];

      // Also search for "Rathaus" and "Amt"
      const [rathaus, amt] = await Promise.allSettled([
        axios.get(`${this.nominatimEndpoint}/search`, {
          params: {
            q: 'Rathaus',
            format: 'json',
            limit: 5,
            viewbox: `${lng - 0.1},${lat + 0.1},${lng + 0.1},${lat - 0.1}`,
            bounded: 1,
          },
          headers: { 'User-Agent': 'HEIMAT/2.0' },
          timeout: 10000,
        }),
        axios.get(`${this.nominatimEndpoint}/search`, {
          params: {
            q: 'Verwaltungsamt',
            format: 'json',
            limit: 5,
            viewbox: `${lng - 0.1},${lat + 0.1},${lng + 0.1},${lat - 0.1}`,
            bounded: 1,
          },
          headers: { 'User-Agent': 'HEIMAT/2.0' },
          timeout: 10000,
        }),
      ]);

      if (rathaus.status === 'fulfilled') {
        results.push(...(rathaus.value.data || []));
      }
      if (amt.status === 'fulfilled') {
        results.push(...(amt.value.data || []));
      }

      // Deduplicate by place_id
      const seen = new Set<number>();
      const unique = results.filter((item: any) => {
        if (seen.has(item.place_id)) return false;
        seen.add(item.place_id);
        return true;
      });

      return unique.map((item: any) => ({
        id: `nominatim/${item.place_id}`,
        name: item.display_name?.split(',')[0] || 'Bürgeramt',
        type: _detectType(item.display_name || ''),
        address: item.display_name || null,
        phone: null,
        website: null,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        distance_km: _haversineKm(lat, lng, parseFloat(item.lat), parseFloat(item.lon)),
        openingHours: null,
      }));
    } catch (error) {
      logger.warn('Nominatim Bürgeramt search failed:', error);
      return [];
    }
  }
}

function _detectType(displayName: string): string {
  const lower = displayName.toLowerCase();
  if (lower.includes('bürgeramt')) return 'Bürgeramt';
  if (lower.includes('rathaus')) return 'Rathaus';
  if (lower.includes('verwaltungsamt')) return 'Verwaltungsamt';
  if (lower.includes('meldeamt')) return 'Meldeamt';
  if (lower.includes('standesamt')) return 'Standesamt';
  return 'Behörde';
}

function _haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
