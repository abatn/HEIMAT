import { buildVerificationPlan } from '../scripts/verify-services';

describe('verify-services plan', () => {
  const targets = buildVerificationPlan(
    'https://heimat-backend.onrender.com',
    50.11,
    8.68,
    'software',
    'Museum',
    {
      weatherRadiusKm: 1,
      airRadiusKm: 1,
      wasteWeeks: 4,
      evChargingRadiusKm: 5,
      parkingRadiusKm: 2,
      eventsRadiusKm: 10,
      hotelsRadiusKm: 5,
      buergeramtRadiusKm: 10,
    },
  );

  it('uses the real app endpoints and caller-provided location', () => {
    expect(targets.map((target) => target.service)).toEqual([
      'weather',
      'air-quality',
      'waste',
      'ev-charging',
      'parking',
      'events',
      'hotels',
      'buergeramt',
      'jobs',
      'universal-event-search',
    ]);
    expect(targets.filter((target) => target.service !== 'jobs')
      .every((target) => target.endpoint.includes('50.11'))).toBe(true);
    expect(targets.filter((target) => target.service !== 'jobs')
      .every((target) => target.endpoint.includes('8.68'))).toBe(true);
    expect(targets.find((target) => target.service === 'ev-charging')?.endpoint)
      .toContain('/api/ev-charging/stations');
    expect(targets.find((target) => target.service === 'parking')?.endpoint)
      .toContain('/api/parking/spots');
    expect(targets.find((target) => target.service === 'universal-event-search')?.endpoint)
      .toContain('q=Museum');
  });

  it('does not silently classify unsupported waste locations as a code failure', () => {
    const waste = targets.find((target) => target.service === 'waste');
    expect(waste).toBeDefined();
    expect(waste!.validate({
      status: 'error',
      code: 'CITY_NOT_SUPPORTED',
    })).toEqual({
      state: 'degraded',
      detail: 'waste: location has no supported municipal source',
    });
  });

  it('requires real event results for universal event search', () => {
    const search = targets.find((target) => target.service === 'universal-event-search');
    expect(search).toBeDefined();
    expect(search!.validate({
      count: 1,
      results: [{ category: 'parking', name: 'Parkplatz' }],
    }).state).toBe('fail');
    expect(search!.validate({
      count: 1,
      results: [{ category: 'event', id: 'osm/1', name: 'Museum' }],
    })).toEqual({
      state: 'pass',
      detail: 'universal-event-search: 1 real event results',
    });
  });
});
