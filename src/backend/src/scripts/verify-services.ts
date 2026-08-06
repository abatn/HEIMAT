type JsonObject = Record<string, unknown>;

type VerificationState = 'pass' | 'degraded' | 'fail';

export interface VerificationResult {
  service: string;
  endpoint: string;
  state: VerificationState;
  detail: string;
  httpStatus?: number;
}

interface VerificationTarget {
  service: string;
  endpoint: string;
  validate: (body: JsonObject) => { state: VerificationState; detail: string };
}

export interface VerificationOptions {
  weatherRadiusKm: number;
  airRadiusKm: number;
  wasteWeeks: number;
  evChargingRadiusKm: number;
  parkingRadiusKm: number;
  eventsRadiusKm: number;
  hotelsRadiusKm: number;
  buergeramtRadiusKm: number;
}

const REQUEST_TIMEOUT_MS = 60_000;

// This CLI intentionally covers only public, read-only service endpoints.
// Authenticated or state-changing services require separate credentials and checks.

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Required environment variable ${name} is missing`);
  }
  return value;
}

function requireNumberInRange(name: string, min: number, max: number): number {
  const value = Number(requireEnvironment(name));
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be a number between ${min} and ${max}`);
  }
  return value;
}

function requireIntegerInRange(name: string, min: number, max: number): number {
  const value = requireNumberInRange(name, min, max);
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function requirePositiveNumber(name: string): number {
  return requireNumberInRange(name, Number.MIN_VALUE, Number.MAX_SAFE_INTEGER);
}

function arrayValue(body: JsonObject, key: string): unknown[] | null {
  return Array.isArray(body[key]) ? body[key] : null;
}

function validateStatusAndArray(
  body: JsonObject,
  key: string,
  label: string,
): { state: VerificationState; detail: string } {
  if (body.status !== 'ok') {
    return { state: 'fail', detail: `${label}: response status is not ok` };
  }

  const values = arrayValue(body, key);
  if (values === null) {
    return { state: 'fail', detail: `${label}: ${key} is not an array` };
  }
  if (values.length === 0) {
    return { state: 'degraded', detail: `${label}: valid response but no records at this location` };
  }
  return { state: 'pass', detail: `${label}: ${values.length} real records` };
}

function validateGeoCollection(
  body: JsonObject,
  key: string,
  label: string,
): { state: VerificationState; detail: string } {
  const values = arrayValue(body, key);
  if (typeof body.count !== 'number' || values === null) {
    return { state: 'fail', detail: `${label}: count or ${key} has an invalid shape` };
  }
  if (values.length === 0) {
    return { state: 'degraded', detail: `${label}: valid response but no records at this location` };
  }
  if (values.some((value) =>
    typeof value !== 'object' || value === null || Array.isArray(value),
  )) {
    return { state: 'fail', detail: `${label}: records have an invalid shape` };
  }
  return { state: 'pass', detail: `${label}: ${values.length} real records` };
}

export function buildVerificationPlan(
  baseUrl: string,
  latitude: number,
  longitude: number,
  jobQuery: string,
  eventQuery: string,
  options: VerificationOptions,
): VerificationTarget[] {
  const params = `lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`;
  const radius = `&radius=10`;
  const encodedJobQuery = encodeURIComponent(jobQuery);
  const encodedEventQuery = encodeURIComponent(eventQuery);

  return [
    {
      service: 'weather',
      endpoint: `${baseUrl}/api/weather/forecast?${params}&radius=${options.weatherRadiusKm}`,
      validate: (body) => validateStatusAndArray(body, 'hourly', 'weather'),
    },
    {
      service: 'air-quality',
      endpoint: `${baseUrl}/api/air-quality/current?${params}&radius=${options.airRadiusKm}`,
      validate: (body) => {
        const airQuality = body.airQuality;
        const hasValues = typeof airQuality === 'object' && airQuality !== null &&
          !Array.isArray(airQuality);
        return {
          state: body.status === 'ok' && hasValues ? 'pass' : 'fail',
          detail: body.status === 'ok' && hasValues
            ? 'air-quality: real current values received'
            : 'air-quality: response has no current values',
        };
      },
    },
    {
      service: 'waste',
      endpoint: `${baseUrl}/api/waste/calendar?${params}&weeks=${options.wasteWeeks}`,
      validate: (body) => {
        if (body.status === 'error' && body.code === 'CITY_NOT_SUPPORTED') {
          return { state: 'degraded', detail: 'waste: location has no supported municipal source' };
        }
        return validateStatusAndArray(body, 'events', 'waste');
      },
    },
    {
      service: 'ev-charging',
      endpoint: `${baseUrl}/api/ev-charging/stations?${params}&radius=${options.evChargingRadiusKm}`,
      validate: (body) => validateStatusAndArray(body, 'stations', 'ev-charging'),
    },
    {
      service: 'parking',
      endpoint: `${baseUrl}/api/parking/spots?${params}&radius=${options.parkingRadiusKm}`,
      validate: (body) => validateStatusAndArray(body, 'spots', 'parking'),
    },
    {
      service: 'events',
      endpoint: `${baseUrl}/api/events?${params}&radius=${options.eventsRadiusKm}`,
      validate: (body) => validateGeoCollection(body, 'events', 'events'),
    },
    {
      service: 'hotels',
      endpoint: `${baseUrl}/api/hotels?${params}&radius=${options.hotelsRadiusKm}`,
      validate: (body) => validateGeoCollection(body, 'hotels', 'hotels'),
    },
    {
      service: 'buergeramt',
      endpoint: `${baseUrl}/api/buergeramt?${params}&radius=${options.buergeramtRadiusKm}`,
      validate: (body) => validateGeoCollection(body, 'aemter', 'buergeramt'),
    },
    {
      service: 'jobs',
      endpoint: `${baseUrl}/api/jobs/search?q=${encodedJobQuery}&page=0&per_page=1`,
      validate: (body) => validateStatusAndArray(body, 'jobs', 'jobs'),
    },
    {
      service: 'universal-event-search',
      endpoint: `${baseUrl}/api/search?q=${encodedEventQuery}&${params}`,
      validate: (body) => {
        const results = arrayValue(body, 'results');
        const eventResults = results?.filter((result) => {
          if (typeof result !== 'object' || result === null || Array.isArray(result)) {
            return false;
          }
          const event = result as JsonObject;
          return event.category === 'event' &&
            typeof event.id === 'string' && event.id.length > 0 &&
            typeof event.name === 'string' && event.name.length > 0;
        }) ?? [];
        if (typeof body.count !== 'number' || results === null) {
          return { state: 'fail', detail: 'universal-event-search: invalid response shape' };
        }
        if (eventResults.length === 0) {
          return { state: 'fail', detail: 'universal-event-search: no real event result' };
        }
        return {
          state: 'pass',
          detail: `universal-event-search: ${eventResults.length} real event results`,
        };
      },
    },
  ];
}

async function fetchJson(endpoint: string): Promise<{ status: number; body: JsonObject }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    const body = await response.json() as unknown;
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new Error('response is not a JSON object');
    }
    return { status: response.status, body: body as JsonObject };
  } finally {
    clearTimeout(timer);
  }
}

export async function runVerification(
  baseUrl: string,
  latitude: number,
  longitude: number,
  jobQuery: string,    eventQuery: string,
    options: VerificationOptions,
): Promise<VerificationResult[]> {

  const results: VerificationResult[] = [];
  for (const target of buildVerificationPlan(
    baseUrl.replace(/\/$/, ''),
    latitude,
    longitude,
    jobQuery,
    eventQuery,
    options,
  )) {
    try {
      const response = await fetchJson(target.endpoint);
      const validation = target.validate(response.body);
      const state = response.status === 200 || validation.state === 'degraded'
        ? validation.state
        : 'fail';
      results.push({
        service: target.service,
        endpoint: target.endpoint,
        state,
        detail: response.status === 200
          ? validation.detail
          : `HTTP ${response.status}: ${validation.detail}`,
        httpStatus: response.status,
      });
    } catch (error) {
      results.push({
        service: target.service,
        endpoint: target.endpoint,
        state: 'fail',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}

async function main(): Promise<void> {
  const baseUrl = requireEnvironment('VERIFY_BACKEND_URL').replace(/\/$/, '');
  const latitude = requireNumberInRange('VERIFY_LAT', -90, 90);
  const longitude = requireNumberInRange('VERIFY_LNG', -180, 180);
  const jobQuery = requireEnvironment('VERIFY_JOB_QUERY');
  const eventQuery = requireEnvironment('VERIFY_EVENT_QUERY');
  const options: VerificationOptions = {
    weatherRadiusKm: requirePositiveNumber('VERIFY_WEATHER_RADIUS_KM'),
    airRadiusKm: requirePositiveNumber('VERIFY_AIR_RADIUS_KM'),
    wasteWeeks: requireIntegerInRange('VERIFY_WASTE_WEEKS', 1, 8),
    evChargingRadiusKm: requirePositiveNumber('VERIFY_EV_RADIUS_KM'),
    parkingRadiusKm: requirePositiveNumber('VERIFY_PARKING_RADIUS_KM'),
    eventsRadiusKm: requirePositiveNumber('VERIFY_EVENTS_RADIUS_KM'),
    hotelsRadiusKm: requirePositiveNumber('VERIFY_HOTELS_RADIUS_KM'),
    buergeramtRadiusKm: requirePositiveNumber('VERIFY_BUERGERAMT_RADIUS_KM'),
  };
  const results = await runVerification(
    baseUrl,
    latitude,
    longitude,
    jobQuery,
    eventQuery,
    options,
  );

  console.log('PUBLIC READ-ONLY PARTIAL MATRIX — no local server or database is assumed');
  console.log('Unlisted authenticated/stateful services are UNASSESSED, not functional.');

  for (const result of results) {
    console.log(`[${result.state.toUpperCase()}] ${result.service}: ${result.detail}`);
    console.log(`  ${result.endpoint}`);
  }

  const failed = results.filter((result) => result.state === 'fail');
  const degraded = results.filter((result) => result.state === 'degraded');
  if (failed.length > 0) {
    process.exitCode = 1;
  } else if (degraded.length > 0) {
    process.exitCode = 2;
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  });
}
