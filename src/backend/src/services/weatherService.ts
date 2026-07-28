import { logger } from '../utils/logger';
import { externalServices } from '../config/externalServices';
import axios, { AxiosInstance } from 'axios';

// ---------------------------------------------------------------------------
// WeatherService — Ruft Wetterdaten von Open-Meteo ab.
// Open-Meteo (https://open-meteo.com/) nutzt DWD-ICON-Modelle als Datenquelle
// und bietet eine kostenlose JSON-API ohne API-Key.
// Lizenz: CC-BY 4.0 (DWD Open Data), Namensnennung erforderlich.
// ---------------------------------------------------------------------------

export interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  weatherCode: number;
  weatherText: string;
  precipitation: number;
  cloudCover: number;
  uvIndex: number;
}

export interface HourlyForecast {
  time: string;
  temperature: number;
  precipitation: number;
  weatherCode: number;
  windSpeed: number;
}

export interface DailyForecast {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitationSum: number;
  precipitationProbability: number;
  weatherCode: number;
  weatherText: string;
  windSpeedMax: number;
  sunrise: string;
  sunset: string;
}

export interface WeatherData {
  location: { lat: number; lng: number; name: string };
  current: CurrentWeather;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  source: string;
}

// WMO Weather Code -> Deutsche Beschreibung
const WMO_CODES: Record<number, string> = {
  0: 'Klarer Himmel',
  1: 'Überwiegend klar',
  2: 'Teilweise bewölkt',
  3: 'Bewölkt',
  45: 'Nebel',
  48: 'Reifnebel',
  51: 'Leichter Nieselregen',
  53: 'Mäßiger Nieselregen',
  55: 'Starker Nieselregen',
  56: 'Leichter gefrierender Nieselregen',
  57: 'Starker gefrierender Nieselregen',
  61: 'Leichter Regen',
  63: 'Mäßiger Regen',
  65: 'Starker Regen',
  66: 'Leichter gefrierender Regen',
  67: 'Starker gefrierender Regen',
  71: 'Leichter Schneefall',
  73: 'Mäßiger Schneefall',
  75: 'Starker Schneefall',
  77: 'Schneekörner',
  80: 'Leichte Regenschauer',
  81: 'Mäßige Regenschauer',
  82: 'Starke Regenschauer',
  85: 'Leichte Schneeschauer',
  86: 'Starke Schneeschauer',
  95: 'Gewitter',
  96: 'Gewitter mit leichtem Hagel',
  99: 'Gewitter mit starkem Hagel',
};

function wmoToText(code: number): string {
  return WMO_CODES[code] || 'Unbekannt';
}

// Einfaches Icon-Mapping basierend auf WMO-Code
function wmoToIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code === 1 || code === 2) return '⛅';
  if (code === 3) return '☁️';
  if (code >= 45 && code <= 48) return '🌫️';
  if (code >= 51 && code <= 57) return '🌦️';
  if (code >= 61 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 85 && code <= 86) return '🌨️';
  if (code >= 95) return '⛈️';
  return '🌡️';
}

// -------------------------------------------------------------------------
// Bright Sky (https://api.brightsky.dev/) — kostenloser DWD-Proxy,
// CC-BY 4.0 Namensnennung, kein API-Key. Wird als 2. Mirror genutzt wenn
// Open-Meteo durch Rate-Limit (HTTP 429) oder Server-Fehler (HTTP 5xx) oder
// Timeout vom Render-Shared-IP blockiert ist.
//
// Architektur-Mirror: gleiches Mirror-Fallback-Pattern wie
// mobilityService.ts (overpass-api.de + overpass.kumi.systems + maps.mail.ru)
// — bewährte Resilienz gegen Single-Vendor-Ausfälle, keine Mock-Daten, kein
// Cloud-AI. Real-DWD-Daten via zwei verschiedenen Vendor-IP-Ranges.
// -------------------------------------------------------------------------
// Module-level BRIGHTSKY_BASE entfernt (Phase X.3a): ersetzt durch
// `private readonly brightSkyBase = externalServices.brightSkyBase` in der
// WeatherService-Classe (Single Source of Truth via Config-Registry).

// Bright Sky Condition-Strings (8 Buckets, dokumentiert unter
// https://api.brightsky.dev/) → WMO Weather Code (Industrie-Standard).
// Mobile DTOs (weather_dto.dart) erwarten WMO-Codes (siehe WMO_CODES oben).
const BRIGHTSKY_CONDITION_TO_WMO: Record<string, number> = {
  dry: 0,            // Klarer Himmel
  fog: 45,           // Nebel
  cloudy: 3,         // Bewölkt
  rain: 63,          // Mäßiger Regen (Bright Sky kennt keine Light/Heavy-Granularität)
  sleet: 66,         // Gefrierender Regen
  snow: 73,          // Mäßiger Schneefall
  hail: 96,          // Gewitter mit Hagel
  thunderstorm: 95,  // Gewitter
};

export class WeatherService {
  // Phase X.3a: URLs aus externalServices-Registry (env-var-driven + defaults).
  private readonly baseUrl = externalServices.openMeteoUrl;
  private readonly brightSkyBase = externalServices.brightSkyBase;
  private readonly userAgent = externalServices.userAgent;
  private readonly nominatimUrl = externalServices.nominatimUrl;
  private readonly cache = new Map<string, { data: WeatherData; at: number }>();
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 Minuten

  // -----------------------------------------------------------------------
  // DI-Konstruktor (Test-Seam): Tests können ein mock-http injizieren
  // (`new WeatherService({ get: jest.fn() })`). Production-Singleton
  // `weatherService` weiter unten nutzt echtes axios (Default-Param).
  // Vor diesem Refactor scheiterten die Mock-Tests an TypeScript's
  // `__importDefault`-Resolution für `import axios from 'axios'`.
  // -----------------------------------------------------------------------
  constructor(private readonly http: AxiosInstance = axios) {}

  // ---------------------------------------------------------------------------
  // getCurrentWeather & getForecast — öffentliche API
  // ---------------------------------------------------------------------------

  async getWeather(lat: number, lng: number): Promise<WeatherData> {
    const cacheKey = `${lat.toFixed(2)}|${lng.toFixed(2)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.at < this.cacheTtlMs) {
      return cached.data;
    }

    // Open-Meteo + Reverse-Geocode parallel, aber entkoppelt:
    // Fehler beim Reverse-Geocode duerfen die Wetterdaten NICHT blockieren
    const [openMeteoData, locationName] = await Promise.all([
      this.fetchAll(lat, lng),
      this.reverseGeocode(lat, lng).catch(() => `${lat.toFixed(2)}, ${lng.toFixed(2)}`),
    ]);

    const weather: WeatherData = {
      location: { lat, lng, name: locationName },
      current: openMeteoData.current,
      hourly: openMeteoData.hourly,
      daily: openMeteoData.daily,
      // Source kommt aus fetchAll (Open-Meteo vs Bright Sky-Fallback).
      source: openMeteoData.source,
    };

    this.cache.set(cacheKey, { data: weather, at: Date.now() });
    return weather;
  }

  // ---------------------------------------------------------------------------
  // fetchAll — Mirror-Fallback-Pattern (Option B aus Thinker-Architektur-Pass):
  //
  // Phase 1: Open-Meteo Primary   (2-retry-with-backoff, kombinierter Endpoint)
  // Phase 2: Bright Sky Fallback  (2 parallele Calls, +150ms Round-Trip)
  // Total-Ausfall beider → Open-Meteo-Original-Error wird geworfen
  // (Bright Sky-Fehler nur in Render-Log; im 502-Body erscheint der
  //  aussagekräftigere Open-Meteo-Detail-String).
  //
  // Source-Information wird hier zurückgegeben statt hardcoded in
  // getWeather() — so kann die mobile App transparent entscheiden ob sie
  // "DWD via Open-Meteo" oder "DWD via Bright Sky" anzeigt (Doku-Drift-Schutz).
  // ---------------------------------------------------------------------------

  private readonly maxRetries = 2;

  private async fetchAll(
    lat: number,
    lng: number
  ): Promise<{
    current: CurrentWeather & { hourly: HourlyForecast[] };
    hourly: HourlyForecast[];
    daily: DailyForecast[];
    source: string;
  }> {
    try {
      const data = await this.fetchOpenMeteo(lat, lng);
      return {
        ...data,
        source: 'Deutscher Wetterdienst (DWD) via Open-Meteo',
      };
    } catch (e: unknown) {
      const axiosError = e as {
        response?: { status?: number; headers?: Record<string, string> };
        code?: string;
      };
      const status = axiosError.response?.status;
      const isRecoverable =
        status === 429 ||
        (typeof status === 'number' && status >= 500) ||
        axiosError.code === 'ECONNABORTED';

      if (!isRecoverable) throw e;

      logger.warn(
        `Open-Meteo primary failed (status=${status ?? 'timeout'}), ` +
          `falling back to Bright Sky mirror`
      );
      try {
        const bsData = await this.fetchBrightSky(lat, lng);
        return {
          ...bsData,
          source: 'Deutscher Wetterdienst (DWD) via Bright Sky',
        };
      } catch (bsErr) {
        const bsMsg = bsErr instanceof Error ? bsErr.message : String(bsErr);
        logger.error(`Bright Sky fallback also failed: ${bsMsg}`);
        // Original Open-Meteo-Error werfen — Detail-String ist aussagekräftiger
        // als "Bright Sky ECONNREFUSED" (zeigt Original-Provider + Status an).
        throw e;
      }
    }
  }

  // -------------------------------------------------------------------------
  // fetchOpenMeteo — Primary Mirror mit Retry-Backoff (MAX_RETRIES=2)
  // -------------------------------------------------------------------------

  private async fetchOpenMeteo(
    lat: number,
    lng: number
  ): Promise<{
    current: CurrentWeather & { hourly: HourlyForecast[] };
    hourly: HourlyForecast[];
    daily: DailyForecast[];
  }> {
    const params = {
      latitude: lat,
      longitude: lng,
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'weather_code',
        'surface_pressure',
        'wind_speed_10m',
        'wind_direction_10m',
        'precipitation',
        'cloud_cover',
        'uv_index',
      ].join(','),
      hourly: [
        'temperature_2m',
        'precipitation',
        'weather_code',
        'wind_speed_10m',
      ].join(','),
      daily: [
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'precipitation_probability_max',
        'weather_code',
        'wind_speed_10m_max',
        'sunrise',
        'sunset',
      ].join(','),
      forecast_hours: 24,
      forecast_days: 7,
      timezone: 'Europe/Berlin',
    };

    // Retry-Logik mit exponenziellem Backoff bei 429 (Rate Limit).
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.http.get(`${this.baseUrl}/forecast`, {
          params,
          headers: { 'User-Agent': this.userAgent },
          timeout: 15000,
        });
        return this.parseResponse(response.data);
      } catch (e: unknown) {
        lastError = e instanceof Error ? e : new Error(String(e));
        const axiosError = e as { response?: { status?: number } };
        const status = axiosError.response?.status;
        if (status === 429 && attempt < this.maxRetries) {
          const waitMs = Math.min(1000 * Math.pow(2, attempt), 3000);
          logger.warn(
            `Open-Meteo 429 (attempt ${attempt}/${this.maxRetries}), retrying in ${waitMs}ms`
          );
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        break;
      }
    }
    throw lastError || new Error('Open-Meteo request failed');
  }

  // -------------------------------------------------------------------------
  // fetchBrightSky — Fallback Mirror (DWD-Proxy, kein API-Key, CC-BY 4.0)
  //
  // Bright Sky hat 2 separate Endpoints:
  //   - /current_weather                — aktuelle Bedingungen
  //   - /weather?date=&last_date=       — flaches Hourly-Array
  //
  // Beide PARALLEL via Promise.all (~150-300ms Round-Trip).
  //
  // Aggregationen aus dem flachen Hourly-Array:
  //   - temperatureMax/Min/precipSum: gruppieren by date, daily aggregieren
  //   - windSpeedMax: max(wind_gust_speed_10), Fallback max(wind_speed_10)
  //     (GUST ist entscheidend für STURM-Alert — wind_speed_10 ist Mittelwert)
  //   - precipitationProbability: Heuristik (Tages-Summe → 80%/50%/0%)
  //     Bright Sky liefert keine echte Wahrscheinlichkeit wie Open-Meteo's
  //     precipitation_probability_max, aber für UI-Warnbanner ausreichend.
  //   - weatherCode: Modus der hourly-Conditions → WMO (siehe Map oben)
  //   - UV/Sunrise/Sunset: Bright Sky hat das nicht → 0 / leere Strings
  //     Mobile DTOs behandeln das defensiv (siehe weather_dto.dart).
  // -------------------------------------------------------------------------

  private async fetchBrightSky(
    lat: number,
    lng: number
  ): Promise<{
    current: CurrentWeather & { hourly: HourlyForecast[] };
    hourly: HourlyForecast[];
    daily: DailyForecast[];
  }> {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const nextWeek = new Date(today.getTime() + 7 * 86400000);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    const [currRes, forecastRes] = await Promise.all([
      this.http.get(`${this.brightSkyBase}/current_weather`, {
        params: { lat, lon: lng },
        headers: { 'User-Agent': this.userAgent },
        timeout: 15000,
      }),
      this.http.get(`${this.brightSkyBase}/weather`, {
        params: { lat, lon: lng, date: todayStr, last_date: nextWeekStr },
        headers: { 'User-Agent': this.userAgent },
        timeout: 20000,
      }),
    ]);

    const cw = currRes.data?.weather ?? {};
    const fw: any[] = Array.isArray(forecastRes.data?.weather)
      ? forecastRes.data.weather
      : [];

    if (fw.length === 0) {
      throw new Error('Bright Sky /weather liefert leeres Hourly-Array');
    }

    // Hourly: erste 24 Einträge (Mobile-UI-Stundenleiste).
    const hourly: HourlyForecast[] = fw.slice(0, 24).map((h: any) => ({
      time: String(h.timestamp),
      temperature: h.temperature ?? 0,
      precipitation:
        h.precipitation_60 ?? h.precipitation_30 ?? h.precipitation_10 ?? 0,
      weatherCode: BRIGHTSKY_CONDITION_TO_WMO[h.condition] ?? 0,
      windSpeed: h.wind_speed_10 ?? 0,
    }));

    // Daily: flaches Hourly-Array by date aggregieren.
    type DailyAgg = {
      minTemp: number;
      maxTemp: number;
      precipSum: number;
      windSpeedMax: number;
      conditions: string[];
    };
    const dailyMap = new Map<string, DailyAgg>();
    for (const h of fw) {
      const ts = String(h.timestamp ?? '');
      const date = ts.substring(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const precip =
        h.precipitation_60 ?? h.precipitation_30 ?? h.precipitation_10 ?? 0;
      // GUST-Speed ist relevant für STURM-Alert — Fallback auf Avg-Speed.
      const windNow = h.wind_gust_speed_10 ?? h.wind_speed_10 ?? 0;
      const cond = String(h.condition ?? 'dry');

      const existing = dailyMap.get(date);
      if (!existing) {
        dailyMap.set(date, {
          minTemp: h.temperature ?? 0,
          maxTemp: h.temperature ?? 0,
          precipSum: precip,
          windSpeedMax: windNow,
          conditions: [cond],
        });
      } else {
        existing.minTemp = Math.min(existing.minTemp, h.temperature ?? existing.minTemp);
        existing.maxTemp = Math.max(existing.maxTemp, h.temperature ?? existing.maxTemp);
        existing.precipSum += precip;
        existing.windSpeedMax = Math.max(existing.windSpeedMax, windNow);
        existing.conditions.push(cond);
      }
    }

    // Modus (häufigster Wert) der hourly Conditions pro Tag.
    // Tie-Break: hail > thunderstorm > snow > sleet > rain > fog > cloudy > dry
    // (Hagel ist gefährlicher als Gewitter ohne Hagel → bei Gleichstand Hagel priorisieren.
    //  Range frei wählbar; Determinismus ist das wichtige Kriterium.)
    const SEVERITY_RANK: Record<string, number> = {
      hail: 8, thunderstorm: 7, snow: 6, sleet: 5, rain: 4,
      fog: 2, cloudy: 1, dry: 0,
    };
    const modeCondition = (arr: string[]): string => {
      if (!arr.length) return 'dry';
      const counts: Record<string, number> = {};
      for (const c of arr) counts[c] = (counts[c] ?? 0) + 1;
      let best = 'dry';
      let bestN = 0;
      for (const [k, v] of Object.entries(counts)) {
        if (
          v > bestN ||
          (v === bestN && (SEVERITY_RANK[k] ?? 0) > (SEVERITY_RANK[best] ?? 0))
        ) {
          best = k;
          bestN = v;
        }
      }
      return best;
    };

    const daily: DailyForecast[] = Array.from(dailyMap.entries()).map(
      ([date, stats]) => {
        const dominantCond = modeCondition(stats.conditions);
        const wmoCode = BRIGHTSKY_CONDITION_TO_WMO[dominantCond] ?? 0;
        return {
          date,
          temperatureMax: stats.maxTemp,
          temperatureMin: stats.minTemp,
          precipitationSum: stats.precipSum,
          // Heuristik: Bright Sky hat keine echte Wahrscheinlichkeit.
          // Schwellen: >1mm → 80%, >0.1mm → 50%, sonst 0%.
          precipitationProbability:
            stats.precipSum > 1 ? 80 : stats.precipSum > 0.1 ? 50 : 0,
          weatherCode: wmoCode,
          weatherText: wmoToText(wmoCode),
          windSpeedMax: stats.windSpeedMax,
          sunrise: '',
          sunset: '',
        };
      }
    );

    const currentWmo = BRIGHTSKY_CONDITION_TO_WMO[cw.condition] ?? 0;
    return {
      current: {
        temperature: cw.temperature ?? 0,
        feelsLike: cw.temperature ?? 0,  // Bright Sky hat kein apparent_temperature
        humidity: cw.relative_humidity ?? 0,
        pressure: cw.pressure_msl ?? 0,
        windSpeed: cw.wind_speed_10 ?? 0,
        windDirection: cw.wind_direction_10 ?? 0,
        weatherCode: currentWmo,
        weatherText: wmoToText(currentWmo),
        precipitation:
          cw.precipitation_60 ?? cw.precipitation_30 ?? cw.precipitation_10 ?? 0,
        cloudCover: cw.cloud_cover ?? 0,
        uvIndex: 0,  // Bright Sky liefert keine UV-Daten
        hourly,
      },
      hourly,
      daily,
    };
  }

  private parseResponse(d: any): {
    current: CurrentWeather & { hourly: HourlyForecast[] };
    hourly: HourlyForecast[];
    daily: DailyForecast[];
  } {
    const c = d.current;

    // Stündliche Vorhersage parsen
    const hourly: HourlyForecast[] = [];
    if (d.hourly) {
      for (let i = 0; i < Math.min(24, d.hourly.time?.length || 0); i++) {
        hourly.push({
          time: d.hourly.time[i],
          temperature: d.hourly.temperature_2m[i],
          precipitation: d.hourly.precipitation[i] ?? 0,
          weatherCode: d.hourly.weather_code[i] ?? 0,
          windSpeed: d.hourly.wind_speed_10m[i] ?? 0,
        });
      }
    }

    // 7-Tage-Vorhersage parsen
    const daily: DailyForecast[] = [];
    if (d.daily) {
      for (let i = 0; i < (d.daily.time?.length || 0); i++) {
        daily.push({
          date: d.daily.time[i],
          temperatureMax: d.daily.temperature_2m_max[i],
          temperatureMin: d.daily.temperature_2m_min[i],
          precipitationSum: d.daily.precipitation_sum[i] ?? 0,
          precipitationProbability: d.daily.precipitation_probability_max[i] ?? 0,
          weatherCode: d.daily.weather_code[i] ?? 0,
          weatherText: wmoToText(d.daily.weather_code[i]),
          windSpeedMax: d.daily.wind_speed_10m_max[i] ?? 0,
          sunrise: d.daily.sunrise[i] || '',
          sunset: d.daily.sunset[i] || '',
        });
      }
    }

    return {
      current: {
        temperature: c.temperature_2m,
        feelsLike: c.apparent_temperature,
        humidity: c.relative_humidity_2m,
        pressure: c.surface_pressure,
        windSpeed: c.wind_speed_10m,
        windDirection: c.wind_direction_10m,
        weatherCode: c.weather_code,
        weatherText: wmoToText(c.weather_code),
        precipitation: c.precipitation ?? 0,
        cloudCover: c.cloud_cover ?? 0,
        uvIndex: c.uv_index ?? 0,
        hourly,
      },
      hourly,
      daily,
    };
  }

  // ---------------------------------------------------------------------------
  // reverseGeocode — Koordinaten -> Ortsname via Nominatim
  // ---------------------------------------------------------------------------

  private async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const response = await this.http.get(
        `${this.nominatimUrl}/reverse`,
        {
          params: { lat, lon: lng, format: 'json', zoom: 10, 'accept-language': 'de' },
          headers: { 'User-Agent': this.userAgent },
          timeout: 5000,
        }
      );
      const addr = response.data?.address;
      if (addr) {
        return addr.city || addr.town || addr.village || addr.county || addr.state || `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
      }
      return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
    } catch {
      return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
    }
  }

  // ---------------------------------------------------------------------------
  // getIconUrl — Wetter-Icon als Emoji (keine externen Assets nötig)
  // ---------------------------------------------------------------------------

  getIconForCode(code: number): string {
    return wmoToIcon(code);
  }

  getTextForCode(code: number): string {
    return wmoToText(code);
  }
}

export const weatherService = new WeatherService();
