import 'package:flutter_test/flutter_test.dart';
import '../lib/features/hotels/hotels_provider.dart';
import '../lib/features/hotels/hotels_dto.dart';

void main() {
  // ==================================================================
  // Group 1: HotelsResponse fromJson
  // ==================================================================
  group('HotelsResponse fromJson', () {
    test('should parse full response correctly', () {
      final json = {
        'count': 2,
        'center': {'lat': 52.52, 'lng': 13.41},
        'radius': 5,
        'hotels': [
          {
            'id': '1',
            'name': 'Hotel Berlin',
            'type': 'Hotel',
            'stars': 4,
            'address': 'Berlin',
            'lat': 52.52,
            'lng': 13.41,
            'distance_km': 1.2,
          },
        ],
      };
      final response = HotelsResponse.fromJson(json);
      expect(response.count, 2);
      expect(response.hotels.length, 1);
      expect(response.lat, 52.52);
      expect(response.lng, 13.41);
      expect(response.radius, 5);
    });

    test('should use 0 as default for missing center coordinates', () {
      final json = <String, dynamic>{
        'count': 0,
        'hotels': [],
      };
      final response = HotelsResponse.fromJson(json);
      expect(response.lat, 0);
      expect(response.lng, 0);
    });

    test('should handle null hotels list', () {
      final json = <String, dynamic>{
        'count': 0,
        'hotels': null,
      };
      final response = HotelsResponse.fromJson(json);
      expect(response.hotels, isEmpty);
    });
  });

  // ==================================================================
  // Group 2: HotelDto fromJson
  // ==================================================================
  group('HotelDto fromJson', () {
    test('should parse full dto correctly', () {
      final json = {
        'id': '1',
        'name': 'Hotel Berlin',
        'type': 'Hotel',
        'stars': 4,
        'address': 'Berlin',
        'phone': '+493012345',
        'website': 'https://example.de',
        'lat': 52.52,
        'lng': 13.41,
        'distance_km': 1.2,
        'openingHours': '24/7',
      };
      final dto = HotelDto.fromJson(json);
      expect(dto.id, '1');
      expect(dto.name, 'Hotel Berlin');
      expect(dto.type, 'Hotel');
      expect(dto.stars, 4);
      expect(dto.address, 'Berlin');
      expect(dto.phone, '+493012345');
      expect(dto.website, 'https://example.de');
      expect(dto.lat, 52.52);
      expect(dto.lng, 13.41);
      expect(dto.distanceKm, 1.2);
      expect(dto.openingHours, '24/7');
    });

    test('should use defaults for missing fields', () {
      final json = <String, dynamic>{};
      final dto = HotelDto.fromJson(json);
      expect(dto.id, '');
      expect(dto.name, '');
      expect(dto.type, 'Unterkunft');
      expect(dto.stars, isNull);
      expect(dto.lat, 0);
      expect(dto.lng, 0);
    });
  });

  // ==================================================================
  // Group 3: HotelsProvider Initial State
  // ==================================================================
  group('HotelsProvider initial state', () {
    late HotelsProvider provider;

    setUp(() {
      provider = HotelsProvider();
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

    test('should have empty hotels list initially', () {
      expect(provider.hotels, isEmpty);
    });

    test('should have count 0 initially', () {
      expect(provider.count, 0);
    });

    test('should have all as default type', () {
      expect(provider.selectedType, 'all');
    });

    test('setType should update selectedType', () {
      provider.setType('Hotel');
      expect(provider.selectedType, 'Hotel');
    });

    test('clear should reset all state', () {
      provider.setType('Test');
      provider.clear();
      expect(provider.isLoading, false);
      expect(provider.error, isNull);
      expect(provider.response, isNull);
      expect(provider.selectedType, 'all');
    });
  });
}
