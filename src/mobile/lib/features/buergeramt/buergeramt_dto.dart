/// buergeramt_dto.dart — DTO for Bürgeramt API Response
///
/// Backend: GET /api/buergeramt?lat=...&lng=...&radius=...

class BuergeramtResponse {
  final int count;
  final List<BuergeramtDto> aemter;
  final double lat;
  final double lng;
  final double radius;

  BuergeramtResponse({
    required this.count,
    required this.aemter,
    required this.lat,
    required this.lng,
    required this.radius,
  });

  factory BuergeramtResponse.fromJson(Map<String, dynamic> json) {
    final center = json['center'] as Map<String, dynamic>?;
    return BuergeramtResponse(
      count: json['count'] as int? ?? 0,
      aemter: (json['aemter'] as List<dynamic>?)
              ?.map((a) => BuergeramtDto.fromJson(a as Map<String, dynamic>))
              .toList() ??
          [],
      lat: (center?['lat'] as num?)?.toDouble() ?? 52.52,
      lng: (center?['lng'] as num?)?.toDouble() ?? 13.41,
      radius: (json['radius'] as num?)?.toDouble() ?? 10,
    );
  }
}

class BuergeramtDto {
  final String id;
  final String name;
  final String type;
  final String? address;
  final String? phone;
  final String? website;
  final double lat;
  final double lng;
  final double? distanceKm;
  final String? openingHours;

  BuergeramtDto({
    required this.id,
    required this.name,
    required this.type,
    this.address,
    this.phone,
    this.website,
    required this.lat,
    required this.lng,
    this.distanceKm,
    this.openingHours,
  });

  factory BuergeramtDto.fromJson(Map<String, dynamic> json) {
    return BuergeramtDto(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      type: json['type'] as String? ?? 'Behörde',
      address: json['address'] as String?,
      phone: json['phone'] as String?,
      website: json['website'] as String?,
      lat: (json['lat'] as num?)?.toDouble() ?? 0,
      lng: (json['lng'] as num?)?.toDouble() ?? 0,
      distanceKm: (json['distance_km'] as num?)?.toDouble(),
      openingHours: json['openingHours'] as String?,
    );
  }
}
