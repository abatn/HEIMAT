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

/// WeatherTipDto — Intelligenter Tipp basierend auf Wetterdaten
class WeatherTipDto {
  final String icon;
  final String text;
  final String priority; // 'high', 'medium', 'low'
  final String category; // 'activity', 'health', 'clothing', 'transport'

  const WeatherTipDto({
    required this.icon,
    required this.text,
    required this.priority,
    required this.category,
  });

  factory WeatherTipDto.fromJson(Map<String, dynamic> json) {
    return WeatherTipDto(
      icon: json['icon'] as String? ?? '💡',
      text: json['text'] as String? ?? '',
      priority: json['priority'] as String? ?? 'low',
      category: json['category'] as String? ?? 'activity',
    );
  }

  bool get isHighPriority => priority == 'high';
}

/// ForecastResponse — Root-Container für /api/weather/forecast
class WeatherForecastResponse {
  final String status;
  final CurrentWeatherDto current;
  final List<HourlyForecastDto> hourly;
  final List<DailyForecastDto> daily;
  final LocationDto location;
  final String source;
  final List<WeatherTipDto> tips;

  const WeatherForecastResponse({
    required this.status,
    required this.current,
    required this.hourly,
    required this.daily,
    required this.location,
    required this.source,
    this.tips = const [],
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
      tips: (json['tips'] as List<dynamic>? ?? const [])
          .map((e) => WeatherTipDto.fromJson(e as Map<String, dynamic>))
          .toList(),
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

// =========================================================================
// Phase E Forecast-DTO Block — Unwetter-Alerts
// (Backend: src/backend/src/services/weatherAlertsService.ts)
// =========================================================================

/// AlertCode — Backend-String wird zu Dart-enum gemappt.
enum AlertCode {
  sturm,
  extremregen,
  dauerregen;

  static AlertCode fromString(String? raw) {
    switch (raw) {
      case 'sturm':
        return AlertCode.sturm;
      case 'extremregen':
        return AlertCode.extremregen;
      case 'dauerregen':
        return AlertCode.dauerregen;
      default:
        return AlertCode.sturm; // Fallback — sollte nie passieren
    }
  }

  String get displayLabel {
    switch (this) {
      case AlertCode.sturm:
        return 'Sturm';
      case AlertCode.extremregen:
        return 'Starkregen';
      case AlertCode.dauerregen:
        return 'Dauerregen';
    }
  }

  // IconData-Mapping lebt absichtlich im Widget (alert_banner.dart::_iconFor).
  // Hier kein icon-Property weil sonst zirkulaerer Import (Flutter material
  // in DTO). Wer das Icon braucht: AlertBanner nutzt es intern.
}

/// AlertSeverity — 3 Stufen
enum AlertSeverity {
  info,
  warning,
  danger;

  static AlertSeverity fromString(String? raw) {
    switch (raw) {
      case 'info':
        return AlertSeverity.info;
      case 'warning':
        return AlertSeverity.warning;
      case 'danger':
        return AlertSeverity.danger;
      default:
        return AlertSeverity.info;
    }
  }
}

/// AlertMetric — optional [label, value, unit] Triple
class AlertMetric {
  final String label;
  final String value;
  final String unit;

  const AlertMetric({
    required this.label,
    required this.value,
    required this.unit,
  });

  factory AlertMetric.fromJson(Map<String, dynamic> json) {
    return AlertMetric(
      label: json['label'] as String? ?? '',
      value: json['value'] as String? ?? '',
      unit: json['unit'] as String? ?? '',
    );
  }
}

/// WeatherAlert — spiegelt backend WeatherAlert.
/// Bei Dauerregen: dayIndex=start, endDayIndex=end.
/// Bei STURM/EXTREMREGEN: kein endDayIndex (Single-Day-Alert).
class WeatherAlert {
  final AlertCode code;
  final AlertSeverity severity;
  final String title;
  final String message;
  final int dayIndex;
  final int? endDayIndex;
  final AlertMetric? metric;

  const WeatherAlert({
    required this.code,
    required this.severity,
    required this.title,
    required this.message,
    required this.dayIndex,
    this.endDayIndex,
    this.metric,
  });

  factory WeatherAlert.fromJson(Map<String, dynamic> json) {
    return WeatherAlert(
      code: AlertCode.fromString(json['code'] as String?),
      severity: AlertSeverity.fromString(json['severity'] as String?),
      title: json['title'] as String? ?? '',
      message: json['message'] as String? ?? '',
      dayIndex: (json['dayIndex'] as num?)?.toInt() ?? 0,
      endDayIndex: (json['endDayIndex'] as num?)?.toInt(),
      metric: json['metric'] is Map<String, dynamic>
          ? AlertMetric.fromJson(json['metric'] as Map<String, dynamic>)
          : null,
    );
  }

  /// Range-Span (z.B. Dauerregen Tag 0-4) oder single day
  bool get isSpan => endDayIndex != null && endDayIndex! > dayIndex;
}

/// WeatherAlertsResponse — Root-Container für /api/weather/alerts
class WeatherAlertsResponse {
  final String status;
  final List<WeatherAlert> alerts;
  final DateTime generatedAt;
  final String source;
  final String attribution;

  const WeatherAlertsResponse({
    required this.status,
    required this.alerts,
    required this.generatedAt,
    required this.source,
    required this.attribution,
  });

  factory WeatherAlertsResponse.fromJson(Map<String, dynamic> json) {
    return WeatherAlertsResponse(
      status: json['status'] as String? ?? 'unknown',
      alerts: (json['alerts'] as List<dynamic>? ?? const [])
          .map((e) => WeatherAlert.fromJson(e as Map<String, dynamic>))
          .toList(),
      generatedAt: DateTime.tryParse(json['generatedAt'] as String? ?? '') ??
          DateTime.now(),
      source: json['source'] as String? ?? '',
      attribution: json['attribution'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'status': status,
        'alerts': alerts
            .map((a) => {
                  'code': a.code.name,
                  'severity': a.severity.name,
                  'title': a.title,
                  'message': a.message,
                  'dayIndex': a.dayIndex,
                  if (a.endDayIndex != null) 'endDayIndex': a.endDayIndex,
                  if (a.metric != null)
                    'metric': {
                      'label': a.metric!.label,
                      'value': a.metric!.value,
                      'unit': a.metric!.unit,
                    },
                })
            .toList(),
        'generatedAt': generatedAt.toIso8601String(),
        'source': source,
        'attribution': attribution,
      };
}

// =========================================================================
// Cross-Service-Insight Helpers (Phase E Super-App-Pacing)
//
// WMO weatherCode-Semantik (siehe backend/src/services/weatherService.ts):
//   45-48 Nebel           -> NICHT Regen -> Insight NICHT triggern
//   51-55 Nieselregen     -> Regen (leicht)
//   56-57 Eis-Niesel      -> Regen (Vereisung)
//   61-65 Regen           -> Regen (mittel)
//   66-67 Eis-Regen       -> Regen (Vereisung)
//   80-82 Schauer         -> Regen (stark)
//   95-99 Gewitter        -> Regen (sehr stark)
//
// Schwellwert >= 51 erfasst ALLE Regen-Formen, schliesst aber Nebel (Visibility-Issue)
// aus. Letzteres wuerde Mobility-Hint unnoetig triggern wenn man nur schlecht
// sehen kann — andere Sensorik noetig.
// =========================================================================

/// Extension: aktueller Wetter-Code ist irgendeine Form von Regen.
extension CurrentWeatherInsight on CurrentWeatherDto {
  bool get isRainingNow => weatherCode >= 51;
}

/// Extension: Regen in der naechsten Vorhersage-Stunde wahrscheinlich.
///
/// HourlyForecastDto hat KEIN precipitationProbability-Feld (das gibt es
/// nur auf DailyForecastDto). Wir nutzen die tatsaechliche Niederschlags-
/// Menge in mm — > 0.5 mm/h = "spuerbarer Regen" (Drizzle unter dieser
/// Schwelle gilt als netter Spruehregen, kein Hint noetig).
//
// FIXME: backend liefert aktuell keine precipitationProbability auf
// HourlyForecastDto. Sobald weatherService.ts das nachzieht, koennen wir
// wieder einen AND-Check mit Wahrscheinlichkeit machen.
extension ForecastInsight on WeatherForecastResponse {
  bool get isRainingSoon {
    if (hourly.isEmpty) return false;
    final next = hourly.first;
    return next.weatherCode >= 51 && next.precipitation > 0.5;
  }
}
