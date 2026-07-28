/// Waste DTO Layer — spiegelt exakt das Backend /api/waste/calendar JSON.
///
/// **Architektur:** Wie air_quality_dto.dart — Backend ist Source-of-Truth
/// (CC-BY-Lizenz-Attribution kommt direkt im response.attribution-Feld).
/// Flutter parsiert nur die fertigen Werte, kein erneutes Mappen.

/// WasteCalendarResponse — Root-Container für /api/waste/calendar
class WasteCalendarResponse {
  final String city; // 'berlin' | 'hamburg' | 'muenchen'
  final String displayName; // 'Berlin' | 'Hamburg' | 'München'
  final int weeks; // 1..8 (Backend-default 4)
  final List<WasteCalendarEvent> events;
  final String source; // Welche URL hat tatsaechlich geliefert
  final String attribution; // CC-BY license text (per-city)
  final String fetchedAt; // ISO timestamp
  final bool cached; // true wenn aus 24h-Cache
  final String status; // 'ok' | 'error'

  const WasteCalendarResponse({
    required this.city,
    required this.displayName,
    required this.weeks,
    required this.events,
    required this.source,
    required this.attribution,
    required this.fetchedAt,
    required this.cached,
    required this.status,
  });

  factory WasteCalendarResponse.fromJson(Map<String, dynamic> json) {
    return WasteCalendarResponse(
      city: json['city'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      weeks: json['weeks'] as int? ?? 4,
      events: (json['events'] as List<dynamic>? ?? const [])
          .map((e) => WasteCalendarEvent.fromJson(e as Map<String, dynamic>))
          .toList(),
      source: json['source'] as String? ?? '',
      attribution: json['attribution'] as String? ?? '',
      fetchedAt: json['fetchedAt'] as String? ?? '',
      cached: json['cached'] as bool? ?? false,
      status: json['status'] as String? ?? 'unknown',
    );
  }
}

/// WasteCalendarEvent — einzelner VCALENDAR/VEVENT aus BSR/AWB/SRH-Feed
class WasteCalendarEvent {
  /// ISO-8601 datetime 'YYYY-MM-DDTHH:mm:ss' (lokale Abfuhrzeit)
  final String start;
  /// Optional: aus DURATION berechnet oder DTEND (RFC 5545)
  final String? end;
  /// z.B. 'Restmülltonne', 'Biotonne', 'Gelbe Tonne (Verpackungen)'
  final String summary;
  /// Normalisiert vom Provider: 'restmuell' / 'bio' / 'papier' etc.
  final String? category;
  /// Optional: BSR-Style 'Berlin, Unter den Linden 1'
  final String? location;

  const WasteCalendarEvent({
    required this.start,
    this.end,
    required this.summary,
    this.category,
    this.location,
  });

  factory WasteCalendarEvent.fromJson(Map<String, dynamic> json) {
    return WasteCalendarEvent(
      start: json['start'] as String? ?? '',
      end: json['end'] as String?,
      summary: json['summary'] as String? ?? '',
      category: json['category'] as String?,
      location: json['location'] as String?,
    );
  }
}
