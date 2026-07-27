/// Weather DTO Layer — spiegelt exakt die Backend /api/weather/forecast JSON.
///
/// **Warum DTO statt Domain-Model?**
/// Das Backend (src/backend/src/services/weatherService.ts) hat bereits:
/// - WMO Weather Code → Deutsche Beschreibung
/// - Cache + Retry-Logik mit Backoff
///
/// Diese Logik NICHT in Flutter duplizieren (DRY).
/// Flutter nutzt nur den fertigen JSON + validiert Typen.
///
/// **Responsibility:** Pure dataclasses, kein Flutter-Import.

/// ForecastResponse — Root-Container für /api/weather/forecast
class WeatherForecastResponse {
  final String status;
  final CurrentWeatherDto current;
  final List<HourlyForecastDto> hourly;
  final List<DailyForecastDto> daily;
  final LocationDto location;
  final String source;

  const WeatherForecastResponse({
    required this.status,
    required this.current,
    required this.hourly,
    required this.daily,
    required this.location,
    required this.source,
  });

  factory WeatherForecastResponse.fromJson(Map<String, dynamic> json) {
    return WeatherForecastResponse(
      status: json['status'] as String? ?? 'unknown',
      current:
          CurrentWeatherDto.fromJson(json['current'] as Map<String, dynamic>),
      hourly: (json['hourly'] as List<dynamic>? ?? const [])
          .map((e) => HourlyForecastDto.fromJson(e as Map<String, dynamic>))
          .toList(),
      daily: (json['daily'] as List<dynamic>? ?? const [])
          .map((e) => DailyForecastDto.fromJson(e as Map<String, dynamic>))
          .toList(),
      location: LocationDto.fromJson(json['location'] as Map<String, dynamic>),
      source: json['source'] as String? ?? '',
    );
  }
}

/// CurrentWeatherDto — Akutelle Wetterlage (siehe backend WeatherService CurrentWeather)
class CurrentWeatherDto {
  final double temperature;
  final double feelsLike;
  final int humidity;
  final double pressure;
  final double windSpeed;
  final double windDirection;
  final int weatherCode;
  final String weatherText;
  final double precipitation;
  final int cloudCover;
  final double uvIndex;

  const CurrentWeatherDto({
    required this.temperature,
    required this.feelsLike,
    required this.humidity,
    required this.pressure,
    required this.windSpeed,
    required this.windDirection,
    required this.weatherCode,
    required this.weatherText,
    required this.precipitation,
    required this.cloudCover,
    required this.uvIndex,
  });

  factory CurrentWeatherDto.fromJson(Map<String, dynamic> json) {
    return CurrentWeatherDto(
      temperature: (json['temperature'] as num?)?.toDouble() ?? 0.0,
      feelsLike: (json['feelsLike'] as num?)?.toDouble() ?? 0.0,
      humidity: (json['humidity'] as num?)?.toInt() ?? 0,
      pressure: (json['pressure'] as num?)?.toDouble() ?? 0.0,
      windSpeed: (json['windSpeed'] as num?)?.toDouble() ?? 0.0,
      windDirection: (json['windDirection'] as num?)?.toDouble() ?? 0.0,
      weatherCode: (json['weatherCode'] as num?)?.toInt() ?? 0,
      weatherText: json['weatherText'] as String? ?? '—',
      precipitation: (json['precipitation'] as num?)?.toDouble() ?? 0.0,
      cloudCover: (json['cloudCover'] as num?)?.toInt() ?? 0,
      uvIndex: (json['uvIndex'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() => {
        'temperature': temperature,
        'feelsLike': feelsLike,
        'humidity': humidity,
        'pressure': pressure,
        'windSpeed': windSpeed,
        'windDirection': windDirection,
        'weatherCode': weatherCode,
        'weatherText': weatherText,
        'precipitation': precipitation,
        'cloudCover': cloudCover,
        'uvIndex': uvIndex,
      };
}

/// HourlyForecastDto — Stündliche Wettervorhersage
class HourlyForecastDto {
  final String time; // ISO-Timestamp von Backend, z.B. "2026-07-27T15:00"
  final double temperature;
  final double precipitation;
  final int weatherCode;
  final double windSpeed;

  const HourlyForecastDto({
    required this.time,
    required this.temperature,
    required this.precipitation,
    required this.weatherCode,
    required this.windSpeed,
  });

  factory HourlyForecastDto.fromJson(Map<String, dynamic> json) {
    return HourlyForecastDto(
      time: json['time'] as String? ?? '',
      temperature: (json['temperature'] as num?)?.toDouble() ?? 0.0,
      precipitation: (json['precipitation'] as num?)?.toDouble() ?? 0.0,
      weatherCode: (json['weatherCode'] as num?)?.toInt() ?? 0,
      windSpeed: (json['windSpeed'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

/// DailyForecastDto — 7-Tage-Vorhersage
class DailyForecastDto {
  final String date;
  final double temperatureMax;
  final double temperatureMin;
  final double precipitationSum;
  final int precipitationProbability;
  final int weatherCode;
  final String weatherText;
  final double windSpeedMax;
  final String sunrise;
  final String sunset;

  const DailyForecastDto({
    required this.date,
    required this.temperatureMax,
    required this.temperatureMin,
    required this.precipitationSum,
    required this.precipitationProbability,
    required this.weatherCode,
    required this.weatherText,
    required this.windSpeedMax,
    required this.sunrise,
    required this.sunset,
  });

  factory DailyForecastDto.fromJson(Map<String, dynamic> json) {
    return DailyForecastDto(
      date: json['date'] as String? ?? '',
      temperatureMax: (json['temperatureMax'] as num?)?.toDouble() ?? 0.0,
      temperatureMin: (json['temperatureMin'] as num?)?.toDouble() ?? 0.0,
      precipitationSum: (json['precipitationSum'] as num?)?.toDouble() ?? 0.0,
      precipitationProbability:
          (json['precipitationProbability'] as num?)?.toInt() ?? 0,
      weatherCode: (json['weatherCode'] as num?)?.toInt() ?? 0,
      weatherText: json['weatherText'] as String? ?? '—',
      windSpeedMax: (json['windSpeedMax'] as num?)?.toDouble() ?? 0.0,
      sunrise: json['sunrise'] as String? ?? '',
      sunset: json['sunset'] as String? ?? '',
    );
  }
}

/// LocationDto — Geokoordinaten + Ortsname
class LocationDto {
  final double lat;
  final double lng;
  final String name;

  const LocationDto({
    required this.lat,
    required this.lng,
    required this.name,
  });

  factory LocationDto.fromJson(Map<String, dynamic> json) {
    return LocationDto(
      lat: (json['lat'] as num?)?.toDouble() ?? 0.0,
      lng: (json['lng'] as num?)?.toDouble() ?? 0.0,
      name: json['name'] as String? ?? '',
    );
  }
}
