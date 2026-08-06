/**
 * searchEvents.test.ts — echte Integration der Event-Suche
 *
 * Der Test spricht den laufenden Backend-Server und damit die echten
 * Wikidata-/OpenStreetMap-Quellen des EventService an. Keine Mocks.
 */

import axios from 'axios';
import { TIMEOUTS, withRetry } from '../utils/test-utils';

const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';
const query = process.env.LIVE_SEARCH_QUERY;
const lat = Number(process.env.LIVE_SEARCH_LAT);
const lng = Number(process.env.LIVE_SEARCH_LNG);
const hasLiveConfiguration = Boolean(query?.trim()) && Number.isFinite(lat) && Number.isFinite(lng);
const describeLive = hasLiveConfiguration ? describe : describe.skip;

describeLive('Universal search: events', () => {
  jest.setTimeout(60000);  it('returns the event-search contract for a real location', async () => {
    const response = await withRetry(
        () =>
        axios.get(`${baseUrl}/api/search`, {
          params: {
            q: query,
            lat,
            lng,

          },
          timeout: TIMEOUTS.overpass,
        }),
      { retries: 2, timeoutMs: TIMEOUTS.overpass },
    );

    expect(response.status).toBe(200);
    expect(response.data.query).toBe(query);
    expect(typeof response.data.count).toBe('number');
    expect(response.data).toHaveProperty('categories');
    expect(Array.isArray(response.data.results)).toBe(true);
    expect(response.data.count).toBeGreaterThan(0);

    for (const result of response.data.results) {
      expect(result.category).toBe('event');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
    }
  });

  it('uses a concrete event term to filter real results', async () => {
    const response = await withRetry(
      () =>
        axios.get(`${baseUrl}/api/search`, {
          params: {
            q: 'Museum',
            lat,
            lng,
          },
          timeout: TIMEOUTS.overpass,
        }),
      { retries: 2, timeoutMs: TIMEOUTS.overpass },
    );

    expect(response.status).toBe(200);
    expect(response.data.count).toBeGreaterThan(0);
    expect(response.data.results.every((result: {
      name: string;
      description: string;
      category: string;
      location: string | null;
    }) =>
      `${result.name} ${result.description} ${result.category} ${result.location ?? ''}`
        .toLowerCase()
        .includes('museum'),
    )).toBe(true);
  });
});
