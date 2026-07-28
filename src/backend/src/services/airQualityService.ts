import { logger } from '../utils/logger';
import { externalServices } from '../config/externalServices';
import axios from 'axios';

// ---------------------------------------------------------------------------
// AirQualityService — Ruft Luftqualitätsdaten von Open-Meteo ab.
// Open-Meteo Air Quality API (https://open-meteo.com/en/docs/air-quality-api)
// nutzt CAMS (Copernicus Atmosphere Monitoring Service) als Datenquelle.
// Kostenlos, kein API-Key, CC-BY 4.0 (Namensnennung erforderlich).
// ---------------------------------------------------------------------------

export interface CurrentAirQuality {
  europeanAqi: number | null;
  pm10: number | null;
  pm25: number | null;
  nitrogenDioxide: number | null;
  ozone: number | null;
  carbonMonoxide: number | null;
  sulphurDioxide: number | null;
  aqiLevel: string;
  aqiColor: string;
}

export interface HourlyAirQuality {
  time: string;
  europeanAqi: number | null;
  pm10: number | null;
  pm25: number | null;
  nitrogenDioxide: number | null;
  ozone: number | null;
}

export interface AirQualityData {
  location: { lat: number; lng: number; name: string };
  current: CurrentAirQuality;
  hourly: HourlyAirQuality[];
  source: string;
}

// EAQI (European Air Quality Index) Level → Text/Color
const EAQI_LEVELS: { min: number; max: number; level: string; color: string }[] = [
  { min: 0, max: 20, level: 'Sehr gut', color: '#1bc81b' },
  { min: 20, max: 40, level: 'Gut', color: '#3ea83e' },
  { min: 40, max: 60, level: 'Mäßig', color: '#a8a83e' },
  { min: 60, max: 80, level: 'Ungesund', color: '#ff9933' },
  { min: 80, max: 100, level: 'Sehr ungesund', color: '#ff3333' },
  { min: 100, max: Infinity, level: 'Gefährlich', color: '#990000' },
];

function getAqiInfo(aqi: number | null): { level: string; color: string } {
  if (aqi === null || aqi === undefined) return { level: 'Unbekannt', color: '#888' };
  const found = EAQI_LEVELS.find(l => aqi >= l.min && aqi < l.max);
  return found ? { level: found.level, color: found.color } : { level: 'Unbekannt', color: '#888' };
}

export class AirQualityService {
  // Phase X.3a: URLs aus externalServices-Registry (env-var-driven + defaults).
  // 1:1 mirror-pattern zu mobility + weather + evCharging.
  private readonly baseUrl = externalServices.openAirQualityUrl;
  private readonly userAgent = externalServices.userAgent;
  private readonly nominatimUrl = externalServices.nominatimUrl;
  private readonly cache = new Map<string, { data: AirQualityData; at: number }>();
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 Minuten

  // ---------------------------------------------------------------------------
  // getAirQuality — öffentliche API
  // ---------------------------------------------------------------------------

  async getAirQuality(lat: number, lng: number): Promise<AirQualityData> {
    const cacheKey = `${lat.toFixed(2)}|${lng.toFixed(2)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.at < this.cacheTtlMs) {
      return cached.data;
    }

    const [openMeteoData, locationName] = await Promise.all([
      this.fetchAll(lat, lng),
      this.reverseGeocode(lat, lng).catch(() => `${lat.toFixed(2)}, ${lng.toFixed(2)}`),
    ]);

    const airQuality: AirQualityData = {
      location: { lat, lng, name: locationName },
      current: openMeteoData.current,
      hourly: openMeteoData.hourly,
      source: 'Copernicus Atmosphere Monitoring Service (CAMS) via Open-Meteo',
    };

    this.cache.set(cacheKey, { data: airQuality, at: Date.now() });
    return airQuality;
  }

  // ---------------------------------------------------------------------------
  // fetchAll — EIN Open-Meteo-Request: current + hourly
  // ---------------------------------------------------------------------------

  private readonly maxRetries = 3;

  private async fetchAll(lat: number, lng: number): Promise<{
    current: CurrentAirQuality;
    hourly: HourlyAirQuality[];
  }> {
    const params = {
      latitude: lat,
      longitude: lng,
      current: [
        'european_aqi',
        'pm10',
        'pm2_5',
        'nitrogen_dioxide',
        'ozone',
        'carbon_monoxide',
        'sulphur_dioxide',
      ].join(','),
      hourly: [
        'european_aqi',
        'pm10',
        'pm2_5',
        'nitrogen_dioxide',
        'ozone',
      ].join(','),
      forecast_hours: 24,
      timezone: 'Europe/Berlin',
    };

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.get(`${this.baseUrl}/air-quality`, {
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
          const waitMs = Math.min(1000 * Math.pow(2, attempt), 5000);
          logger.warn(`Open-Meteo AQ 429 (attempt ${attempt}/${this.maxRetries}), retrying in ${waitMs}ms`);
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        break;
      }
    }
    throw lastError || new Error('Open-Meteo Air Quality request failed');
  }

  private parseResponse(d: any): {
    current: CurrentAirQuality;
    hourly: HourlyAirQuality[];
  } {
    const c = d.current;

    // Aktuelle Werte
    const current: CurrentAirQuality = {
      europeanAqi: c?.european_aqi ?? null,
      pm10: c?.pm10 ?? null,
      pm25: c?.pm2_5 ?? null,
      nitrogenDioxide: c?.nitrogen_dioxide ?? null,
      ozone: c?.ozone ?? null,
      carbonMonoxide: c?.carbon_monoxide ?? null,
      sulphurDioxide: c?.sulphur_dioxide ?? null,
      aqiLevel: getAqiInfo(c?.european_aqi ?? null).level,
      aqiColor: getAqiInfo(c?.european_aqi ?? null).color,
    };

    // Stündliche Werte
    const hourly: HourlyAirQuality[] = [];
    if (d.hourly) {
      for (let i = 0; i < Math.min(24, d.hourly.time?.length || 0); i++) {
        hourly.push({
          time: d.hourly.time[i],
          europeanAqi: d.hourly.european_aqi?.[i] ?? null,
          pm10: d.hourly.pm10?.[i] ?? null,
          pm25: d.hourly.pm2_5?.[i] ?? null,
          nitrogenDioxide: d.hourly.nitrogen_dioxide?.[i] ?? null,
          ozone: d.hourly.ozone?.[i] ?? null,
        });
      }
    }

    return { current, hourly };
  }

  // ---------------------------------------------------------------------------
  // reverseGeocode — Koordinaten -> Ortsname via Nominatim
  // ---------------------------------------------------------------------------

  private async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const response = await axios.get(
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

  getAqiInfo(aqi: number | null): { level: string; color: string } {
    return getAqiInfo(aqi);
  }
}

export const airQualityService = new AirQualityService();
