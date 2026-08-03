/**
 * test-utils.ts — Shared Test Utilities
 *
 * Enthält Helfer für E2E-Tests die externe APIs (Overpass, Nominatim, etc.)
 * aufrufen und in CI-Runnern flaky sind wegen Rate-Limits oder Timeouts.
 */

import type request from 'supertest';

/**
 * Akzeptierte HTTP-Status-Codes für externe API-Aufrufe.
 * Diese Codes bedeuten "Service ist temporär nicht verfügbar" — kein Test-Fehler.
 */
export const ACCEPTABLE_EXTERNAL_CODES = [200, 429, 502, 503, 504] as const;

/**
 * withRetry — Führt eine Funktion mit Retry-Logik aus.
 *
 * @param fn - Die auszuführende Funktion (z.B. request(app).get(...))
 * @param options - Konfiguration
 * @returns Die Response oder den letzten Fehler
 *
 * @example
 * const res = await withRetry(() =>
 *   request(app).get('/api/mobility/stops?lat=52.52&lng=13.41')
 * );
 * expect([200, 503]).toContain(res.status);
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    delayMs?: number;
    timeoutMs?: number;
    name?: string;
  } = {},
): Promise<T> {
  const {
    retries = 2,
    delayMs = 2000,
    timeoutMs = 30000,
    name = 'operation',
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`${name} timeout after ${timeoutMs}ms`)), timeoutMs),
        ),
      ]);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < retries) {
        console.log(
          `[withRetry] ${name} attempt ${attempt + 1}/${retries + 1} failed: ${lastError.message}. Retrying in ${delayMs}ms...`,
        );
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * isAcceptableStatus — Prüft ob ein HTTP-Status-Code für externe APIs akzeptabel ist.
 *
 * @example
 * expect(isAcceptableStatus(res.status)).toBe(true);
 */
export function isAcceptableStatus(status: number): boolean {
  return (ACCEPTABLE_EXTERNAL_CODES as readonly number[]).includes(status);
}



/**
 * E2E Test Configuration — Standard-Timeouts für verschiedene API-Typen.
 */
export const TIMEOUTS = {
  /** Overpass API — langsam, Rate-limited */
  overpass: 90_000,
  /** Nominatim — moderat */
  nominatim: 60_000,
  /** db-rest / transitous — ÖPNV */
  transit: 60_000,
  /** Lokale Services (Auth, DB) */
  local: 10_000,
  /** Taler Exchange — kann langsam sein */
  exchange: 60_000,
} as const;
