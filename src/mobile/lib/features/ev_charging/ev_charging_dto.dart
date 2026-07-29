/// EV Charging DTO Layer — spiegelt Backend /api/ev-charging/stations JSON.
///
/// **Datenquelle:** OpenStreetMap Overpass via Backend-EvChargingService.
/// **Lizenz:** ODbL-1.0 (OpenStreetMap)

/// EvChargingStation — E-Ladestation aus OSM.
class EvChargingStation {
  final String id;
  final String osmType; // 'node' | 'way' | 'relation'
  final String name;
  final String? operator;
  final String? network;
  final double latitude;
  final double longitude;
  final int? capacity;
  final List<ChargingSocket> sockets;
  final String? fee; // 'yes' | 'no'
  final String? openingHours;
  final String attribution;

  const EvChargingStation({
    required this.id,
    required this.osmType,
    required this.name,
    this.operator,
    this.network,
    required this.latitude,
    required this.longitude,
    this.capacity,
    required this.sockets,
    this.fee,
    this.openingHours,
    this.attribution = 'OpenStreetMap',
  });

  factory EvChargingStation.fromJson(Map<String, dynamic> json) {
    return EvChargingStation(
      id: json['id'] as String? ?? '',
      osmType: json['osm_type'] as String? ?? 'node',
      name: json['name'] as String? ?? '',
      operator: json['operator'] as String?,
      network: json['network'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      capacity: json['capacity'] as int?,
      sockets: (json['sockets'] as List<dynamic>?)
              ?.map((s) => ChargingSocket.fromJson(s as Map<String, dynamic>))
              .toList() ??
          const [],
      fee: json['fee'] as String?,
      openingHours: json['opening_hours'] as String?,
      attribution: json['attribution'] as String? ?? 'OpenStreetMap',
    );
  }

  bool get isFree => fee == null || fee == 'no';
  bool get is247 => openingHours == '24/7';
}

/// ChargingSocket — einzelner Stecker-Typ (Type2, CCS, CHAdeMO, etc.)
class ChargingSocket {
  final String type; // 'type2', 'ccs', 'chademo', 'type2:output', etc.
  final int count;

  const ChargingSocket({required this.type, required this.count});

  factory ChargingSocket.fromJson(Map<String, dynamic> json) {
    return ChargingSocket(
      type: json['type'] as String? ?? '',
      count: json['count'] as int? ?? 0,
    );
  }
}

/// EvChargingResponse — Root-Container für /api/ev-charging/stations
class EvChargingResponse {
  final String status;
  final List<EvChargingStation> stations;
  final int count;
  final double radiusKm;
  final String attribution;
  final String license;

  const EvChargingResponse({
    required this.status,
    required this.stations,
    required this.count,
    required this.radiusKm,
    required this.attribution,
    required this.license,
  });

  factory EvChargingResponse.fromJson(Map<String, dynamic> json) {
    return EvChargingResponse(
      status: json['status'] as String? ?? '',
      stations: (json['stations'] as List<dynamic>?)
              ?.map(
                  (s) => EvChargingStation.fromJson(s as Map<String, dynamic>))
              .toList() ??
          const [],
      count: json['count'] as int? ?? 0,
      radiusKm: (json['radius_km'] as num?)?.toDouble() ?? 5.0,
      attribution: json['attribution'] as String? ?? 'OpenStreetMap',
      license: json['license'] as String? ?? 'ODbL-1.0',
    );
  }
}
