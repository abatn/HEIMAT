import { buildWikidataEventsQuery } from '../services/eventService';

describe('Wikidata event query', () => {
  it('uses CONTAINS filter for geo (wikibase:around instabil)', () => {
    const query = buildWikidataEventsQuery(50.11, 8.68, 10);

    // Nutzt CONTAINS statt wikibase:around (GeoService instabil auf query.wikidata.org)
    expect(query).toContain('FILTER(CONTAINS(STR(?coord),');
    expect(query).toContain('Point(8.68');
    expect(query).toContain('?location wdt:P625 ?coord .');
    expect(query).toContain('?event wdt:P276 ?location .');
  });

  it('does not use an unbounded event query', () => {
    const query = buildWikidataEventsQuery(52.52, 13.41, 5);

    expect(query).not.toContain('OPTIONAL { ?event wdt:P276 ?location . }');
    expect(query).not.toContain('OPTIONAL { ?location wdt:P625 ?coord . }');
    expect(query).not.toContain('wdt:P17 wd:Q183');
    expect(query).toContain('FILTER(CONTAINS(STR(?coord),');
  });

  it.each([
    [Number.NaN, 8.68, 10],
    [50.11, Number.POSITIVE_INFINITY, 10],
    [91, 8.68, 10],
    [50.11, 8.68, 0],
    [50.11, 8.68, -1],
  ])('rejects invalid geospatial input: %p, %p, %p', (lat, lng, radiusKm) => {
    expect(() => buildWikidataEventsQuery(lat, lng, radiusKm)).toThrow(RangeError);
  });
});
