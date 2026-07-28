/// LocationDefaultsDto — Backend-driven BBox-Defaults (Phase X.3c).
///
/// **Architektur:** Mirror zur waste_dto.dart + air_quality_dto.dart
/// Pattern. Backend ist Source-of-Truth (Phase X.3b
/// `routes/config.ts` + `services/wasteService.getLocationDefaults()`).
/// Flutter parsiert nur die fertigen Werte.
///
/// **User-Regel-Konform:**
/// - KEIN Hardcoding: BBox-Werte kommen aus Backend (default fallback ist
///   in `WasteProvider._fallbackCityConfig` als Isolated-Last-Resort-of-Failure
///   dokumentiert, NICHT im DTO selbst).
/// - AGPL-defensiv: keine iCal-URLs werden hier gelesen.
///
/// **Format-Beispiel (was /api/config/location-defaults zurueckgibt):**
/// ```json
/// {
///   "version": "1.0",
///   "expiresAt": "2026-07-29T17:55:59Z",
///   "status": "ok",
///   "cities": [
///     {
///       "name": "berlin", "displayName": "Berlin",
///       "bbox": {"minLat":52.34,"maxLat":52.68,"minLng":13.10,"maxLng":13.77},
///       "addressRequired": false,
///       "attribution": "BSR — CC-BY 4.0"
///     }
///   ]
/// }
/// ```

/// LocationDefaultsResponse — Root-Container für /api/config/location-defaults
class LocationDefaultsResponse {
  final String status;
  final List<CityDefaultDto> cities;

  const LocationDefaultsResponse({
    required this.status,
    required this.cities,
  });

  factory LocationDefaultsResponse.fromJson(Map<String, dynamic> json) {
    return LocationDefaultsResponse(
      status: json['status'] as String? ?? 'unknown',
      cities: (json['cities'] as List<dynamic>? ?? const [])
          .map((e) => CityDefaultDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  /// True wenn mindestens eine City definiert ist. Backend Version 1.0+
  /// garantiert 3 cities (berlin/hamburg/muenchen). Defensive: leere
  /// Liste kann z.B. nach Schema-Migration vorkommen.
  bool get hasCities => cities.isNotEmpty;

  /// Findet eine City per name (lowercase-safe).
  /// Wird vom WasteProvider fuer adressRequired-lookup genutzt.
  CityDefaultDto? findCity(String name) {
    final needle = name.toLowerCase();
    for (final c in cities) {
      if (c.name.toLowerCase() == needle) return c;
    }
    return null;
  }
}

/// CityDefaultDto — Eine Stadt mit ihrer BBox + Attributen.
class CityDefaultDto {
  /// 'berlin' | 'hamburg' | 'muenchen' (oder neu-added in backend-version >=1.x)
  final String name;

  /// 'Berlin' | 'Hamburg' | 'München' (Anzeigeform)
  final String displayName;

  final BBoxDto bbox;

  /// true wenn Backend City-Endpoint 'address' parameter braucht
  /// (z.B. hamburg=street+houseNr required; berlin=false)
  final bool addressRequired;

  /// CC-BY attribution text (z.B. "BSR — CC-BY 4.0")
  final String attribution;

  const CityDefaultDto({
    required this.name,
    required this.displayName,
    required this.bbox,
    required this.addressRequired,
    required this.attribution,
  });

  factory CityDefaultDto.fromJson(Map<String, dynamic> json) {
    return CityDefaultDto(
      name: json['name'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      bbox: BBoxDto.fromJson(
          json['bbox'] as Map<String, dynamic>? ?? const <String, dynamic>{}),
      addressRequired: json['addressRequired'] as bool? ?? false,
      attribution: json['attribution'] as String? ?? '',
    );
  }

  /// True wenn (lat, lng) in dieser City-BBox liegt (half-open [min, max)).
  /// Mirror zur WasteProvider.pickCityFromBbox-Logik, aber dynamisch aus
  /// Backend-Config statt hardcoded.
  bool containsPoint(double lat, double lng) =>
      lat >= bbox.minLat &&
      lat < bbox.maxLat &&
      lng >= bbox.minLng &&
      lng < bbox.maxLng;
}

/// BBoxDto — Lat/Lng-Bounding-Box (half-open [min, max) per Phase B-3.1).
class BBoxDto {
  final double minLat;
  final double maxLat;
  final double minLng;
  final double maxLng;

  const BBoxDto({
    required this.minLat,
    required this.maxLat,
    required this.minLng,
    required this.maxLng,
  });

  factory BBoxDto.fromJson(Map<String, dynamic> json) {
    return BBoxDto(
      minLat: (json['minLat'] as num?)?.toDouble() ?? 0.0,
      maxLat: (json['maxLat'] as num?)?.toDouble() ?? 0.0,
      minLng: (json['minLng'] as num?)?.toDouble() ?? 0.0,
      maxLng: (json['maxLng'] as num?)?.toDouble() ?? 0.0,
    );
  }

  /// Repr für Tests + Logs.
  String get asRange => 'lat[$minLat..$maxLat),lng[$minLng..$maxLng)';
}
