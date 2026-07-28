/// Air Quality DTO Layer — spiegelt exakt das Backend /api/air-quality/forecast JSON.
///
/// **Architektur:** Wie weather_dto.dart — Backend ist Source-of-Truth für
/// AQI-Level/Color Mapping (backend/src/services/airQualityService.ts hat
/// EAQI_LEVELS Array). Flutter parsiert nur die fertigen Werte.

/// AirQualityForecastResponse — Root-Container für /api/air-quality/forecast
class AirQualityForecastResponse {
  final String status;
  final CurrentAirQualityDto current;
  final List<HourlyAirQualityDto> hourly;
  final AirQualityLocationDto location;
  final String source;

  const AirQualityForecastResponse({
    required this.status,
    required this.current,
    required this.hourly,
    required this.location,
    required this.source,
  });

  factory AirQualityForecastResponse.fromJson(Map<String, dynamic> json) {
    return AirQualityForecastResponse(
      status: json['status'] as String? ?? 'unknown',
      current: CurrentAirQualityDto.fromJson(
          json['current'] as Map<String, dynamic>),
      hourly: (json['hourly'] as List<dynamic>? ?? const [])
          .map((e) => HourlyAirQualityDto.fromJson(e as Map<String, dynamic>))
          .toList(),
      location: AirQualityLocationDto.fromJson(
          json['location'] as Map<String, dynamic>),
      source: json['source'] as String? ?? '',
    );
  }
}

/// CurrentAirQualityDto — Aktuelle Luftqualität (covers /current Endpoint too)
class CurrentAirQualityDto {
  final double? europeanAqi;
  final double? pm10;
  final double? pm25;
  final double? nitrogenDioxide;
  final double? ozone;
  final double? carbonMonoxide;
  final double? sulphurDioxide;
  final String aqiLevel;
  final String aqiColor;

  const CurrentAirQualityDto({
    this.europeanAqi,
    this.pm10,
    this.pm25,
    this.nitrogenDioxide,
    this.ozone,
    this.carbonMonoxide,
    this.sulphurDioxide,
    required this.aqiLevel,
    required this.aqiColor,
  });

  factory CurrentAirQualityDto.fromJson(Map<String, dynamic> json) {
    return CurrentAirQualityDto(
      europeanAqi: (json['europeanAqi'] as num?)?.toDouble(),
      pm10: (json['pm10'] as num?)?.toDouble(),
      pm25: (json['pm25'] as num?)?.toDouble(),
      nitrogenDioxide: (json['nitrogenDioxide'] as num?)?.toDouble(),
      ozone: (json['ozone'] as num?)?.toDouble(),
      carbonMonoxide: (json['carbonMonoxide'] as num?)?.toDouble(),
      sulphurDioxide: (json['sulphurDioxide'] as num?)?.toDouble(),
      aqiLevel: json['aqiLevel'] as String? ?? 'Unbekannt',
      aqiColor: json['aqiColor'] as String? ?? '#888',
    );
  }
}

/// HourlyAirQualityDto — Stündliche AQI-Werte
class HourlyAirQualityDto {
  final String time;
  final double? europeanAqi;
  final double? pm10;
  final double? pm25;
  final double? nitrogenDioxide;
  final double? ozone;

  const HourlyAirQualityDto({
    required this.time,
    this.europeanAqi,
    this.pm10,
    this.pm25,
    this.nitrogenDioxide,
    this.ozone,
  });

  factory HourlyAirQualityDto.fromJson(Map<String, dynamic> json) {
    return HourlyAirQualityDto(
      time: json['time'] as String? ?? '',
      europeanAqi: (json['europeanAqi'] as num?)?.toDouble(),
      pm10: (json['pm10'] as num?)?.toDouble(),
      pm25: (json['pm25'] as num?)?.toDouble(),
      nitrogenDioxide: (json['nitrogenDioxide'] as num?)?.toDouble(),
      ozone: (json['ozone'] as num?)?.toDouble(),
    );
  }
}

/// AirQualityLocationDto — Koordinaten + Ortsname
class AirQualityLocationDto {
  final double lat;
  final double lng;
  final String name;

  const AirQualityLocationDto({
    required this.lat,
    required this.lng,
    required this.name,
  });

  factory AirQualityLocationDto.fromJson(Map<String, dynamic> json) {
    return AirQualityLocationDto(
      lat: (json['lat'] as num?)?.toDouble() ?? 0.0,
      lng: (json['lng'] as num?)?.toDouble() ?? 0.0,
      name: json['name'] as String? ?? '',
    );
  }
}
