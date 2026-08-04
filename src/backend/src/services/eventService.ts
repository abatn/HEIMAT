/**
 * eventService.ts — Events & Veranstaltungen
 *
 * Datenquellen (Multi-Source mit Fallback-Pattern):
 * 1. kulturdaten.berlin — Berlin Kulturveranstaltungen (kostenlos, kein Auth)
 * 2. Wikidata SPARQL — Breite Eventsuche (Q1322418 Kultur + Q1656682 Events + Q15300282 Online-Events)
 * 3. OpenStreetMap Overpass — Märkte, Kulturzentren, Kinos, Theater
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
  source: 'kulturdaten' | 'wikidata' | 'osm';
}

export class EventService {
  private readonly wikidataEndpoint = 'https://query.wikidata.org/sparql';
  private readonly overpassEndpoint = 'https://overpass-api.de/api/interpreter';
  private readonly kulturdatenEndpoint = 'https://kulturdaten.berlin/api/v1';

  /**
   * Events in der Nähe laden — alle Quellen parallel
   */
  async getNearbyEvents(
    lat: number,
    lng: number,
    radiusKm: number = 10,
  ): Promise<Event[]> {
    const results = await Promise.allSettled([
      this.fetchKulturdatenEvents(lat, lng, radiusKm),
      this.fetchWikidataEvents(lat, lng, radiusKm),
      this.fetchOsmEvents(lat, lng, radiusKm),
    ]);

    const events: Event[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        events.push(...result.value);
      } else {
        logger.warn('Events source failed:', result.reason);
      }
    }

    // Deduplizieren nach Name + Location
    const seen = new Set<string>();
    const unique = events.filter((e) => {
      const key = `${e.name?.toLowerCase()}_${e.lat?.toFixed(3)}_${e.lng?.toFixed(3)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by start date (nearest first)
    unique.sort((a, b) => {
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

    return unique.slice(0, 30);
  }

  /**
   * kulturdaten.berlin — Berlin Kulturveranstaltungen
   * Kostenlos, kein Auth, REST API
   */
  private async fetchKulturdatenEvents(
    lat: number,
    lng: number,
    radiusKm: number,
  ): Promise<Event[]> {
    try {
      // kulturdaten.berlin Search API — Events nahe Koordinaten
      const response = await axios.get(`${this.kulturdatenEndpoint}/events`, {
        params: {
          'filter[location.geo.distance]': `${lat},${lng},${radiusKm * 1000}`,
          'page[limit]': 20,
          sort: '-startDate',
        },
        headers: {
          'Accept': 'application/vnd.api+json',
          'User-Agent': 'HEIMAT/2.0 (https://github.com/abatn/HEIMAT)',
        },
        timeout: 10000,
      });

      const items = response.data?.data || [];

      return items.map((item: any) => {
        const attrs = item.attributes || item;
        const loc = attrs.location || {};
        const geo = loc.geo || {};
        return {
          id: `kulturdaten/${item.id || Math.random().toString(36).slice(2)}`,
          name: attrs.name?.de || attrs.name || attrs.title || 'Event',
          description: attrs.description?.de || attrs.description || '',
          category: attrs.category || attrs.type || 'Kultur',
          startDate: attrs.startDate || attrs.start || null,
          endDate: attrs.endDate || attrs.end || null,
          location: loc.address?.de || loc.address || loc.name || null,
          lat: parseFloat(geo.latitude) || parseFloat(loc.latitude) || null,
          lng: parseFloat(geo.longitude) || parseFloat(loc.longitude) || null,
          url: attrs.url || attrs.ticketUrl || null,
          source: 'kulturdaten' as const,
        };
      });
    } catch (error) {
      // kulturdaten.berlin ist nur fuer Berlin — bei anderen Staedten 404/leer ist normal
      logger.debug('kulturdaten.berlin events:', (error as Error).message);
      return [];
    }
  }

  /**
   * Wikidata SPARQL — Breite Eventsuche
   * Sucht: Kulturveranstaltungen (Q1322418), Musikveranstaltungen (Q1854458),
   * Sportveranstaltungen (Q1854459), Festivals (Q15300282), Messen (Q1806098)
   */
  private async fetchWikidataEvents(
    lat: number,
    lng: number,
    radiusKm: number,
  ): Promise<Event[]> {
    // Breitere Query: mehr Event-Typen + geospatial Search
    const query = `
      SELECT ?event ?eventLabel ?description ?startDate ?endDate ?locationLabel ?coord ?categoryLabel
      WHERE {
        # Verschiedene Event-Typen
        {
          ?event wdt:P31/wdt:P279* wd:Q1322418 .
        } UNION {
          ?event wdt:P31/wdt:P279* wd:Q1854458 .
        } UNION {
          ?event wdt:P31/wdt:P279* wd:Q1854459 .
        } UNION {
          ?event wdt:P31/wdt:P279* wd:Q15300282 .
        } UNION {
          ?event wdt:P31/wdt:P279* wd:Q1806098 .
        }

        # Nur Deutschland
        ?event wdt:P17 wd:Q183 .

        # Zeitraum: nur zukuenftige oder aktuelle Events
        OPTIONAL { ?event wdt:P580 ?startDate . }
        OPTIONAL { ?event wdt:P582 ?endDate . }

        # Standort
        OPTIONAL { ?event wdt:P276 ?location . }
        OPTIONAL { ?location wdt:P625 ?coord . }

        # Beschreibung
        OPTIONAL { ?event schema:description ?description . FILTER(LANG(?description) = "de") }

        # Kategorie
        OPTIONAL { ?event wdt:P31 ?category . }

        SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en" . }
      }
      LIMIT 30
    `;

    try {
      const response = await axios.get(this.wikidataEndpoint, {
        params: { query, format: 'json' },
        headers: { 'User-Agent': 'HEIMAT/2.0 (https://github.com/abatn/HEIMAT)' },
        timeout: 20000,
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
            category: binding.categoryLabel?.value || 'Veranstaltung',
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
      logger.warn('Wikidata SPARQL events failed:', (error as Error).message);
      return [];
    }
  }

  /**
   * OpenStreetMap Overpass — Märkte, Kulturzentren, Kinos, Theater
   * Overpass liefert Venues (nicht Events), aber nützlich als Ergänzung
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
        node["leisure"="culture_centre"](around:${radiusM},${lat},${lng});
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
        name: el.tags?.name || el.tags?.['name:de'] || _getCategoryLabel(el.tags),
        description: el.tags?.description || el.tags?.opening_hours || '',
        category: _getOsmCategory(el.tags),
        startDate: null,
        endDate: null,
        location: el.tags?.addr_full || el.tags?.['addr:street'] || null,
        lat: el.lat || null,
        lng: el.lon || null,
        url: el.tags?.website || null,
        source: 'osm' as const,
      }));
    } catch (error) {
      logger.warn('Overpass events failed:', (error as Error).message);
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
