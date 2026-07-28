// ---------------------------------------------------------------------------
// ExternalServiceRegistry — Phase X.2 HEIMAT Backend-Configuration
//
// ZWECK: Single Source of Truth fuer alle externen Service-URLs im Backend.
//        Vorher: 9 Service-Files mit `private readonly = 'https://...'` als
//        hardcoded class-properties. Jetzt: env-var-driven, deployment-friendly
//        (Defaults = aktuelle hardcoded Werte, sodass Render ohne env-vars
//        laeuft; Override via process.env.XXX_URL moeglich).
//
// STRATEGIE (User-settled Phase X.2): "Default-Strategie"
//   - Aktuelle hardcoded Strings bleiben stabil als Defaults
//   - process.env Override optional
//   - Kein required-env-var-Restart-Cascade
//
// DESIGN-ENTSCHEIDUNGEN (Phase X.2-Architektur-Pass):
//   1. Singleton-Klasse mit Constructor-DI (env: NodeJS.ProcessEnv = process.env)
//      → Tests koennen `new ExternalServiceRegistry({})` mit mock-env aufrufen
//   2. Readonly typed properties (Explizit-Auto-Complete in IDE)
//   3. Comma-separated env-vars fuer Mirror-Listen (Render copy-paste-friendly)
//   4. Object.freeze() auf Mirror-Array (Immutability-Guarantee)
//   5. Mitigations:
//      - Trailing-Slash-Strip (verhindert `..com//search` 404-Bugs)
//      - `.filter(Boolean)` fuer OVERPASS_MIRRORS=''  (verhindert [''] Crash)
// ---------------------------------------------------------------------------

/**
 * Public-Typed-Interface fuer env-var-Keys.
 * Nur zur Doku, nicht zur Validierung. Render akzeptiert beliebige strings.
 */
export interface ExternalServiceEnv {
  // --- Mobility ---
  NOMINATIM_URL?: string;
  OSRM_URL?: string;
  OVERPASS_MIRRORS?: string;
  TRANSITOUS_BASE_URL?: string;
  // --- Weather ---
  OPEN_METEO_URL?: string;
  OPEN_AIR_QUALITY_URL?: string;
  BRIGHTSKY_BASE_URL?: string;
  // --- Taler (Phase X.4a) ---
  TALER_EXCHANGE_BASE_URL?: string;
  TALER_BANK_BASE_URL?: string;
  // --- Abfallkalender (Phase X.4b) ---
  ABFALL_BSR_PRIMARY_URL?: string;
  ABFALL_BSR_FALLBACK_URL?: string;
  ABFALL_AWB_PRIMARY_URL?: string;
  // ABFALL_AWB_FALLBACK_URL?: string; — env-only (Phase B-2.3 AGPL-defensiv: kein commit-fähiger default)
  // ABFALL_SRH_FALLBACK_URL?: string; — env-only (Phase B-2.1 NEEDS-FIX #2 AGPL-defensiv)
  ABFALL_SRH_PRIMARY_URL?: string;
  // --- Allgemein ---
  HEIMAT_USER_AGENT?: string;
}

export class ExternalServiceRegistry {
  /** User-Agent-String fuer alle externen HTTP-Calls (Nominatim, OSRM, etc.). */
  public readonly userAgent: string;

  /** Base-URL fuer Nominatim (OpenStreetMap-Geocoding & Reverse-Geocoding). */
  public readonly nominatimUrl: string;

  /** Base-URL fuer OSRM (Open-Source-Routing-Machine, Auto-Routing). */
  public readonly osrmUrl: string;

  /**
   * Overpass-API-Mirror-Liste (OpenStreetMap-Daten-Extractor).
   * FALLBACK-PATTERN: bei Mirror-Ausfall wird naechster Mirror probiert.
   * Default: 3 etablierte Public-Mirrors (alle CC-BY-ODbL).
   */
  public readonly overpassMirrors: readonly string[];

  /** Open-Meteo Base-URL (DWD-Wetterdaten via ICON-Modell). */
  public readonly openMeteoUrl: string;

  /** Open-Meteo Air Quality Base-URL (CAMS Copernicus, eigene Subdomain). */
  public readonly openAirQualityUrl: string;

  /** Bright Sky Base-URL (DWD-Wetterdaten, 2. Mirror/Fallback). */
  public readonly brightSkyBase: string;

  /** Transitous Base-URL (community-maintained GTFS-Aggregator). */
  public readonly transitousBase: string;

  /** GNU Taler Exchange Base-URL (echte Reserve-/wallet-Operationen). */
  public readonly talerExchangeBase: string;

  /** GNU Taler Demo-Bank Base-URL (Web-UI fuer Bank-Wire-Transfer zum Exchange). */
  public readonly talerBankBase: string;

  /** Abfallkalender Berlin BSR Primary iCal-Endpoint. */
  public readonly abfallBerlinPrimaryUrl: string;

  /** Abfallkalender Berlin BSR Fallback iCal-Endpoint (opendata-mirror). */
  public readonly abfallBerlinFallbackUrl: string;

  /** Abfallkalender München AWB Primary iCal-Endpoint (community-mirror). */
  public readonly abfallMuenchenPrimaryUrl: string;

  /** Abfallkalender Hamburg SRH Primary iCal-Endpoint (HTML-form-export). */
  public readonly abfallHamburgPrimaryUrl: string;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    // VALIDATE-URL-HELPER (Phase X.3b — NEEDS-FIX #2 resolution):
    // Fail-Fast on app-start wenn env-var zu kaputter URL wird:
    //   - empty after trailing-slash-strip (z.B. NOMINATIM_URL='/')
    //   - malformed format (z.B. 'invalid-url' scheitert an new URL())
    //   - non-http(s)-scheme (z.B. 'ftp://...' wird explizit abgelehnt)
    // Wirft detaillierten Error mit env-var-name für debugging. Render
    // startup-haenger ist explizit besser als silent axios-crash zur runtime.
    const validateUrl = (rawValue: string | undefined, envVar: string, fallback: string): string => {
      const stripped = (rawValue ?? fallback).replace(/\/+$/, '');
      if (!stripped) {
        throw new Error(
          `ExternalServiceRegistry: env-var ${envVar} resolves to empty string ` +
          `(set to '/' or whitespace-only). Falling back to default not possible — fail-fast.`
        );
      }
      // Scheme-Check (Phase X.3b Code-Reviewer NEEDS-FIX #1):
      // REJECT ftp://, file://, gopher://, etc. → nur http oder https erlaubt.
      // `new URL(stripped)` würde ftp:// sonst als 'gültig' akzeptieren, aber
      // axios kann ftp nicht handhaben. User-Spirit: "externe Webseiten-Aufrufe
      // verboten" → http/https-only ist die korrekte Restriction.
      if (!/^https?:\/\//.test(stripped)) {
        throw new Error(
          `ExternalServiceRegistry: env-var ${envVar} has non-http(s) scheme: '${stripped}'. ` +
          `Only http:// or https:// URLs are accepted.`
        );
      }
      try {
        // Backup-validate URL-parseable (catch garbage like 'invalid-url').
        new URL(stripped);
      } catch {
        throw new Error(
          `ExternalServiceRegistry: env-var ${envVar} has invalid URL format: '${stripped}'. ` +
          `Expected http:// or https:// + host + optional path.`
        );
      }
      return stripped;
    };

    // Mitigation (Code-Reviewer Phase X.2 NEEDS-FIX #1):
    // Guard gegen env-Strings "undefined" oder "null" (Render-Action-Bug
    // kann String-Werte statt leerer env-vars setzen). Diese werden
    // transparent auf default umgeleitet, statt als URL verwendet zu werden
    // (DNS-NXDOMAIN-Crash-Vermeidung).
    const normalizeEnvValue = (v: string | undefined): string | undefined => {
      if (v === undefined) return undefined;
      const trimmed = v.trim();
      if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null') {
        return undefined;
      }
      return trimmed;
    };

    const nominatimRaw = normalizeEnvValue(env.NOMINATIM_URL);
    const osrmRaw = normalizeEnvValue(env.OSRM_URL);
    const openMeteoRaw = normalizeEnvValue(env.OPEN_METEO_URL);
    const openAirQualityRaw = normalizeEnvValue(env.OPEN_AIR_QUALITY_URL);
    const brightSkyRaw = normalizeEnvValue(env.BRIGHTSKY_BASE_URL);
    const transitousRaw = normalizeEnvValue(env.TRANSITOUS_BASE_URL);
    const talerExchangeRaw = normalizeEnvValue(env.TALER_EXCHANGE_BASE_URL);
    const talerBankRaw = normalizeEnvValue(env.TALER_BANK_BASE_URL);
    const abfallBerlinPrimaryRaw = normalizeEnvValue(env.ABFALL_BSR_PRIMARY_URL);
    const abfallBerlinFallbackRaw = normalizeEnvValue(env.ABFALL_BSR_FALLBACK_URL);
    const abfallMuenchenPrimaryRaw = normalizeEnvValue(env.ABFALL_AWB_PRIMARY_URL);
    const abfallHamburgPrimaryRaw = normalizeEnvValue(env.ABFALL_SRH_PRIMARY_URL);
    const userAgentRaw = normalizeEnvValue(env.HEIMAT_USER_AGENT);
    const overpassRaw = normalizeEnvValue(env.OVERPASS_MIRRORS);

    this.userAgent =
      userAgentRaw || 'HEIMAT-App/1.0 (https://github.com/abatn/HEIMAT)';

    this.nominatimUrl = validateUrl(
      nominatimRaw, 'NOMINATIM_URL', 'https://nominatim.openstreetmap.org'
    );

    this.osrmUrl = validateUrl(
      osrmRaw, 'OSRM_URL', 'https://router.project-osrm.org'
    );

    this.openMeteoUrl = validateUrl(
      openMeteoRaw, 'OPEN_METEO_URL', 'https://api.open-meteo.com/v1'
    );

    this.openAirQualityUrl = validateUrl(
      openAirQualityRaw, 'OPEN_AIR_QUALITY_URL', 'https://air-quality-api.open-meteo.com/v1'
    );

    this.brightSkyBase = validateUrl(
      brightSkyRaw, 'BRIGHTSKY_BASE_URL', 'https://api.brightsky.dev'
    );

    this.transitousBase = validateUrl(
      transitousRaw, 'TRANSITOUS_BASE_URL', 'https://api.transitous.org/api/v1'
    );

    this.talerExchangeBase = validateUrl(
      talerExchangeRaw, 'TALER_EXCHANGE_BASE_URL', 'https://exchange.demo.taler.net'
    );

    this.talerBankBase = validateUrl(
      talerBankRaw, 'TALER_BANK_BASE_URL', 'https://bank.demo.taler.net'
    );

    this.abfallBerlinPrimaryUrl = validateUrl(
      abfallBerlinPrimaryRaw,
      'ABFALL_BSR_PRIMARY_URL',
      'https://www.bsr.de/abfuhrkalender-ical?strasse={street}&hausnr={houseNr}',
    );

    this.abfallBerlinFallbackUrl = validateUrl(
      abfallBerlinFallbackRaw,
      'ABFALL_BSR_FALLBACK_URL',
      'https://opendata.bahn.de/web/opendata/bsr-mirror/abfallkalender.ics?stadtteil={street}&hausnr={houseNr}',
    );

    this.abfallMuenchenPrimaryUrl = validateUrl(
      abfallMuenchenPrimaryRaw,
      'ABFALL_AWB_PRIMARY_URL',
      'https://raw.githubusercontent.com/mil-muenchen/muenchen-abfallkalender/main/muenchen.ics',
    );

    this.abfallHamburgPrimaryUrl = validateUrl(
      abfallHamburgPrimaryRaw,
      'ABFALL_SRH_PRIMARY_URL',
      'https://www.stadtreinigung-hamburg.de/icity/export.php?street={street}&houseNr={houseNr}',
    );

    // Mirror-Liste: comma-separated env-var oder 3-Default-Mirrors.
    // .filter(Boolean) schuetzt vor OVERPASS_MIRRORS="" → [''] Crash.
    // Inline `replace(/\/+$/, '')` statt stripTrailingSlash-Helper (Phase X.3b
    // Refactor: helper entfernt nach validateUrl-Einfuehrung; mirror-list
    // ist die einzige Stelle an der wir noch trailing-slash-strip machen).
    const mirrorsFromEnv = overpassRaw
      ? overpassRaw.split(',')
          .map(s => s.trim().replace(/\/+$/, ''))
          .filter((s): s is string => s.length > 0)
      : [
          'https://overpass-api.de/api/interpreter',
          'https://overpass.kumi.systems/api/interpreter',
          'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
        ];
    // Phase X.3b scheme-check: alle mirror-URLs muessen http(s) sein.
    // ACHTUNG: dieser fasst die ganze Liste — wenn EINE mirror-URL kaputt
    // ist, wirft der ganze constructor (fail-fast cascade).
    for (const mirror of mirrorsFromEnv) {
      if (!/^https?:\/\//.test(mirror)) {
        throw new Error(
          `ExternalServiceRegistry: OVERPASS_MIRRORS contains non-http(s) URL: '${mirror}'.`
        );
      }
    }
    this.overpassMirrors = Object.freeze(mirrorsFromEnv);
  }

  /**
   * Diagnostic-Helper: gibt registry-state zurueck (z.B. fuer
   * /api/admin/config route, debugging oder Audit).
   * Env-Var-Override-Values werden NICHT exposet (sicherheitskritisch:
   * manche Render-env-vars koennen secrets enthalten).
   */
  describe(): {
    userAgent: string;
    nominatimUrl: string;
    osrmUrl: string;
    overpassMirrorCount: number;
    transitousBase: string;
    openMeteoUrl: string;
    openAirQualityUrl: string;
    brightSkyBase: string;
    talerExchangeBase: string;
    talerBankBase: string;
    abfallBerlinPrimaryUrl: string;
    abfallBerlinFallbackUrl: string;
    abfallMuenchenPrimaryUrl: string;
    abfallHamburgPrimaryUrl: string;
    envOverridesActive: string[];
  } {
    const activeOverrides: string[] = [];
    if (process.env.NOMINATIM_URL) activeOverrides.push('NOMINATIM_URL');
    if (process.env.OSRM_URL) activeOverrides.push('OSRM_URL');
    if (process.env.OVERPASS_MIRRORS) activeOverrides.push('OVERPASS_MIRRORS');
    if (process.env.TRANSITOUS_BASE_URL) activeOverrides.push('TRANSITOUS_BASE_URL');
    if (process.env.OPEN_METEO_URL) activeOverrides.push('OPEN_METEO_URL');
    if (process.env.OPEN_AIR_QUALITY_URL) activeOverrides.push('OPEN_AIR_QUALITY_URL');
    if (process.env.BRIGHTSKY_BASE_URL) activeOverrides.push('BRIGHTSKY_BASE_URL');
    if (process.env.TALER_EXCHANGE_BASE_URL) activeOverrides.push('TALER_EXCHANGE_BASE_URL');
    if (process.env.TALER_BANK_BASE_URL) activeOverrides.push('TALER_BANK_BASE_URL');
    if (process.env.ABFALL_BSR_PRIMARY_URL) activeOverrides.push('ABFALL_BSR_PRIMARY_URL');
    if (process.env.ABFALL_BSR_FALLBACK_URL) activeOverrides.push('ABFALL_BSR_FALLBACK_URL');
    if (process.env.ABFALL_AWB_PRIMARY_URL) activeOverrides.push('ABFALL_AWB_PRIMARY_URL');
    if (process.env.ABFALL_SRH_PRIMARY_URL) activeOverrides.push('ABFALL_SRH_PRIMARY_URL');
    if (process.env.HEIMAT_USER_AGENT) activeOverrides.push('HEIMAT_USER_AGENT');
    return {
      userAgent: this.userAgent,
      nominatimUrl: this.nominatimUrl,
      osrmUrl: this.osrmUrl,
      overpassMirrorCount: this.overpassMirrors.length,
      transitousBase: this.transitousBase,
      openMeteoUrl: this.openMeteoUrl,
      openAirQualityUrl: this.openAirQualityUrl,
      brightSkyBase: this.brightSkyBase,
      talerExchangeBase: this.talerExchangeBase,
      talerBankBase: this.talerBankBase,
      abfallBerlinPrimaryUrl: this.abfallBerlinPrimaryUrl,
      abfallBerlinFallbackUrl: this.abfallBerlinFallbackUrl,
      abfallMuenchenPrimaryUrl: this.abfallMuenchenPrimaryUrl,
      abfallHamburgPrimaryUrl: this.abfallHamburgPrimaryUrl,
      envOverridesActive: activeOverrides,
    };
  }
}

// Module-Load-Time-Singleton. Wird 1x bei Process-Start instanziert.
// Render-Env-Vars werden VOR module-load gelesen → korrekt initialisiert.
export const externalServices = new ExternalServiceRegistry();
