import { logger } from '../utils/logger';
import axios from 'axios';

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

export class WeatherService {
  private readonly baseUrl = 'https://api.open-meteo.com/v1';
  private readonly userAgent = 'HEIMAT-App/1.0 (https://github.com/abatn/HEIMAT)';
  private readonly cache = new Map<string, { data: WeatherData; at: number }>();
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 Minuten

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
      source: 'Deutscher Wetterdienst (DWD) via Open-Meteo',
    };

    this.cache.set(cacheKey, { data: weather, at: Date.now() });
    return weather;
  }

  // ---------------------------------------------------------------------------
  // fetchAll — EIN Open-Meteo-Request: current + hourly + daily
  // ---------------------------------------------------------------------------

  private async fetchAll(lat: number, lng: number): Promise<{
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

    const response = await axios.get(`${this.baseUrl}/forecast`, {
      params,
      headers: { 'User-Agent': this.userAgent },
      timeout: 15000,
    });

    const d = response.data;
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
      const response = await axios.get(
        'https://nominatim.openstreetmap.org/reverse',
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
