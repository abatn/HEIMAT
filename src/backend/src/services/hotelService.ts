/**
 * hotelService.ts — Hotels & Unterkünfte
 *
 * Datenquellen (Multi-Source mit Fallback-Pattern):
 * 1. OpenStreetMap Overpass — Hotels, Hostels, Motels (nwr = nodes+ways+relations)
 * 2. Wikidata SPARQL — Bekannte Hotels nahe Koordinaten
 *
 * Aenderung: Overpass sucht jetzt nwr (nicht nur node) — die meisten Hotels sind ways!
 * KEINE hardcoded URLs — alles via externalServices.
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { externalServices } from '../config/externalServices';

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
  // Alle URLs aus ExternalServicesRegistry — kein Hardcoded!
  private readonly overpassEndpoint = externalServices.overpassMirrors[0];
  private readonly wikidataEndpoint = externalServices.wikidataSparqlUrl;
  private readonly userAgent = externalServices.userAgent;

  /**
   * Hotels in der Nähe laden — Overpass + Wikidata parallel
   */
  async getNearbyHotels(
    lat: number,
    lng: number,
    radiusKm: number = 5,
  ): Promise<Hotel[]> {
    const results = await Promise.allSettled([
      this.fetchOverpassHotels(lat, lng, radiusKm),
      this.fetchWikidataHotels(lat, lng, radiusKm),
    ]);

    const hotels: Hotel[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        hotels.push(...result.value);
      } else {
        logger.warn('Hotels source failed:', result.reason);
      }
    }

    // Deduplizieren nach Name + Koordinaten
    const seen = new Set<string>();
    const unique = hotels.filter((h) => {
      const key = `${h.name?.toLowerCase()}_${h.lat?.toFixed(3)}_${h.lng?.toFixed(3)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Nach Entfernung sortieren
    unique.sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999));

    return unique.slice(0, 30);
  }

  /**
   * OpenStreetMap Overpass — Hotels, Hostels, Motels, Pensionen
   * WICHTIG: nwr (nodes + ways + relations) statt nur node!
   */
  private async fetchOverpassHotels(
    lat: number,
    lng: number,
    radiusKm: number,
  ): Promise<Hotel[]> {
    const radiusM = radiusKm * 1000;

    const query = `
      [out:json][timeout:20];
      (
        nwr["tourism"="hotel"](around:${radiusM},${lat},${lng});
        nwr["tourism"="hostel"](around:${radiusM},${lat},${lng});
        nwr["tourism"="motel"](around:${radiusM},${lat},${lng});
        nwr["tourism"="guest_house"](around:${radiusM},${lat},${lng});
        nwr["tourism"="apartment"](around:${radiusM},${lat},${lng});
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

      return elements
        .filter((el: any) => el.type === 'node' || el.center)
        .map((el: any) => {
          const lat2 = el.lat || el.center?.lat;
          const lng2 = el.lon || el.center?.lon;
          return {
            id: `osm/${el.id}`,
            name: el.tags?.name || el.tags?.['name:de'] || _getTypeLabel(el.tags),
            type: _getTypeLabel(el.tags),
            stars: el.tags?.stars ? parseInt(el.tags.stars) : null,
            address: _buildAddress(el.tags),
            phone: el.tags?.phone || el.tags?.['contact:phone'] || null,
            website: el.tags?.website || el.tags?.['contact:website'] || null,
            lat: lat2,
            lng: lng2,
            distance_km: _haversineKm(lat, lng, lat2, lng2),
            openingHours: el.tags?.opening_hours || null,
          };
        });
    } catch (error) {
      logger.warn('Overpass hotels failed:', (error as Error).message);
      return [];
    }
  }

  /**
   * Wikidata SPARQL — Bekannte Hotels nahe Koordinaten
   */
  private async fetchWikidataHotels(
    lat: number,
    lng: number,
    radiusKm: number,
  ): Promise<Hotel[]> {
    const query = `
      SELECT ?place ?placeLabel ?location ?dist ?addressLabel ?phone ?website ?stars
      WHERE {
        SERVICE wikibase:around {
          ?place wdt:P625 ?location .
          bd:serviceParam wikibase:center "Point(${lng} ${lat})"^^geo:wktLiteral .
          bd:serviceParam wikibase:radius "${radiusKm}" .
          bd:serviceParam wikibase:distance ?dist .
        }
        { ?place wdt:P31/wdt:P279* wd:Q27686 . }
        UNION
        { ?place wdt:P31/wdt:P279* wd:Q3957 . }
        UNION
        { ?place wdt:P31/wdt:P279* wd:Q44613 . }
        OPTIONAL { ?place wdt:P969 ?address . }
        OPTIONAL { ?place wdt:P1329 ?phone . }
        OPTIONAL { ?place wdt:P856 ?website . }
        OPTIONAL { ?place wdt:P296 ?stars . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en" . }
      }
      ORDER BY ASC(?dist)
      LIMIT 20
    `;

    try {
      const response = await axios.get(this.wikidataEndpoint, {
        params: { query, format: 'json' },
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
        timeout: 20000,
      });

      const results = response.data?.results?.bindings || [];

      return results.map((binding: any) => {
        const coordMatch = binding.location?.value?.match(
          /Point\(([-\d.]+)\s+([-\d.]+)\)/,
        );
        const lng2 = coordMatch ? parseFloat(coordMatch[1]) : 0;
        const lat2 = coordMatch ? parseFloat(coordMatch[2]) : 0;

        return {
          id: `wikidata/${binding.place?.value?.split('/')?.pop() || Math.random()}`,
          name: binding.placeLabel?.value || 'Hotel',
          type: 'Hotel',
          stars: binding.stars?.value ? parseInt(binding.stars.value) : null,
          address: binding.addressLabel?.value || null,
          phone: binding.phone?.value || null,
          website: binding.website?.value || null,
          lat: lat2,
          lng: lng2,
          distance_km: binding.dist?.value ? parseFloat(binding.dist.value) : _haversineKm(lat, lng, lat2, lng2),
          openingHours: null,
        };
      });
    } catch (error) {
      logger.warn('Wikidata SPARQL hotels failed:', (error as Error).message);
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
    case 'apartment':
      return 'Ferienwohnung';
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
  return Math.round(R * c * 10) / 10;
}
