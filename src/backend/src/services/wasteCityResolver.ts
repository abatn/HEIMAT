// ---------------------------------------------------------------------------
// wasteCityResolver — Static Bounding-Box-Lookup für lat/lng → city
//
// DESIGN (Gemini-Empfehlung Phase B-2): KEIN Nominatim-Reverse-Geocode
// (würde 200ms Latency + 1 externer HTTP-Call pro Waste-Request verursachen).
// Stattdessen: statisches bbox-Array + point-in-polygon-im-Sinn-von-rectangle
// Check. 0 external dependencies, rasend schnell.
//
// Coverage-Phase-1: nur die 3 Großstädte Berlin/Hamburg/München.
//   Andere deutsche Städte (Köln, Frankfurt, Dresden …) →
//   `CityNotSupportedError` (Frontend kann das catchen und "für deine Region
//   noch nicht verfügbar" zeigen).
//
// Koordinaten-Sources:
//   - Berlin:   ~52.34–52.68 N, 13.10–13.77 O    (Verwaltungsgrenzen-Lookup)
//   - Hamburg: ~53.39–53.74 N,  9.73–10.32 O   (~)
//   - München: ~48.06–48.25 N, 11.36–11.73 O    (~)
//
// Edge-Boundary: Punkte am Rand (z.B. 52.34 N) → inclusive-edge (>=min
// && <max — letzteres exklusiv damit Edge-Cases auf naeheste bbox mappen
// wenn zwischen 2 Städten).
//
// Performance-Obergrenze: O(N) wo N=3 → <1ms pro resolve.
// ---------------------------------------------------------------------------

export type WasteCityKey = 'berlin' | 'hamburg' | 'muenchen';

export interface CityBounds {
  city: WasteCityKey;
  /** Pretty-name for UI (deutsche Schreibweise). */
  displayName: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const CITY_BOUNDS: CityBounds[] = [
  { city: 'berlin',   displayName: 'Berlin',   minLat: 52.34, maxLat: 52.68, minLng: 13.10, maxLng: 13.77 },
  { city: 'hamburg',  displayName: 'Hamburg',  minLat: 53.39, maxLat: 53.74, minLng:  9.73, maxLng: 10.32 },
  { city: 'muenchen', displayName: 'München',  minLat: 48.06, maxLat: 48.25, minLng: 11.36, maxLng: 11.73 },
];

/**
 * CityNotSupportedError — wird geworfen wenn lat/lng ausserhalb der
 * Phase-1-Coverage liegt (nicht Berlin/Hamburg/München).
 *
 * Frontend-Handling: zeige "Abfallkalender für deine Region noch nicht
 * verfügbar — wir arbeiten an mehr Städten".
 */
export class CityNotSupportedError extends Error {
  readonly code = 'CITY_NOT_SUPPORTED';
  readonly lat: number;
  readonly lng: number;
  constructor(lat: number, lng: number) {
    super(
      `Abfallkalender für Koordinaten (${lat.toFixed(3)}, ${lng.toFixed(3)}) noch nicht verfügbar. ` +
      `Phase-1-Coverage: ${CITY_BOUNDS.map((c) => c.displayName).join(', ')}.`,
    );
    this.lat = lat;
    this.lng = lng;
  }
}

/**
 * Pure-function: lat/lng → city-key
 * @throws CityNotSupportedError wenn ausserhalb der 3-Phase-1-Bboxen
 */
export function resolveCity(lat: number, lng: number): CityBounds {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new TypeError(`resolveCity: lat/lng must be numbers, got ${typeof lat}/${typeof lng}`);
  }
  if (!isFinite(lat) || !isFinite(lng)) {
    throw new TypeError(`resolveCity: lat/lng must be finite numbers, got ${lat}/${lng}`);
  }

  for (const bounds of CITY_BOUNDS) {
    // Inclusive-lo, exclusive-hi damit Edge-Cases deterministisch der ersten
    // bbox zuordnen (z.B. ein Punkt exakt auf Berlin/Hamburg-Grenze → Berlin).
    if (
      lat >= bounds.minLat && lat < bounds.maxLat &&
      lng >= bounds.minLng && lng < bounds.maxLng
    ) {
      return bounds;
    }
  }
  throw new CityNotSupportedError(lat, lng);
}
