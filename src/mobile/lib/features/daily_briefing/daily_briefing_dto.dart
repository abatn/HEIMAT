/// daily_briefing_dto.dart — DTO for Daily Briefing API Response
class DailyBriefingDto {
  final String greeting;
  final String timestamp;
  final String period;
  final WeatherInfo? weather;
  final AirQualityInfo? airQuality;
  final WasteInfo? waste;
  final ParkingInfo? parking;
  final EvChargingInfo? evCharging;
  final List<String> tips;
  final List<AlertDto> alerts;

  DailyBriefingDto({
    required this.greeting,
    required this.timestamp,
    required this.period,
    this.weather,
    this.airQuality,
    this.waste,
    this.parking,
    this.evCharging,
    required this.tips,
    required this.alerts,
  });

  factory DailyBriefingDto.fromJson(Map<String, dynamic> json) {
    return DailyBriefingDto(
      greeting: json['greeting'] as String? ?? 'Hallo! 👋',
      timestamp: json['timestamp'] as String? ?? '',
      period: json['period'] as String? ?? 'morning',
      weather: json['weather'] != null
          ? WeatherInfo.fromJson(json['weather'] as Map<String, dynamic>)
          : null,
      airQuality: json['airQuality'] != null
          ? AirQualityInfo.fromJson(json['airQuality'] as Map<String, dynamic>)
          : null,
      waste: json['waste'] != null
          ? WasteInfo.fromJson(json['waste'] as Map<String, dynamic>)
          : null,
      parking: json['parking'] != null
          ? ParkingInfo.fromJson(json['parking'] as Map<String, dynamic>)
          : null,
      evCharging: json['evCharging'] != null
          ? EvChargingInfo.fromJson(json['evCharging'] as Map<String, dynamic>)
          : null,
      tips: (json['tips'] as List<dynamic>?)?.cast<String>() ?? [],
      alerts: (json['alerts'] as List<dynamic>?)
              ?.map((a) => AlertDto.fromJson(a as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

class WeatherInfo {
  final double temperature;
  final String condition;
  final List<String> tips;

  WeatherInfo({
    required this.temperature,
    required this.condition,
    required this.tips,
  });

  factory WeatherInfo.fromJson(Map<String, dynamic> json) {
    return WeatherInfo(
      temperature: (json['temperature'] as num?)?.toDouble() ?? 0,
      condition: json['condition'] as String? ?? 'Unbekannt',
      tips: (json['tips'] as List<dynamic>?)?.cast<String>() ?? [],
    );
  }
}

class AirQualityInfo {
  final int aqi;
  final String level;
  final List<String> tips;

  AirQualityInfo({
    required this.aqi,
    required this.level,
    required this.tips,
  });

  factory AirQualityInfo.fromJson(Map<String, dynamic> json) {
    return AirQualityInfo(
      aqi: json['aqi'] as int? ?? 0,
      level: json['level'] as String? ?? 'Unbekannt',
      tips: (json['tips'] as List<dynamic>?)?.cast<String>() ?? [],
    );
  }
}

class WasteInfo {
  final bool available;
  final String? nextEvent;
  final String? category;
  final List<String> tips;

  WasteInfo({
    required this.available,
    this.nextEvent,
    this.category,
    required this.tips,
  });

  factory WasteInfo.fromJson(Map<String, dynamic> json) {
    return WasteInfo(
      available: json['available'] as bool? ?? false,
      nextEvent: json['nextEvent'] as String?,
      category: json['category'] as String?,
      tips: (json['tips'] as List<dynamic>?)?.cast<String>() ?? [],
    );
  }
}

class ParkingInfo {
  final bool available;
  final int count;
  final String? nearest;

  ParkingInfo({
    required this.available,
    required this.count,
    this.nearest,
  });

  factory ParkingInfo.fromJson(Map<String, dynamic> json) {
    return ParkingInfo(
      available: json['available'] as bool? ?? false,
      count: json['count'] as int? ?? 0,
      nearest: json['nearest'] as String?,
    );
  }
}

class EvChargingInfo {
  final bool available;
  final int count;
  final String? nearest;

  EvChargingInfo({
    required this.available,
    required this.count,
    this.nearest,
  });

  factory EvChargingInfo.fromJson(Map<String, dynamic> json) {
    return EvChargingInfo(
      available: json['available'] as bool? ?? false,
      count: json['count'] as int? ?? 0,
      nearest: json['nearest'] as String?,
    );
  }
}

class AlertDto {
  final String type;
  final String message;
  final String priority;
  final String icon;

  AlertDto({
    required this.type,
    required this.message,
    required this.priority,
    required this.icon,
  });

  factory AlertDto.fromJson(Map<String, dynamic> json) {
    return AlertDto(
      type: json['type'] as String? ?? '',
      message: json['message'] as String? ?? '',
      priority: json['priority'] as String? ?? 'low',
      icon: json['icon'] as String? ?? '📌',
    );
  }
}
