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
  // --- Weather ---
  OPEN_METEO_URL?: string;
  OPEN_AIR_QUALITY_URL?: string;
  BRIGHTSKY_BASE_URL?: string;
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

  constructor(env: NodeJS.ProcessEnv = process.env) {
    // Helper: trailing-slash-strip. Verhindert `${baseUrl}/x` + `suffix` =
    // `baseUrl//x` (404 oder SSL-Fehler in manchen Proxies).
    const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

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
    const userAgentRaw = normalizeEnvValue(env.HEIMAT_USER_AGENT);
    const overpassRaw = normalizeEnvValue(env.OVERPASS_MIRRORS);

    this.userAgent =
      userAgentRaw || 'HEIMAT-App/1.0 (https://github.com/abatn/HEIMAT)';

    this.nominatimUrl = stripTrailingSlash(
      nominatimRaw || 'https://nominatim.openstreetmap.org'
    );

    this.osrmUrl = stripTrailingSlash(
      osrmRaw || 'https://router.project-osrm.org'
    );

    this.openMeteoUrl = stripTrailingSlash(
      openMeteoRaw || 'https://api.open-meteo.com/v1'
    );

    this.openAirQualityUrl = stripTrailingSlash(
      openAirQualityRaw || 'https://air-quality-api.open-meteo.com/v1'
    );

    this.brightSkyBase = stripTrailingSlash(
      brightSkyRaw || 'https://api.brightsky.dev'
    );

    // Mirror-Liste: comma-separated env-var oder 3-Default-Mirrors.
    // .filter(Boolean) schuetzt vor OVERPASS_MIRRORS="" → [''] Crash.
    const mirrorsFromEnv = overpassRaw
      ? overpassRaw.split(',')
          .map(s => stripTrailingSlash(s.trim()))
          .filter((s): s is string => s.length > 0)
      : [
          'https://overpass-api.de/api/interpreter',
          'https://overpass.kumi.systems/api/interpreter',
          'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
        ];
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
    openMeteoUrl: string;
    openAirQualityUrl: string;
    brightSkyBase: string;
    envOverridesActive: string[];
  } {
    const activeOverrides: string[] = [];
    if (process.env.NOMINATIM_URL) activeOverrides.push('NOMINATIM_URL');
    if (process.env.OSRM_URL) activeOverrides.push('OSRM_URL');
    if (process.env.OVERPASS_MIRRORS) activeOverrides.push('OVERPASS_MIRRORS');
    if (process.env.OPEN_METEO_URL) activeOverrides.push('OPEN_METEO_URL');
    if (process.env.OPEN_AIR_QUALITY_URL) activeOverrides.push('OPEN_AIR_QUALITY_URL');
    if (process.env.BRIGHTSKY_BASE_URL) activeOverrides.push('BRIGHTSKY_BASE_URL');
    if (process.env.HEIMAT_USER_AGENT) activeOverrides.push('HEIMAT_USER_AGENT');
    return {
      userAgent: this.userAgent,
      nominatimUrl: this.nominatimUrl,
      osrmUrl: this.osrmUrl,
      overpassMirrorCount: this.overpassMirrors.length,
      openMeteoUrl: this.openMeteoUrl,
      openAirQualityUrl: this.openAirQualityUrl,
      brightSkyBase: this.brightSkyBase,
      envOverridesActive: activeOverrides,
    };
  }
}

// Module-Load-Time-Singleton. Wird 1x bei Process-Start instanziert.
// Render-Env-Vars werden VOR module-load gelesen → korrekt initialisiert.
export const externalServices = new ExternalServiceRegistry();
