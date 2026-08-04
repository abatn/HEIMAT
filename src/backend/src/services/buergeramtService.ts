/**
 * buergeramtService.ts — Bürgerämter & Behörden
 *
 * Datenquelle: OpenStreetMap Overpass — echte deutsche Behörden
 * Tags: amenity=townhall, office=government, office=admin
 *
 * KEINE hardcoded URLs — alles via externalServices.overpassMirrors.
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { externalServices } from '../config/externalServices';

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
  // Kein Hardcoded — Overpass via ExternalServicesRegistry
  private readonly overpassEndpoint = externalServices.overpassMirrors[0];
  private readonly userAgent = externalServices.userAgent;

  /**
   * Bürgerämter & Behörden in der Nähe laden
   * Overpass-Suche: amenity=townhall + office=government + office=admin
   */
  async getNearbyAemter(
    lat: number,
    lng: number,
    radiusKm: number = 10,
  ): Promise<Buergeramt[]> {
    const radiusM = radiusKm * 1000;

    // Overpass QL: alle Behörden-Typen parallel suchen
    const query = `
      [out:json][timeout:20];
      (
        node["amenity"="townhall"](around:${radiusM},${lat},${lng});
        way["amenity"="townhall"](around:${radiusM},${lat},${lng});
        node["office"="government"](around:${radiusM},${lat},${lng});
        way["office"="government"](around:${radiusM},${lat},${lng});
        node["office"="admin"](around:${radiusM},${lat},${lng});
        way["office"="admin"](around:${radiusM},${lat},${lng});
      );
      out body;
      >;
      out skel qt;
    `;

    try {
      const response = await axios.post(
        this.overpassEndpoint,
        `data=${encodeURIComponent(query)}`,
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 20000,
        },
      );

      const elements = response.data?.elements || [];

      // Nur Elemente mit Namen (echte Behörden)
      return elements
        .filter((el: any) => el.tags?.name && (el.type === 'node' || el.center))
        .map((el: any) => {
          const lat2 = el.lat || el.center?.lat;
          const lng2 = el.lon || el.center?.lon;
          return {
            id: `osm/${el.id}`,
            name: el.tags.name,
            type: _detectType(el.tags),
            address: _buildAddress(el.tags),
            phone: el.tags?.phone || el.tags?.['contact:phone'] || null,
            website: el.tags?.website || el.tags?.['contact:website'] || null,
            lat: lat2,
            lng: lng2,
            distance_km: _haversineKm(lat, lng, lat2, lng2),
            openingHours: el.tags?.opening_hours || null,
          };
        })
        .sort((a: Buergeramt, b: Buergeramt) =>
          (a.distance_km ?? 999) - (b.distance_km ?? 999),
        )
        .slice(0, 20);
    } catch (error) {
      logger.warn('Overpass Bürgeramt search failed:', (error as Error).message);
      return [];
    }
  }
}

function _detectType(tags: Record<string, string>): string {
  const amenity = tags.amenity || '';
  const office = tags.office || '';
  const name = (tags.name || '').toLowerCase();

  if (name.includes('bürgeramt') || name.includes('buergeramt')) return 'Bürgeramt';
  if (name.includes('rathaus')) return 'Rathaus';
  if (name.includes('standesamt')) return 'Standesamt';
  if (name.includes('meldeamt')) return 'Meldeamt';
  if (name.includes('verwaltungsamt') || name.includes('verwaltung')) return 'Verwaltungsamt';
  if (name.includes('finanzamt')) return 'Finanzamt';
  if (name.includes('jobcenter')) return 'Jobcenter';
  if (name.includes('sozialamt')) return 'Sozialamt';
  if (amenity === 'townhall') return 'Rathaus';
  if (office === 'government') return 'Behörde';
  if (office === 'admin') return 'Verwaltung';
  return 'Behörde';
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
  return Math.round(R * c * 10) / 10;
}
