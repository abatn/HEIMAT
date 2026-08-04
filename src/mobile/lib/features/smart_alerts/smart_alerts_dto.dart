/// smart_alerts_dto.dart — DTO for Smart Alerts API Response
///
/// Backend: GET /api/smart-alerts?lat=...&lng=...
/// Returns prioritized alerts based on weather, air quality, waste, transit

class SmartAlertsResponse {
  final int count;
  final List<SmartAlertDto> alerts;
  final String generatedAt;

  SmartAlertsResponse({
    required this.count,
    required this.alerts,
    required this.generatedAt,
  });

  factory SmartAlertsResponse.fromJson(Map<String, dynamic> json) {
    return SmartAlertsResponse(
      count: json['count'] as int? ?? 0,
      alerts: (json['alerts'] as List<dynamic>?)
              ?.map((a) => SmartAlertDto.fromJson(a as Map<String, dynamic>))
              .toList() ??
          [],
      generatedAt: json['generatedAt'] as String? ?? '',
    );
  }
}

class SmartAlertDto {
  final String id;
  final String
      type; // waste | weather | airquality | transit | parking | reminder
  final String priority; // high | medium | low
  final String icon;
  final String title;
  final String message;
  final String? action;
  final String? expiresAt;

  SmartAlertDto({
    required this.id,
    required this.type,
    required this.priority,
    required this.icon,
    required this.title,
    required this.message,
    this.action,
    this.expiresAt,
  });

  factory SmartAlertDto.fromJson(Map<String, dynamic> json) {
    return SmartAlertDto(
      id: json['id'] as String? ?? '',
      type: json['type'] as String? ?? 'reminder',
      priority: json['priority'] as String? ?? 'low',
      icon: json['icon'] as String? ?? '📌',
      title: json['title'] as String? ?? '',
      message: json['message'] as String? ?? '',
      action: json['action'] as String?,
      expiresAt: json['expiresAt'] as String?,
    );
  }
}
