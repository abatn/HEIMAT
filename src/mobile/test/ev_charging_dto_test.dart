import 'package:flutter_test/flutter_test.dart';
import 'package:heimat_app/features/ev_charging/ev_charging_dto.dart';

/// EvChargingDTO Tests — DTO-Parsing für Backend /api/ev-charging/stations.
///
/// **Mirror zu air_quality_dto_test.dart (10 Tests, 2 Groups):**
/// - ChargingSocket.fromJson: 4 Tests
/// - EvChargingStation.fromJson: 4 Tests
/// - EvChargingResponse.fromJson: 2 Tests
void main() {
  // ==================================================================
  // Group 1: ChargingSocket DTO
  // ==================================================================
  group('ChargingSocket.fromJson()', () {
    test('vollständiger Socket wird korrekt geparst', () {
      final json = {'type': 'type2', 'count': 2};

      final socket = ChargingSocket.fromJson(json);

      expect(socket.type, 'type2');
      expect(socket.count, 2);
    });

    test('fehlende Felder werden mit Defaults gefüllt', () {
      final json = <String, dynamic>{};

      final socket = ChargingSocket.fromJson(json);

      expect(socket.type, '');
      expect(socket.count, 0);
    });

    test('null-Werte werden zu Defaults', () {
      final json = {'type': null, 'count': null};

      final socket = ChargingSocket.fromJson(json);

      expect(socket.type, '');
      expect(socket.count, 0);
    });

    test('CCS Socket wird korrekt geparst', () {
      final json = {'type': 'ccs', 'count': 1};

      final socket = ChargingSocket.fromJson(json);

      expect(socket.type, 'ccs');
      expect(socket.count, 1);
    });
  });

  // ==================================================================
  // Group 2: EvChargingStation DTO
  // ==================================================================
  group('EvChargingStation.fromJson()', () {
    test('vollständige Station wird korrekt geparst', () {
      final json = {
        'id': 'node/429740871',
        'osm_type': 'node',
        'name': 'Innogy',
        'operator': 'E.ON',
        'network': 'innogy eRoaming',
        'latitude': 52.5236617,
        'longitude': 13.3808678,
        'capacity': 2,
        'sockets': [
          {'type': 'type2', 'count': 2},
          {'type': 'type2:output', 'count': 22},
        ],
        'fee': 'yes',
        'opening_hours': '24/7',
        'attribution': 'OpenStreetMap',
      };

      final station = EvChargingStation.fromJson(json);

      expect(station.id, 'node/429740871');
      expect(station.name, 'Innogy');
      expect(station.operator, 'E.ON');
      expect(station.network, 'innogy eRoaming');
      expect(station.latitude, 52.5236617);
      expect(station.longitude, 13.3808678);
      expect(station.capacity, 2);
      expect(station.sockets.length, 2);
      expect(station.sockets.first.type, 'type2');
      expect(station.fee, 'yes');
      expect(station.openingHours, '24/7');
      expect(station.attribution, 'OpenStreetMap');
      expect(station.isFree, isFalse);
      expect(station.is247, isTrue);
    });

    test('fehlende Felder werden mit Defaults gefüllt', () {
      final json = <String, dynamic>{};

      final station = EvChargingStation.fromJson(json);

      expect(station.id, '');
      expect(station.name, '');
      expect(station.operator, isNull);
      expect(station.sockets, isEmpty);
      expect(station.latitude, 0.0);
      expect(station.longitude, 0.0);
      expect(station.isFree, isTrue); // fee=null → isFree=true
      expect(station.is247, isFalse); // openingHours=null → is247=false
    });

    test('Station ohne Gebühr (fee=null) wird als kostenlos markiert', () {
      final json = {
        'id': 'node/1',
        'name': 'Free Station',
        'latitude': 52.5,
        'longitude': 13.4,
        'sockets': [],
      };

      final station = EvChargingStation.fromJson(json);

      expect(station.isFree, isTrue);
      expect(station.fee, isNull);
    });

    test('Station ohne Öffnungszeiten (opening_hours=null) ist nicht 24/7', () {
      final json = {
        'id': 'node/2',
        'name': 'Limited Hours',
        'latitude': 52.5,
        'longitude': 13.4,
        'sockets': [],
        'fee': 'no',
      };

      final station = EvChargingStation.fromJson(json);

      expect(station.isFree, isTrue); // fee='no'
      expect(station.is247, isFalse);
    });
  });

  // ==================================================================
  // Group 3: EvChargingResponse DTO
  // ==================================================================
  group('EvChargingResponse.fromJson()', () {
    test('volle Response wird korrekt geparst', () {
      final json = {
        'status': 'ok',
        'stations': [
          {
            'id': 'node/1',
            'name': 'Station 1',
            'latitude': 52.5,
            'longitude': 13.4,
            'sockets': [],
          },
        ],
        'count': 1,
        'radius_km': 5,
        'attribution': 'OpenStreetMap',
        'license': 'ODbL-1.0',
      };

      final response = EvChargingResponse.fromJson(json);

      expect(response.status, 'ok');
      expect(response.stations.length, 1);
      expect(response.count, 1);
      expect(response.radiusKm, 5);
      expect(response.attribution, 'OpenStreetMap');
      expect(response.license, 'ODbL-1.0');
    });

    test('fehlende Felder in Response werden mit Defaults gefüllt', () {
      final json = <String, dynamic>{};

      final response = EvChargingResponse.fromJson(json);

      expect(response.status, '');
      expect(response.stations, isEmpty);
      expect(response.count, 0);
      expect(response.radiusKm, 5.0);
      expect(response.attribution, 'OpenStreetMap');
      expect(response.license, 'ODbL-1.0');
    });
  });
}
