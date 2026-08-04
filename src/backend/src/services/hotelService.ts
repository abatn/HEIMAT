/**
 * hotelService.ts — Hotels & Unterkünfte
 *
 * Datenquelle: OpenStreetMap Overpass
 * KEINE hardcodierten Seiten — alles echte API-Calls.
 *
 * OSM-Tags für Hotels:
 * - tourism=hotel
 * - tourism=hostel
 * - tourism=motel
 * - tourism=guest_house
 * - tourism=apartment
 */

import axios from 'axios';
import { logger } from '../utils/logger';

export interface Hotel {
  id: string;
  name: string;
  type: string;
  stars: number | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  lat: number;
  lng: number;
  distance_km: number | null;
  openingHours: string | null;
}

export class HotelService {
  private readonly overpassEndpoint = 'https://overpass-api.de/api/interpreter';

  /**
   * Hotels in der Nähe laden
   */
  async getNearbyHotels(
    lat: number,
    lng: number,
    radiusKm: number = 5,
  ): Promise<Hotel[]> {
    const radiusM = radiusKm * 1000;

    const query = `
      [out:json][timeout:15];
      (
        node["tourism"="hotel"](around:${radiusM},${lat},${lng});
        node["tourism"="hostel"](around:${radiusM},${lat},${lng});
        node["tourism"="motel"](around:${radiusM},${lat},${lng});
        node["tourism"="guest_house"](around:${radiusM},${lat},${lng});
      );
      out body;
    `;

    try {
      const response = await axios.post(
        this.overpassEndpoint,
        `data=${encodeURIComponent(query)}`,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 15000,
        },
      );

      const elements = response.data?.elements || [];

      return elements.map((el: any) => ({
        id: `osm/${el.id}`,
        name: el.tags?.name || el.tags?.['name:de'] || _getTypeLabel(el.tags),
        type: _getTypeLabel(el.tags),
        stars: el.tags?.stars ? parseInt(el.tags.stars) : null,
        address: _buildAddress(el.tags),
        phone: el.tags?.phone || el.tags?.['contact:phone'] || null,
        website: el.tags?.website || el.tags?.['contact:website'] || null,
        lat: el.lat,
        lng: el.lon,
        distance_km: _haversineKm(lat, lng, el.lat, el.lon),
        openingHours: el.tags?.opening_hours || null,
      }));
    } catch (error) {
      logger.warn('Overpass hotels failed:', error);
      return [];
    }
  }
}

function _getTypeLabel(tags: Record<string, string>): string {
  switch (tags.tourism) {
    case 'hotel':
      return 'Hotel';
    case 'hostel':
      return 'Hostel';
    case 'motel':
      return 'Motel';
    case 'guest_house':
      return 'Gästehaus';
    default:
      return 'Unterkunft';
  }
}

function _buildAddress(tags: Record<string, string>): string | null {
  const parts: string[] = [];
  if (tags['addr:street']) parts.push(tags['addr:street']);
  if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
  if (tags['addr:postcode']) parts.push(tags['addr:postcode']);
  if (tags['addr:city']) parts.push(tags['addr:city']);
  return parts.length > 0 ? parts.join(', ') : null;
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
