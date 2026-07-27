// ---------------------------------------------------------------------------
// weatherService.test.ts — Mirror-Fallback Regressions-Test (Phase E Real-Fix)
//
// Verifiziert den Open-Meteo → Bright Sky Fallback-Pfad, der den realen
// Bug (Render-Shared-IP wird von Open-Meteo mit HTTP 429 rate-limited)
// robust löst.
//
// Test-Strategie: KEIN jest.mock('axios'). Statt dessen Constructor DI
// — `new WeatherService(mockHttp)` mit explizit typisiertem Mock-HTTP.
//
// SCHLÜSSEL-DETAIL: setupRoutes() nutzt URL-basiertes Routing statt
// FIFO-Queue (mockResolvedValueOnce). Grund: getWeather() macht
// `Promise.all([fetchAll, reverseGeocode])` → 2 CONCURRENT http.get-Calls
// im Round-Trip. Bei FIFO-Queue können die Calls die Responses in
// falscher Reihenfolge konsumieren (z.B. ein Open-Meteo-Mock landet
// bei reverseGeocode). URL-Routing macht jeden Call deterministisch.
//
// 10 Tests in 3 Describe-Blöcken:
//   A. Mirror-Fallback (5) — Open-Meteo ↔ Bright Sky Failure-Handling
//   B. Bright Sky Daily-Aggregation (4) — Modus, Gust-Priority, 2× Tie-Break
//   C. Cache-Policy (1) — 5-Min-TTL verhindert doppelte HTTP-Calls
// ---------------------------------------------------------------------------

import { AxiosInstance } from 'axios';
import { WeatherService } from '../services/weatherService';
import { generateAlerts } from '../services/weatherAlertsService';

// ---------------------------------------------------------------------------
// Test-Fixtures — reale DWD/Nominatim-Response-Shapes (gekürzt)
// ---------------------------------------------------------------------------

const OPENMETEO_OK = {
  data: {
    current: {
      temperature_2m: 20,
      relative_humidity_2m: 60,
      apparent_temperature: 19,
      weather_code: 0,
      surface_pressure: 1015,
      wind_speed_10m: 10,
      wind_direction_10m: 270,
      precipitation: 0,
      cloud_cover: 20,
      uv_index: 4,
    },
    hourly: {
      time: ['2026-07-27T14:00', '2026-07-27T15:00', '2026-07-27T16:00'],
      temperature_2m: [20, 21, 22],
      precipitation: [0, 0, 0],
      weather_code: [0, 0, 1],
      wind_speed_10m: [10, 11, 12],
    },
    daily: {
      time: ['2026-07-27', '2026-07-28'],
      temperature_2m_max: [25, 27],
      temperature_2m_min: [15, 17],
      precipitation_sum: [0, 2.5],
      precipitation_probability_max: [0, 60],
      weather_code: [0, 1],
      wind_speed_10m_max: [15, 20],
      sunrise: ['2026-07-27T05:30', '2026-07-28T05:31'],
      sunset: ['2026-07-27T21:00', '2026-07-28T20:59'],
    },
  },
};

const NOMINATIM_OK = {
  data: {
    address: {
      city: 'Berlin',
      country: 'Deutschland',
    },
  },
};

const BRIGHTSKY_CURRENT_OK = {
  data: {
    weather: {
      temperature: 18,
      condition: 'rain',
      relative_humidity: 80,
      pressure_msl: 1010,
      wind_speed_10: 15,
      wind_direction_10: 270,
      precipitation_60: 2.3,
      precipitation_30: 1.1,
      precipitation_10: 0.4,
      cloud_cover: 75,
    },
  },
};

const BRIGHTSKY_HOURLY_OK = {
  data: {
    weather: [
      {
        timestamp: '2026-07-27T14:00:00+00:00',
        temperature: 18,
        condition: 'rain',
        wind_speed_10: 14,
        wind_gust_speed_10: 22,
        precipitation_60: 1.2,
        precipitation_30: 0.6,
        precipitation_10: 0.2,
      },
      {
        timestamp: '2026-07-27T15:00:00+00:00',
        temperature: 17,
        condition: 'rain',
        wind_speed_10: 18,
        wind_gust_speed_10: 28,
        precipitation_60: 2.0,
        precipitation_30: 1.0,
        precipitation_10: 0.3,
      },
      {
        timestamp: '2026-07-27T16:00:00+00:00',
        temperature: 16,
        condition: 'cloudy',
        wind_speed_10: 12,
        wind_gust_speed_10: 15,
        precipitation_60: 0,
        precipitation_30: 0,
        precipitation_10: 0,
      },
      {
        timestamp: '2026-07-28T00:00:00+00:00',
        temperature: 14,
        condition: 'rain',
        wind_speed_10: 8,
        wind_gust_speed_10: 10,
        precipitation_60: 0.5,
      },
    ],
  },
};

// AxiosError-ähnliche Errors. fetchOpenMeteo prüft `e instanceof Error` —
// plain-object-Rejections verlieren die Semantik und würden zu
// `new Error("[object Object]")` führen.
function mkAxiosErr(status: number): Error {
  const err: any = new Error(`Request failed with status code ${status}`);
  err.response = { status, headers: {} };
  err.isAxiosError = true;
  return err as Error;
}

// URL-basiertes Mock-Routing für deterministische Response-Distribution
// über die Promise.all-getriebenen concurrent http.get-Calls.
function setupRoutes(routes: Array<{ match: (url: string) => boolean; response: any }>) {
  mockHttp.get.mockImplementation((urlAny: any) => {
    const url = String(urlAny);
    const route = routes.find((r) => r.match(url));
    if (!route) {
      return Promise.reject(
        new Error(`No mock route registered for URL: ${url}`)
      );
    }
    return route.response instanceof Error
      ? Promise.reject(route.response)
      : Promise.resolve(route.response);
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mockHttp: jest.Mocked<AxiosInstance>;
let service: WeatherService;

beforeEach(() => {
  mockHttp = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
  } as unknown as jest.Mocked<AxiosInstance>;
  service = new WeatherService(mockHttp);
});

// ---------------------------------------------------------------------------
// A. Mirror-Fallback-Pattern
// ---------------------------------------------------------------------------

describe('WeatherService — Mirror-Fallback-Pattern', () => {
  it('Test 1: Happy-Path — Open-Meteo 200, source=Open-Meteo, Bright Sky NICHT aufgerufen', async () => {
    setupRoutes([
      { match: (u) => u.includes('api.open-meteo.com'), response: OPENMETEO_OK },
      { match: (u) => u.includes('nominatim.openstreetmap.org'), response: NOMINATIM_OK },
    ]);

    const data = await service.getWeather(52.52, 13.41);

    expect(data.source).toBe('Deutscher Wetterdienst (DWD) via Open-Meteo');
    expect(data.current.temperature).toBe(20);
    expect(data.current.weatherCode).toBe(0);
    expect(data.location.name).toBe('Berlin'); // aus Nominatim
    expect(data.daily).toHaveLength(2);
    expect(data.daily[0].temperatureMax).toBe(25);
    // Genau 2 http.get-Calls (Open-Meteo + nominatim reverse, parallel)
    expect(mockHttp.get).toHaveBeenCalledTimes(2);
    const calledUrls = mockHttp.get.mock.calls.map((c) => String(c[0]));
    expect(calledUrls.some((u) => u.includes('api.brightsky.dev'))).toBe(false);
  });

  it('Test 2: 429-Rate-Limit — Open-Meteo 429 → Bright Sky Fallback greift', async () => {
    setupRoutes([
      // Round-1 (Promise.all): fetchOpenMeteo attempt1 + reverseGeocode. Beide 429.
      { match: (u) => u.includes('api.open-meteo.com/v1/forecast'), response: mkAxiosErr(429) },
      { match: (u) => u.includes('nominatim.openstreetmap.org'), response: mkAxiosErr(429) },
      // Round-2: fetchOpenMeteo retry (attempt 2).
      { match: (u) => u.includes('api.open-meteo.com/v1/forecast'), response: mkAxiosErr(429) },
      // Round-3 (Bright Sky Promise.all): /current_weather + /weather parallel.
      { match: (u) => u.includes('api.brightsky.dev/current_weather'), response: BRIGHTSKY_CURRENT_OK },
      { match: (u) => u.includes('api.brightsky.dev/weather'), response: BRIGHTSKY_HOURLY_OK },
    ]);

    const data = await service.getWeather(52.52, 13.41);

    expect(data.source).toBe('Deutscher Wetterdienst (DWD) via Bright Sky');
    expect(data.current.weatherCode).toBe(63); // 'rain' → WMO 63
    expect(data.current.temperature).toBe(18);
    expect(data.current.feelsLike).toBe(18); // Bright Sky Approximation
    expect(data.current.uvIndex).toBe(0); // Bright Sky hat keine UV-Daten
    // 5 Calls total: 1 OM attempt + 1 reverse + 1 OM retry + 2 BS parallel
    expect(mockHttp.get).toHaveBeenCalledTimes(5);
    const calledUrls = mockHttp.get.mock.calls.map((c) => String(c[0]));
    expect(calledUrls.some((u) => u.includes('api.brightsky.dev/current_weather'))).toBe(true);
    expect(calledUrls.some((u) => u.includes('api.brightsky.dev/weather'))).toBe(true);
  });

  it('Test 3: 5xx-Server-Fehler — Open-Meteo 503 → Bright Sky Fallback greift', async () => {
    // WICHTIG: 5xx KEIN Retry (Retry-Loop prüft `status === 429 &&
    // attempt < maxRetries` — 503 bricht sofort aus). 1 Open-Meteo-Call +
    // 1 nominatim (round-1 Promise.all) + 2 Bright Sky-Parallel-Calls = 4.
    setupRoutes([
      { match: (u) => u.includes('api.open-meteo.com/v1/forecast'), response: mkAxiosErr(503) },
      { match: (u) => u.includes('nominatim.openstreetmap.org'), response: NOMINATIM_OK },
      { match: (u) => u.includes('api.brightsky.dev/current_weather'), response: BRIGHTSKY_CURRENT_OK },
      { match: (u) => u.includes('api.brightsky.dev/weather'), response: BRIGHTSKY_HOURLY_OK },
    ]);

    const data = await service.getWeather(52.52, 13.41);
    expect(data.source).toBe('Deutscher Wetterdienst (DWD) via Bright Sky');
    expect(data.current.weatherCode).toBe(63);
    // 4 Calls: 1 OM (kein 503-Retry) + 1 nominatim + 2 BS parallel
    expect(mockHttp.get).toHaveBeenCalledTimes(4);
  });

  it('Test 4: Both-Fail — Beide Mirrors fehl → throws, Open-Meteo-Detail erhalten', async () => {
    setupRoutes([
      { match: (u) => u.includes('api.open-meteo.com/v1/forecast'), response: mkAxiosErr(429) },
      { match: (u) => u.includes('nominatim.openstreetmap.org'), response: NOMINATIM_OK },
      { match: (u) => u.includes('api.open-meteo.com/v1/forecast'), response: mkAxiosErr(429) },
      { match: (u) => u.includes('api.brightsky.dev/current_weather'), response: new Error('Bright Sky ECONNREFUSED') },
      { match: (u) => u.includes('api.brightsky.dev/weather'), response: new Error('Bright Sky TIMEOUT') },
    ]);

    let caught: unknown;
    try {
      await service.getWeather(52.52, 13.41);
      fail('Sollte geworfen haben, hat aber resolved');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    const msg = caught instanceof Error ? caught.message : String(caught);
    // Original Open-Meteo-Detail (429) wird geworfen, NICHT Bright Sky-Error
    expect(msg).toContain('429');
    expect(msg).not.toContain('Bright Sky');
  });

  it('Test 5: 4xx-Non-Recoverable — Open-Meteo 400 → KEIN Fallback', async () => {
    setupRoutes([
      { match: (u) => u.includes('api.open-meteo.com/v1/forecast'), response: mkAxiosErr(400) },
      { match: (u) => u.includes('nominatim.openstreetmap.org'), response: NOMINATIM_OK },
    ]);

    await expect(service.getWeather(999, 999)).rejects.toThrow();
    // 2 Calls (Open-Meteo + nominatim parallel), KEIN Bright Sky
    expect(mockHttp.get).toHaveBeenCalledTimes(2);
    const calledUrls = mockHttp.get.mock.calls.map((c) => String(c[0]));
    expect(calledUrls.some((u) => u.includes('api.brightsky.dev'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// B. Bright Sky Daily-Aggregation
// ---------------------------------------------------------------------------

describe('WeatherService — Bright Sky Daily-Aggregation', () => {
  it('Tmin/Tmax/PrecipSum/WindSpeedMax korrekt aus flat-Hourly aggregiert', async () => {
    setupRoutes([
      { match: (u) => u.includes('api.open-meteo.com/v1/forecast'), response: mkAxiosErr(429) },
      { match: (u) => u.includes('nominatim.openstreetmap.org'), response: NOMINATIM_OK },
      { match: (u) => u.includes('api.open-meteo.com/v1/forecast'), response: mkAxiosErr(429) },
      { match: (u) => u.includes('api.brightsky.dev/current_weather'), response: BRIGHTSKY_CURRENT_OK },
      { match: (u) => u.includes('api.brightsky.dev/weather'), response: BRIGHTSKY_HOURLY_OK },
    ]);

    const data = await service.getWeather(52.52, 13.41);

    expect(data.daily.length).toBeGreaterThan(0);
    const day1 = data.daily.find((d) => d.date === '2026-07-27');
    expect(day1).toBeDefined();
    expect(day1!.temperatureMin).toBe(16);
    expect(day1!.temperatureMax).toBe(18);
    expect(day1!.precipitationSum).toBeCloseTo(3.2, 1);
    // WindSpeedMax = max(22, 28, 15) = 28 (GUST hat Vorrang vor AVG)
    expect(day1!.windSpeedMax).toBe(28);
    // Modus der conditions: 2x 'rain' + 1x 'cloudy' = 'rain' → WMO 63
    expect(day1!.weatherCode).toBe(63);
    expect(day1!.weatherText).toBe('Mäßiger Regen');
    // Heuristik: 3.2mm > 1mm → 80%
    expect(day1!.precipitationProbability).toBe(80);
    expect(day1!.sunrise).toBe('');
    expect(day1!.sunset).toBe('');
  });

  it('GUST-Speed für STURM-Alert genutzt (Windspitze 65 km/h triggert Alert)', async () => {
    setupRoutes([
      { match: (u) => u.includes('api.open-meteo.com/v1/forecast'), response: mkAxiosErr(500) },
      { match: (u) => u.includes('nominatim.openstreetmap.org'), response: NOMINATIM_OK },
      { match: (u) => u.includes('api.open-meteo.com/v1/forecast'), response: mkAxiosErr(500) },
                     { match: (u) => u.includes('api.brightsky.dev/current_weather'), response: { data: { weather: { temperature: 15, condition: 'rain', wind_speed_10: 18, wind_gust_speed_10: 65 } } } },
                  {
                    match: (u) => u.includes('api.brightsky.dev/weather'),
                    response: {
                      data: {
                        weather: [
                          { timestamp: '2026-07-27T14:00:00+00:00', temperature: 15, condition: 'rain', wind_speed_10: 18, wind_gust_speed_10: 65, precipitation_60: 0.5 },
                        ],
                      },
                    },
                  },
    ]);

    const data = await service.getWeather(52.52, 13.41);
    const alerts = generateAlerts(data);
    const sturm = alerts.find((a) => a.code === 'sturm');
    expect(sturm).toBeDefined();
    expect(sturm!.metric!.value).toBe('65');
  });

  it('Condition-Modus-Tie-Break: thunderstorm (rank 7) > cloudy (rank 1) on 8:8-Tie', async () => {
    setupRoutes([
      { match: (u) => u.includes('api.open-meteo.com/v1/forecast'), response: mkAxiosErr(429) },
      { match: (u) => u.includes('nominatim.openstreetmap.org'), response: NOMINATIM_OK },
      { match: (u) => u.includes('api.open-meteo.com/v1/forecast'), response: mkAxiosErr(429) },
      { match: (u) => u.includes('api.brightsky.dev/current_weather'), response: { data: { weather: { temperature: 20, condition: 'thunderstorm' } } } },
      {
        match: (u) => u.includes('api.brightsky.dev/weather'),
        response: {
          data: {
            weather: [
              ...Array.from({ length: 8 }, () => ({
                timestamp: '2026-07-27T00:00:00+00:00',
                temperature: 20,
                condition: 'cloudy',
                wind_speed_10: 10,
                precipitation_60: 0,
              })),
              ...Array.from({ length: 8 }, (_, i) => ({
                timestamp: `2026-07-27T0${i + 1}:00:00+00:00`,
                temperature: 20,
                condition: 'thunderstorm',
                wind_speed_10: 15,
                precipitation_60: 1.0,
              })),
            ],
          },
        },
      },
    ]);

    const data = await service.getWeather(52.52, 13.41);
    const day = data.daily.find((d) => d.date === '2026-07-27')!;
    expect(day.weatherCode).toBe(95);
    expect(day.weatherText).toBe('Gewitter');
  });

  it('Condition-Modus-Tie-Break: hail (rank 8) > thunderstorm (rank 7) on 7:7-Tie', async () => {
    // Der entscheidende Determinismus-Test: hail gewinnt gegen thunderstorm
    // weil hail im SEVERITY_RANK explizit höher ist (8 > 7).
    setupRoutes([
      { match: (u) => u.includes('api.open-meteo.com/v1/forecast'), response: mkAxiosErr(429) },
      { match: (u) => u.includes('nominatim.openstreetmap.org'), response: NOMINATIM_OK },
      { match: (u) => u.includes('api.open-meteo.com/v1/forecast'), response: mkAxiosErr(429) },
      { match: (u) => u.includes('api.brightsky.dev/current_weather'), response: { data: { weather: { temperature: 15, condition: 'hail' } } } },
      {
        match: (u) => u.includes('api.brightsky.dev/weather'),
        response: {
          data: {
            weather: [
              ...Array.from({ length: 7 }, () => ({
                timestamp: '2026-07-27T00:00:00+00:00',
                temperature: 15,
                condition: 'hail',
                wind_speed_10: 10,
                precipitation_60: 1.0,
              })),
              ...Array.from({ length: 7 }, (_, i) => ({
                timestamp: `2026-07-27T0${i + 1}:00:00+00:00`,
                temperature: 15,
                condition: 'thunderstorm',
                wind_speed_10: 15,
                precipitation_60: 2.0,
              })),
            ],
          },
        },
      },
    ]);

    const data = await service.getWeather(52.52, 13.41);
    const day = data.daily.find((d) => d.date === '2026-07-27')!;
    // hail mappt zu WMO 96 (Gewitter mit leichtem Hagel), thunderstorm zu 95.
    // Tie-Break über SEVERITY_RANK → hail gewinnt.
    expect(day.weatherCode).toBe(96);
  });
});

// ---------------------------------------------------------------------------
// C. Cache-Policy (5-Min TTL)
// ---------------------------------------------------------------------------

describe('WeatherService — Cache-Policy (5-Min TTL)', () => {
  it('Zweites getWeather() innerhalb 5 Min ruft KEINen weiteren HTTP-Call', async () => {
    setupRoutes([
      { match: (u) => u.includes('api.open-meteo.com/v1/forecast'), response: OPENMETEO_OK },
      { match: (u) => u.includes('nominatim.openstreetmap.org'), response: NOMINATIM_OK },
    ]);

    const data1 = await service.getWeather(52.52, 13.41);
    expect(data1.source).toContain('Open-Meteo');
    const callsAfterFirst = mockHttp.get.mock.calls.length;

    const data2 = await service.getWeather(52.52, 13.41);
    expect(data2.source).toBe(data1.source);
    // KEIN weiterer HTTP-Call — Cache hit
    expect(mockHttp.get).toHaveBeenCalledTimes(callsAfterFirst);
  });
});
