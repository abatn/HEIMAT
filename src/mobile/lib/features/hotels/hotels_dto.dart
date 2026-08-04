/// hotels_dto.dart — DTO for Hotels API Response
///
/// Backend: GET /api/hotels?lat=...&lng=...&radius=...

class HotelsResponse {
  final int count;
  final List<HotelDto> hotels;
  final double lat;
  final double lng;
  final double radius;

  HotelsResponse({
    required this.count,
    required this.hotels,
    required this.lat,
    required this.lng,
    required this.radius,
  });

  factory HotelsResponse.fromJson(Map<String, dynamic> json) {
    final center = json['center'] as Map<String, dynamic>?;
    return HotelsResponse(
      count: json['count'] as int? ?? 0,
      hotels: (json['hotels'] as List<dynamic>?)
              ?.map((h) => HotelDto.fromJson(h as Map<String, dynamic>))
              .toList() ??
          [],
      lat: (center?['lat'] as num?)?.toDouble() ?? 52.52,
      lng: (center?['lng'] as num?)?.toDouble() ?? 13.41,
      radius: (json['radius'] as num?)?.toDouble() ?? 5,
    );
  }
}

class HotelDto {
  final String id;
  final String name;
  final String type;
  final int? stars;
  final String? address;
  final String? phone;
  final String? website;
  final double lat;
  final double lng;
  final double? distanceKm;
  final String? openingHours;

  HotelDto({
    required this.id,
    required this.name,
    required this.type,
    this.stars,
    this.address,
    this.phone,
    this.website,
    required this.lat,
    required this.lng,
    this.distanceKm,
    this.openingHours,
  });

  factory HotelDto.fromJson(Map<String, dynamic> json) {
    return HotelDto(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      type: json['type'] as String? ?? 'Unterkunft',
      stars: json['stars'] as int?,
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
