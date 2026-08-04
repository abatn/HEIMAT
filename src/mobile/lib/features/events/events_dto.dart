/// events_dto.dart — DTO for Events API Response
///
/// Backend: GET /api/events?lat=...&lng=...&radius=...

class EventsResponse {
  final int count;
  final List<EventDto> events;
  final double lat;
  final double lng;
  final double radius;

  EventsResponse({
    required this.count,
    required this.events,
    required this.lat,
    required this.lng,
    required this.radius,
  });

  factory EventsResponse.fromJson(Map<String, dynamic> json) {
    final center = json['center'] as Map<String, dynamic>?;
    return EventsResponse(
      count: json['count'] as int? ?? 0,
      events: (json['events'] as List<dynamic>?)
              ?.map((e) => EventDto.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      lat: (center?['lat'] as num?)?.toDouble() ?? 52.52,
      lng: (center?['lng'] as num?)?.toDouble() ?? 13.41,
      radius: (json['radius'] as num?)?.toDouble() ?? 10,
    );
  }
}

class EventDto {
  final String id;
  final String name;
  final String description;
  final String category;
  final String? startDate;
  final String? endDate;
  final String? location;
  final double? lat;
  final double? lng;
  final String? url;
  final String source;

  EventDto({
    required this.id,
    required this.name,
    required this.description,
    required this.category,
    this.startDate,
    this.endDate,
    this.location,
    this.lat,
    this.lng,
    this.url,
    required this.source,
  });

  factory EventDto.fromJson(Map<String, dynamic> json) {
    return EventDto(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      category: json['category'] as String? ?? 'Veranstaltung',
      startDate: json['startDate'] as String?,
      endDate: json['endDate'] as String?,
      location: json['location'] as String?,
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      url: json['url'] as String?,
      source: json['source'] as String? ?? 'osm',
    );
  }
}
