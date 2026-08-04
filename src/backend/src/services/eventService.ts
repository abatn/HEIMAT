/**
 * eventService.ts — Events & Veranstaltungen
 *
 * Datenquellen:
 * - Wikidata SPARQL: Kulturveranstaltungen, Konzerte, Theater, Festivals
 * - OpenStreetMap Overpass: Lokale Events, Marktveranstaltungen
 *
 * KEINE hardcodierten Seiten — alles echte API-Calls.
 */

import axios from 'axios';
import { logger } from '../utils/logger';

export interface Event {
  id: string;
  name: string;
  description: string;
  category: string;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  url: string | null;
  source: 'wikidata' | 'osm';
}

export class EventService {
  private readonly wikidataEndpoint = 'https://query.wikidata.org/sparql';
  private readonly overpassEndpoint = 'https://overpass-api.de/api/interpreter';

  /**
   * Events in der Nähe laden — Wikidata + OSM parallel
   */
  async getNearbyEvents(
    lat: number,
    lng: number,
    radiusKm: number = 10,
  ): Promise<Event[]> {
    const [wikidataEvents, osmEvents] = await Promise.allSettled([
      this.fetchWikidataEvents(lat, lng, radiusKm),
      this.fetchOsmEvents(lat, lng, radiusKm),
    ]);

    const events: Event[] = [];

    if (wikidataEvents.status === 'fulfilled') {
      events.push(...wikidataEvents.value);
    } else {
      logger.warn('Wikidata events failed:', wikidataEvents.reason);
    }

    if (osmEvents.status === 'fulfilled') {
      events.push(...osmEvents.value);
    } else {
      logger.warn('OSM events failed:', osmEvents.reason);
    }

    // Sort by start date (nearest first)
    events.sort((a, b) => {
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

    return events.slice(0, 20);
  }

  /**
   * Wikidata SPARQL — Kulturveranstaltungen
   */
  private async fetchWikidataEvents(
    lat: number,
    lng: number,
    radiusKm: number,
  ): Promise<Event[]> {
    // SPARQL query for cultural events near coordinates
    const query = `
      SELECT ?event ?eventLabel ?description ?startDate ?endDate ?locationLabel ?coord
      WHERE {
        ?event wdt:P31/wdt:P279* wd:Q1322418 .
        ?event wdt:P17 wd:Q183 .
        OPTIONAL { ?event wdt:P580 ?startDate . }
        OPTIONAL { ?event wdt:P582 ?endDate . }
        OPTIONAL { ?event wdt:P276 ?location . }
        OPTIONAL { ?location wdt:P625 ?coord . }
        OPTIONAL { ?event schema:description ?description . FILTER(LANG(?description) = "de") }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en" . }
      }
      LIMIT 20
    `;

    try {
      const response = await axios.get(this.wikidataEndpoint, {
        params: { query, format: 'json' },
        headers: { 'User-Agent': 'HEIMAT/2.0 (https://github.com/abatn/HEIMAT)' },
        timeout: 15000,
      });

      const results = response.data?.results?.bindings || [];

      return results
        .map((binding: any) => {
          const coordMatch = binding.coord?.value?.match(
            /Point\(([-\d.]+)\s+([-\d.]+)\)/,
          );
          return {
            id: `wikidata/${binding.event?.value?.split('/')?.pop() || Math.random()}`,
            name: binding.eventLabel?.value || 'Event',
            description: binding.description?.value || '',
            category: 'Kultur',
            startDate: binding.startDate?.value || null,
            endDate: binding.endDate?.value || null,
            location: binding.locationLabel?.value || null,
            lat: coordMatch ? parseFloat(coordMatch[2]) : null,
            lng: coordMatch ? parseFloat(coordMatch[1]) : null,
            url: binding.event?.value || null,
            source: 'wikidata' as const,
          };
        })
        .filter((e: Event) => e.name !== 'Event');
    } catch (error) {
      logger.warn('Wikidata SPARQL failed:', error);
      return [];
    }
  }

  /**
   * OpenStreetMap Overpass — Lokale Events & Marktveranstaltungen
   */
  private async fetchOsmEvents(
    lat: number,
    lng: number,
    radiusKm: number,
  ): Promise<Event[]> {
    const radiusM = radiusKm * 1000;

    const query = `
      [out:json][timeout:15];
      (
        node["amenity"="marketplace"](around:${radiusM},${lat},${lng});
        node["tourism"="museum"](around:${radiusM},${lat},${lng});
        node["amenity"="arts_centre"](around:${radiusM},${lat},${lng});
        node["amenity"="cinema"](around:${radiusM},${lat},${lng});
        node["amenity"="theatre"](around:${radiusM},${lat},${lng});
      );
      out body;
    `;

    try {
      const response = await axios.post(this.overpassEndpoint, `data=${encodeURIComponent(query)}`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      });

      const elements = response.data?.elements || [];

      return elements.map((el: any) => ({
        id: `osm/${el.id}`,
        name: el.tags?.name || el.tags?.['name:de'] || _getCategoryLabel(el.tags),
        description: el.tags?.description || el.tags?.opening_hours || '',
        category: _getOsmCategory(el.tags),
        startDate: null,
        endDate: null,
        location: el.tags?.addr_full || el.tags?.['addr:street'] || null,
        lat: el.lat || null,
        lng: el.lon || null,
        url: null,
        source: 'osm' as const,
      }));
    } catch (error) {
      logger.warn('Overpass events failed:', error);
      return [];
    }
  }
}

function _getCategoryLabel(tags: Record<string, string>): string {
  if (tags.amenity === 'marketplace') return 'Markt';
  if (tags.tourism === 'museum') return 'Museum';
  if (tags.amenity === 'arts_centre') return 'Kulturzentrum';
  if (tags.amenity === 'cinema') return 'Kino';
  if (tags.amenity === 'theatre') return 'Theater';
  return 'Veranstaltung';
}

function _getOsmCategory(tags: Record<string, string>): string {
  if (tags.amenity === 'marketplace') return 'Markt';
  if (tags.tourism === 'museum') return 'Museum';
  if (tags.amenity === 'arts_centre') return 'Kultur';
  if (tags.amenity === 'cinema') return 'Kino';
  if (tags.amenity === 'theatre') return 'Theater';
  return 'Veranstaltung';
}
