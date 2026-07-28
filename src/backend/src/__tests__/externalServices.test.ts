// ---------------------------------------------------------------------------
// externalServices.test.ts — Phase X.2/X.3b Backend-Config-Registry Unit-Tests
//
// Strategie: Pure unit tests (kein axios-mock, kein DB-mock noetig).
// Wir testen die Registry-Klasse isoliert via Constructor-DI mit mock-env.
//
// Coverage-Plan (26 Tests in 4 Groups):
//   Group 1 - Defaults: 6 tests (alle 6 URLs fallen auf hardcoded Strings)
//   Group 2 - Env-Override + X.2 NEEDS-FIX #1 + X.3b NEEDS-FIX #2:
//             13 tests (override + multi-override + trailing-slash-strip +
//             undefined-string-guard + empty-after-strip + invalid-format +
//             ftp-scheme-reject)
//   Group 3 - Mirror-Listen-Parsing: 4 tests
//   Group 4 - describe() + Immutability: 4 Tests
// ---------------------------------------------------------------------------

import {
  ExternalServiceRegistry,
  externalServices,
} from '../config/externalServices';

describe('ExternalServiceRegistry', () => {
  describe('Group 1: Default-Fallback (leeres env)', () => {
    it('verwendet HEIMAT-Default-User-Agent wenn kein env-var gesetzt', () => {
      const r = new ExternalServiceRegistry({});
      expect(r.userAgent).toBe(
        'HEIMAT-App/1.0 (https://github.com/abatn/HEIMAT)'
      );
    });

    it('verwendet Nominatim-Default wenn NOMINATIM_URL nicht gesetzt', () => {
      const r = new ExternalServiceRegistry({});
      expect(r.nominatimUrl).toBe('https://nominatim.openstreetmap.org');
    });

    it('verwendet OSRM-Default wenn OSRM_URL nicht gesetzt', () => {
      const r = new ExternalServiceRegistry({});
      expect(r.osrmUrl).toBe('https://router.project-osrm.org');
    });

    it('verwendet 3 Overpass-Default-Mirrors wenn OVERPASS_MIRRORS nicht gesetzt', () => {
      const r = new ExternalServiceRegistry({});
      expect(r.overpassMirrors).toEqual([
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
      ]);
    });

    it('verwendet Open-Meteo + Bright-Sky + Air-Quality Defaults', () => {
      const r = new ExternalServiceRegistry({});
      expect(r.openMeteoUrl).toBe('https://api.open-meteo.com/v1');
      expect(r.brightSkyBase).toBe('https://api.brightsky.dev');
      expect(r.openAirQualityUrl).toBe('https://air-quality-api.open-meteo.com/v1');
    });

    // ─ Phase X.4a: Transitous + Taler Exchange + Taler Bank Defaults ─
    it('verwendet Transitous-Default wenn TRANSITOUS_BASE_URL nicht gesetzt', () => {
      const r = new ExternalServiceRegistry({});
      expect(r.transitousBase).toBe('https://api.transitous.org/api/v1');
    });

    it('verwendet Taler-Exchange-Default wenn TALER_EXCHANGE_BASE_URL nicht gesetzt', () => {
      const r = new ExternalServiceRegistry({});
      expect(r.talerExchangeBase).toBe('https://exchange.demo.taler.net');
    });

    it('verwendet Taler-Bank-Default wenn TALER_BANK_BASE_URL nicht gesetzt', () => {
      const r = new ExternalServiceRegistry({});
      expect(r.talerBankBase).toBe('https://bank.demo.taler.net');
    });
  });

  describe('Group 2: env-var Override + NEEDS-FIX Mitigations', () => {
    it('NOMINATIM_URL ueberschreibt default ohne trailing-slash', () => {
      const r = new ExternalServiceRegistry({
        NOMINATIM_URL: 'http://internal-nominatim.local',
      });
      expect(r.nominatimUrl).toBe('http://internal-nominatim.local');
    });

    it('strippt trailing slashes automatisch', () => {
      const r = new ExternalServiceRegistry({
        NOMINATIM_URL: 'https://proxy.example.com/',
      });
      expect(r.nominatimUrl).toBe('https://proxy.example.com');
    });

    it('mehrere env-vars koennen gleichzeitig gesetzt werden', () => {
      const r = new ExternalServiceRegistry({
        NOMINATIM_URL: 'http://n1',
        OSRM_URL: 'http://osrm1',
        OPEN_METEO_URL: 'http://om1',
      });
      expect(r.nominatimUrl).toBe('http://n1');
      expect(r.osrmUrl).toBe('http://osrm1');
      expect(r.openMeteoUrl).toBe('http://om1');
      // brightSkyBase bleibt auf default (nicht ueberschrieben)
      expect(r.brightSkyBase).toBe('https://api.brightsky.dev');
    });

    it('HEIMAT_USER_AGENT-Override', () => {
      const r = new ExternalServiceRegistry({
        HEIMAT_USER_AGENT: 'CustomApp/2.0 (https://example.com)',
      });
      expect(r.userAgent).toBe('CustomApp/2.0 (https://example.com)');
    });

    it('OPEN_AIR_QUALITY_URL-Override mit trailing-slash-strip', () => {
      const r = new ExternalServiceRegistry({
        OPEN_AIR_QUALITY_URL: 'http://internal-aq.test.local/',
      });
      expect(r.openAirQualityUrl).toBe('http://internal-aq.test.local');
    });

    // ─ Phase X.2 NEEDS-FIX #1: Render-Aktions koennen env-string 'undefined'/'null' setzen ─
    it('treat env-string "undefined" wie nicht-gesetzt → fall-back auf default', () => {
      const r = new ExternalServiceRegistry({
        NOMINATIM_URL: 'undefined',
      });
      expect(r.nominatimUrl).toBe('https://nominatim.openstreetmap.org');
    });

    it('treat env-string "null" wie nicht-gesetzt → fall-back auf default', () => {
      const r = new ExternalServiceRegistry({
        OSRM_URL: 'null',
      });
      expect(r.osrmUrl).toBe('https://router.project-osrm.org');
    });

    it('treat leer-string env wie nicht-gesetzt (whitespace-only)', () => {
      const r = new ExternalServiceRegistry({
        OPEN_METEO_URL: '   ',
      });
      expect(r.openMeteoUrl).toBe('https://api.open-meteo.com/v1');
    });

    it('mehrere env-guard-Schutz gleichzeitig ("undefined" + "null" + valid)', () => {
      const r = new ExternalServiceRegistry({
        NOMINATIM_URL: 'undefined',
        OSRM_URL: 'null',
        OPEN_METEO_URL: 'http://valid-om.test',
      });
      expect(r.nominatimUrl).toBe('https://nominatim.openstreetmap.org');
      expect(r.osrmUrl).toBe('https://router.project-osrm.org');
      expect(r.openMeteoUrl).toBe('http://valid-om.test');
    });

    // ─ Phase X.3b NEEDS-FIX #2: URL-Validator fail-fast ─
    // Drei Validierungsstufen: empty-after-strip / non-http(s)-scheme / invalid-format.
    it('fail-fast: NOMINATIM_URL="/" wirft Error mit "empty" im message', () => {
      expect(() => new ExternalServiceRegistry({ NOMINATIM_URL: '/' })).toThrow(/empty/);
    });

    it('fail-fast: NOMINATIM_URL="invalid-url" wirft Error mit "non-http(s) scheme" (scheme-check fires vor new URL)', () => {
      // Reihenfolge: empty → scheme → new URL. 'invalid-url' ist nicht http(s),
      // daher wirft scheme-check ZUERST (vor new URL). Erwartet scheme-msg.
      expect(
        () => new ExternalServiceRegistry({ NOMINATIM_URL: 'invalid-url' })
      ).toThrow(/(non-http|scheme)/);
    });

    it('fail-fast: OSRM_URL="ftp://wrong-scheme" wirft Error (scheme-check)', () => {
      expect(
        () => new ExternalServiceRegistry({ OSRM_URL: 'ftp://wrong-scheme' })
      ).toThrow(/(non-http|scheme)/);
    });

    // ─ Phase X.4a: Transitous + Taler env-overrides ─
    it('TRANSITOUS_BASE_URL-Override mit trailing-slash-strip', () => {
      const r = new ExternalServiceRegistry({
        TRANSITOUS_BASE_URL: 'http://transitous-internal.test/v1/',
      });
      expect(r.transitousBase).toBe('http://transitous-internal.test/v1');
    });

    it('TALER_EXCHANGE_BASE_URL-Override mit trailing-slash-strip', () => {
      const r = new ExternalServiceRegistry({
        TALER_EXCHANGE_BASE_URL: 'https://eur-exchange.taler.net/',
      });
      expect(r.talerExchangeBase).toBe('https://eur-exchange.taler.net');
    });

    it('TALER_BANK_BASE_URL-Override mit trailing-slash-strip', () => {
      const r = new ExternalServiceRegistry({
        TALER_BANK_BASE_URL: 'https://bank-test.taler.net/',
      });
      expect(r.talerBankBase).toBe('https://bank-test.taler.net');
    });

    it('fail-fast: TRANSITOUS_BASE_URL="ftp://x" wirft Error (scheme-check)', () => {
      expect(
        () => new ExternalServiceRegistry({ TRANSITOUS_BASE_URL: 'ftp://x.test' })
      ).toThrow(/(non-http|scheme)/);
    });

    it('fail-fast: TALER_EXCHANGE_BASE_URL="invalid" wirft Error (scheme-check)', () => {
      expect(
        () => new ExternalServiceRegistry({ TALER_EXCHANGE_BASE_URL: 'invalid' })
      ).toThrow(/(non-http|scheme)/);
    });

    it('fail-fast: TALER_BANK_BASE_URL="/" wirft Error (empty-string nach strip)', () => {
      expect(
        () => new ExternalServiceRegistry({ TALER_BANK_BASE_URL: '/' })
      ).toThrow(/empty/);
    });
  });

  describe('Group 3: Mirror-Listen-Parsing (comma-separated)', () => {
    it('parst OVERPASS_MIRRORS comma-separated und trimmt whitespace', () => {
      const r = new ExternalServiceRegistry({
        OVERPASS_MIRRORS: 'http://m1.test/api,  http://m2.test/api  , http://m3.test/api',
      });
      expect(r.overpassMirrors).toEqual([
        'http://m1.test/api',
        'http://m2.test/api',
        'http://m3.test/api',
      ]);
    });

    it('strippt trailing slashes in mirror-list URLs', () => {
      const r = new ExternalServiceRegistry({
        OVERPASS_MIRRORS: 'http://m1.test/,http://m2.test/',
      });
      expect(r.overpassMirrors).toEqual(['http://m1.test', 'http://m2.test']);
    });

    it('filtert leere Strings aus der Mirror-Liste (OVERPASS_MIRRORS="")', () => {
      // Mitigation: verhindert ['']-Crash bei leerem env-var
      const r = new ExternalServiceRegistry({ OVERPASS_MIRRORS: '' });
      expect(r.overpassMirrors).toEqual([
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
      ]);
    });

    it('filtert leer-entries aus comma-string mit fuehrendem whitespace', () => {
      // Format mit fuehrendem whitespace + leeren entries + valid URLs.
      // Nach trim/filter sollten nur die valid http-URLs uebrigbleiben.
      const r = new ExternalServiceRegistry({
        OVERPASS_MIRRORS: ',  http://m1.test/api, ,http://m2.test/api,',
      });
      expect(r.overpassMirrors).toEqual([
        'http://m1.test/api',
        'http://m2.test/api',
      ]);
    });
  });

  describe('Group 4: describe() + Immutability', () => {
    it('describe() liefert diagnostik-Output korrekt strukturiert', () => {
      const r = new ExternalServiceRegistry({});
      const desc = r.describe();
      expect(desc).toHaveProperty('userAgent');
      expect(desc).toHaveProperty('nominatimUrl');
      expect(desc).toHaveProperty('osrmUrl');
      expect(desc).toHaveProperty('overpassMirrorCount');
      expect(desc).toHaveProperty('transitousBase');
      expect(desc).toHaveProperty('openMeteoUrl');
      expect(desc).toHaveProperty('brightSkyBase');
      expect(desc).toHaveProperty('talerExchangeBase');
      expect(desc).toHaveProperty('talerBankBase');
      expect(desc).toHaveProperty('envOverridesActive');
      expect(desc.overpassMirrorCount).toBe(3);
      expect(desc.envOverridesActive).toEqual([]); // kein override im test
    });

    it('describe() listet aktive env-overrides auf (wenn gesetzt)', () => {
      // Mock process.env lokal schreiben + describe() auf singleton aufrufen.
      const orig = { ...process.env };
      process.env.OVERPASS_MIRRORS = 'http://override';
      try {
        const desc = externalServices.describe();
        expect(desc.envOverridesActive).toContain('OVERPASS_MIRRORS');
      } finally {
        process.env = orig;
      }
    });

    it('overpassMirrors ist readonly frozen (Mutation wird abgefangen)', () => {
      const r = new ExternalServiceRegistry({});
      // Object.freeze() wirft im strict-mode, silent-fail in TS-non-strict
      // Wir verifizieren die Immutability ueber die Frozen-State-Property.
      expect(Object.isFrozen(r.overpassMirrors)).toBe(true);
    });

    it('singletons-Export existiert und liefert eine ExternalServiceRegistry', () => {
      // Type-Assertion: externalServices ist ein voll instanziierter singleton.
      expect(externalServices).toBeInstanceOf(ExternalServiceRegistry);
      // Singleton hat mindestens 3 overpass-mirrors (default)
      expect(externalServices.overpassMirrors.length).toBeGreaterThanOrEqual(3);
    });
  });
});
