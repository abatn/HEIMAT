/// Parking DTO Layer — spiegelt Backend /api/parking/spots JSON.
///
/// **Datenquelle:** OpenStreetMap Overpass via Backend-ParkingService.
/// **Lizenz:** ODbL-1.0 (OpenStreetMap)

/// ParkingSpot — Parkplatz aus OSM.
class ParkingSpot {
  final String id;
  final String osmType; // 'node' | 'way' | 'relation'
  final String name;
  final String? operator;
  final String? parkingType;  // surface, underground, multi-storey, etc.
  final String? access;       // public, private, customers
  final String? fee;          // yes, no
  final int? capacity;
  final String? surface;      // asphalt, paved, gravel, etc.
  final String? lit;          // yes, no
  final double latitude;
  final double longitude;
  final String? openingHours;
  final String attribution;

  const ParkingSpot({
    required this.id,
    required this.osmType,
    required this.name,
    this.operator,
    this.parkingType,
    this.access,
    this.fee,
    this.capacity,
    this.surface,
    this.lit,
    required this.latitude,
    required this.longitude,
    this.openingHours,
    this.attribution = 'OpenStreetMap',
  });

  factory ParkingSpot.fromJson(Map<String, dynamic> json) {
    return ParkingSpot(
      id: json['id'] as String? ?? '',
      osmType: json['osm_type'] as String? ?? 'node',
      name: json['name'] as String? ?? '',
      operator: json['operator'] as String?,
      parkingType: json['parking_type'] as String?,
      access: json['access'] as String?,
      fee: json['fee'] as String?,
      capacity: json['capacity'] as int?,
      surface: json['surface'] as String?,
      lit: json['lit'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      openingHours: json['opening_hours'] as String?,
      attribution: json['attribution'] as String? ?? 'OpenStreetMap',
    );
  }

  bool get isFree => fee == null || fee == 'no';
  bool get is247 => openingHours == '24/7';
  bool get isLit => lit == 'yes';
  bool get isPublic => access == null || access == 'public';

  String get parkingTypeLabel {
    switch (parkingType) {
      case 'surface': return 'Freifläche';
      case 'underground': return 'Tiefgarage';
      case 'multi-storey': return 'Parkhaus';
      case 'sheds': return 'Unterstand';
      case 'box': return 'Garage';
      default: return parkingType ?? 'Parkplatz';
    }
  }
}

/// ParkingResponse — Root-Container für /api/parking/spots
class ParkingResponse {
  final String status;
  final List<ParkingSpot> spots;
  final int count;
  final double radiusKm;
  final String attribution;
  final String license;

  const ParkingResponse({
    required this.status,
    required this.spots,
    required this.count,
    required this.radiusKm,
    required this.attribution,
    required this.license,
  });

  factory ParkingResponse.fromJson(Map<String, dynamic> json) {
    return ParkingResponse(
      status: json['status'] as String? ?? '',
      spots: (json['spots'] as List<dynamic>?)
              ?.map((s) => ParkingSpot.fromJson(s as Map<String, dynamic>))
              .toList() ??
          const [],
      count: json['count'] as int? ?? 0,
      radiusKm: (json['radius_km'] as num?)?.toDouble() ?? 2.0,
      attribution: json['attribution'] as String? ?? 'OpenStreetMap',
      license: json['license'] as String? ?? 'ODbL-1.0',
    );
  }
}
