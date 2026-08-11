/**
 * search.test.ts — Universelle Suche (8 Kategorien)
 *
 * Teil 1: Deterministische Unit-Tests für die puren Logik-Funktionen
 *         (detectCategories, filterDoctorsByQuery) — keine externen Calls.
 * Teil 2: Live-Integrationstests der Route /api/search mit echten Daten
 *         (Overpass, Nominatim, Wikidata, Adzuna/Arbeitnow). Keine Mocks.
 */

import request from 'supertest';
import app from '../index';
import {
  detectCategories,
  filterDoctorsByQuery,
  doctorCategoryPattern,
} from '../routes/search';
import { withRetry, isAcceptableStatus, TIMEOUTS } from '../utils/test-utils';

jest.setTimeout(120_000);

const BERLIN = { lat: 52.52, lng: 13.405 };

// ---------------------------------------------------------------------------
// Unit-Tests: detectCategories
// ---------------------------------------------------------------------------

describe('detectCategories', () => {
  it('detects doctor category from "arzt"', () => {
    expect(detectCategories('arzt in berlin')).toContain('doctor');
  });

  it('detects doctor category from "zahnarzt"', () => {
    expect(detectCategories('zahnarzt')).toContain('doctor');
  });

  it('detects parking category', () => {
    expect(detectCategories('parken berlin')).toContain('parking');
  });

  it('detects ev_charging category', () => {
    expect(detectCategories('ladestation')).toContain('ev_charging');
  });

  it('detects event category', () => {
    expect(detectCategories('veranstaltung berlin')).toContain('event');
  });

  it('detects hotel category', () => {
    expect(detectCategories('hotel berlin')).toContain('hotel');
  });

  it('detects buergeramt category', () => {
    expect(detectCategories('bürgeramt')).toContain('buergeramt');
  });

  it('detects job category', () => {
    expect(detectCategories('job entwickler')).toContain('job');
  });

  it('detects address category', () => {
    expect(detectCategories('alexanderplatz straße')).toContain('address');
  });

  it('falls back to generic categories when no keyword matches', () => {
    const categories = detectCategories('irgendetwas ganz beliebiges');
    expect(categories).toContain('doctor');
    expect(categories).toContain('parking');
  });
});

// ---------------------------------------------------------------------------
// Unit-Tests: filterDoctorsByQuery
// ---------------------------------------------------------------------------

describe('filterDoctorsByQuery', () => {
  const doctors = [
    { name: 'Praxis Dr. Müller', specialty: 'Allgemeinmedizin', address: 'Hauptstraße 1, Berlin' },
    { name: 'Zahnarztpraxis Schmidt', specialty: 'Zahnarzt', address: 'Nebenstraße 2, Berlin' },
    { name: 'Hautarzt Dr. Weber', specialty: 'Hautarzt', address: 'Ringstraße 3, Berlin' },
  ];

  it('returns ALL doctors when query is only a category word ("arzt")', () => {
    // Regression-Lock für den Bug: "arzt"-Suche gab 0 Ergebnisse, weil
    // nach dem Wort "arzt" in Name/Spezialität/Adresse gefiltert wurde.
    const result = filterDoctorsByQuery(doctors, 'arzt');
    expect(result).toHaveLength(3);
  });

  it('returns ALL doctors when query is "praxis" (category word)', () => {
    const result = filterDoctorsByQuery(doctors, 'praxis');
    expect(result).toHaveLength(3);
  });

  it('filters by specialty when query is specific ("zahnarzt")', () => {
    const result = filterDoctorsByQuery(doctors, 'zahnarzt');
    expect(result).toHaveLength(1);
    expect(result[0].name).toContain('Schmidt');
  });

  it('filters by specialty when query is specific ("hautarzt")', () => {
    const result = filterDoctorsByQuery(doctors, 'hautarzt');
    expect(result).toHaveLength(1);
    expect(result[0].name).toContain('Weber');
  });

  it('filters by specialty when query is specific ("haut")', () => {
    const result = filterDoctorsByQuery(doctors, 'haut');
    expect(result).toHaveLength(1);
    expect(result[0].name).toContain('Weber');
  });

  it('applies AND-logic for multi-word queries', () => {
    // "zahnarzt berlin" muss die Praxis mit Zahnarzt UND Berlin-Adresse treffen
    const result = filterDoctorsByQuery(doctors, 'zahnarzt berlin');
    expect(result).toHaveLength(1);
    expect(result[0].name).toContain('Schmidt');
  });

  it('is case-insensitive', () => {
    expect(filterDoctorsByQuery(doctors, 'ARZT')).toHaveLength(3);
    expect(filterDoctorsByQuery(doctors, 'ZAHNARZT')).toHaveLength(1);
  });

  it('filters on name for specific queries', () => {
    const result = filterDoctorsByQuery(doctors, 'müller');
    expect(result).toHaveLength(1);
    expect(result[0].name).toContain('Müller');
  });

  it('returns empty array when nothing matches', () => {
    const result = filterDoctorsByQuery(doctors, 'augenarzt nirgendwo');
    expect(result).toHaveLength(0);
  });
});

describe('doctorCategoryPattern', () => {
  it('matches only pure category words (Wortgrenzen)', () => {
    expect(doctorCategoryPattern.test('arzt')).toBe(true);
    expect(doctorCategoryPattern.test('praxis')).toBe(true);
    expect(doctorCategoryPattern.test('klinik')).toBe(true);
    // Spezialisierungen enthalten "arzt" als Substring, sind aber KEINE
    // reinen Kategorie-Wörter → bleiben als Filter erhalten.
    expect(doctorCategoryPattern.test('zahnarzt')).toBe(false);
    expect(doctorCategoryPattern.test('hautarzt')).toBe(false);
    expect(doctorCategoryPattern.test('haut')).toBe(false);
    expect(doctorCategoryPattern.test('augen')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Live-Integrationstests: GET /api/search
// ---------------------------------------------------------------------------

describe('GET /api/search (live)', () => {
  it('returns doctor results for "arzt" near Berlin', async () => {
    const res = await withRetry(
      () =>
        request(app).get(
          `/api/search?q=arzt&lat=${BERLIN.lat}&lng=${BERLIN.lng}`,
        ),
      { name: 'search-doctors', retries: 3, timeoutMs: TIMEOUTS.overpass },
    );

    expect(isAcceptableStatus(res.status)).toBe(true);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('count');
      expect(Array.isArray(res.body.results)).toBe(true);
      if (res.body.count > 0) {
        const doctorResults = res.body.results.filter(
          (r: any) => r.category === 'doctor',
        );
        expect(doctorResults.length).toBeGreaterThan(0);
      }
    }
  }, TIMEOUTS.overpass);

  it('returns event results for "veranstaltung" near Berlin', async () => {
    const res = await withRetry(
      () =>
        request(app).get(
          `/api/search?q=veranstaltung&lat=${BERLIN.lat}&lng=${BERLIN.lng}`,
        ),
      { name: 'search-events', retries: 3, timeoutMs: TIMEOUTS.overpass },
    );

    expect(isAcceptableStatus(res.status)).toBe(true);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('categories');
      if (res.body.count > 0) {
        expect(res.body.categories.event).toBeGreaterThan(0);
      }
    }
  }, TIMEOUTS.overpass);

  it('returns hotel results for "hotel" near Berlin', async () => {
    const res = await withRetry(
      () =>
        request(app).get(
          `/api/search?q=hotel&lat=${BERLIN.lat}&lng=${BERLIN.lng}`,
        ),
      { name: 'search-hotels', retries: 3, timeoutMs: TIMEOUTS.overpass },
    );

    expect(isAcceptableStatus(res.status)).toBe(true);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('categories');
      if (res.body.count > 0) {
        expect(res.body.categories.hotel).toBeGreaterThan(0);
      }
    }
  }, TIMEOUTS.overpass);

  it('returns job results for "job entwickler"', async () => {
    const res = await withRetry(
      () =>
        request(app).get(
          `/api/search?q=job%20entwickler&lat=${BERLIN.lat}&lng=${BERLIN.lng}`,
        ),
      { name: 'search-jobs', retries: 3, timeoutMs: TIMEOUTS.transit },
    );

    expect(isAcceptableStatus(res.status)).toBe(true);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('categories');
      if (res.body.count > 0) {
        expect(res.body.categories.job).toBeGreaterThan(0);
      }
    }
  }, TIMEOUTS.transit);

  it('returns 400 without query parameter', async () => {
    const res = await request(app).get(
      `/api/search?lat=${BERLIN.lat}&lng=${BERLIN.lng}`,
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 without coordinates', async () => {
    const res = await request(app).get('/api/search?q=arzt');
    expect(res.status).toBe(400);
  });
});
