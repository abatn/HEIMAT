import 'package:flutter_test/flutter_test.dart';
import '../lib/features/buergeramt/buergeramt_provider.dart';
import '../lib/features/buergeramt/buergeramt_dto.dart';

void main() {
  // ==================================================================
  // Group 1: BuergeramtResponse fromJson
  // ==================================================================
  group('BuergeramtResponse fromJson', () {
    test('should parse full response correctly', () {
      final json = {
        'count': 2,
        'center': {'lat': 52.52, 'lng': 13.41},
        'radius': 10,
        'aemter': [
          {
            'id': '1',
            'name': 'Buergeramt Mitte',
            'type': 'Buergeramt',
            'address': 'Rathausstr. 1',
            'phone': '+493012345',
            'website': 'https://example.de',
            'lat': 52.52,
            'lng': 13.41,
            'distance_km': 1.2,
            'openingHours': 'Mo-Fr 8-18',
          },
          {
            'id': '2',
            'name': 'Kreishaus',
            'type': 'Behoerde',
            'address': 'Hauptstr. 10',
            'lat': 52.53,
            'lng': 13.42,
            'distance_km': 2.5,
          },
        ],
      };
      final response = BuergeramtResponse.fromJson(json);
      expect(response.count, 2);
      expect(response.aemter.length, 2);
      expect(response.lat, 52.52);
      expect(response.lng, 13.41);
      expect(response.radius, 10);
    });

    test('should use 0 as default for missing center coordinates', () {
      final json = <String, dynamic>{
        'count': 0,
        'aemter': [],
      };
      final response = BuergeramtResponse.fromJson(json);
      expect(response.lat, 0);
      expect(response.lng, 0);
      expect(response.radius, 10);
    });

    test('should handle null aemter list', () {
      final json = <String, dynamic>{
        'count': 0,
        'center': {'lat': 52.0, 'lng': 13.0},
        'aemter': null,
      };
      final response = BuergeramtResponse.fromJson(json);
      expect(response.aemter, isEmpty);
    });

    test('should handle missing radius with default 10', () {
      final json = <String, dynamic>{
        'count': 0,
        'aemter': [],
      };
      final response = BuergeramtResponse.fromJson(json);
      expect(response.radius, 10);
    });
  });

  // ==================================================================
  // Group 2: BuergeramtDto fromJson
  // ==================================================================
  group('BuergeramtDto fromJson', () {
    test('should parse full dto correctly', () {
      final json = {
        'id': '1',
        'name': 'Buergeramt Mitte',
        'type': 'Buergeramt',
        'address': 'Rathausstr. 1',
        'phone': '+493012345',
        'website': 'https://example.de',
        'lat': 52.52,
        'lng': 13.41,
        'distance_km': 1.2,
        'openingHours': 'Mo-Fr 8-18',
      };
      final dto = BuergeramtDto.fromJson(json);
      expect(dto.id, '1');
      expect(dto.name, 'Buergeramt Mitte');
      expect(dto.type, 'Buergeramt');
      expect(dto.address, 'Rathausstr. 1');
      expect(dto.phone, '+493012345');
      expect(dto.website, 'https://example.de');
      expect(dto.lat, 52.52);
      expect(dto.lng, 13.41);
      expect(dto.distanceKm, 1.2);
      expect(dto.openingHours, 'Mo-Fr 8-18');
    });

    test('should use defaults for missing fields', () {
      final json = <String, dynamic>{};
      final dto = BuergeramtDto.fromJson(json);
      expect(dto.id, '');
      expect(dto.name, '');
      expect(dto.type, 'Behoerde');
      expect(dto.lat, 0);
      expect(dto.lng, 0);
      expect(dto.address, isNull);
      expect(dto.phone, isNull);
      expect(dto.website, isNull);
      expect(dto.distanceKm, isNull);
      expect(dto.openingHours, isNull);
    });

    test('should handle null distance_km', () {
      final json = <String, dynamic>{
        'lat': 52.52,
        'lng': 13.41,
      };
      final dto = BuergeramtDto.fromJson(json);
      expect(dto.distanceKm, isNull);
    });
  });

  // ==================================================================
  // Group 3: BuergeramtProvider Initial State
  // ==================================================================
  group('BuergeramtProvider initial state', () {
    late BuergeramtProvider provider;

    setUp(() {
      provider = BuergeramtProvider();
    });

    test('should not be loading initially', () {
      expect(provider.isLoading, false);
    });

    test('should have no error initially', () {
      expect(provider.error, isNull);
    });

    test('should have null response initially', () {
      expect(provider.response, isNull);
    });

    test('should have empty aemter list initially', () {
      expect(provider.aemter, isEmpty);
    });

    test('should have count 0 initially', () {
      expect(provider.count, 0);
    });

    test('should have null coordinates initially', () {
      expect(provider.lat, isNull);
      expect(provider.lng, isNull);
    });

    test('clear should reset all state', () {
      provider.clear();
      expect(provider.isLoading, false);
      expect(provider.error, isNull);
      expect(provider.response, isNull);
      expect(provider.lat, isNull);
      expect(provider.lng, isNull);
    });
  });
}
