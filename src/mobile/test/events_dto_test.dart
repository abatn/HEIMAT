import 'package:flutter_test/flutter_test.dart';
import '../lib/features/events/events_provider.dart';
import '../lib/features/events/events_dto.dart';

void main() {
  // ==================================================================
  // Group 1: EventsResponse fromJson
  // ==================================================================
  group('EventsResponse fromJson', () {
    test('should parse full response correctly', () {
      final json = {
        'count': 2,
        'center': {'lat': 52.52, 'lng': 13.41},
        'radius': 10,
        'events': [
          {
            'id': '1',
            'name': 'Konzert',
            'description': 'Live-Musik',
            'category': 'Kultur',
            'startDate': '2026-08-10T20:00:00Z',
            'endDate': '2026-08-10T23:00:00Z',
            'location': 'Berlin',
            'lat': 52.52,
            'lng': 13.41,
            'url': 'https://example.de',
            'source': 'wikidata',
          },
          {
            'id': '2',
            'name': 'Flohmarkt',
            'description': '',
            'category': 'Markt',
            'source': 'osm',
          },
        ],
      };
      final response = EventsResponse.fromJson(json);
      expect(response.count, 2);
      expect(response.events.length, 2);
      expect(response.lat, 52.52);
      expect(response.lng, 13.41);
    });

    test('should use 0 as default for missing center coordinates', () {
      final json = <String, dynamic>{
        'count': 0,
        'events': [],
      };
      final response = EventsResponse.fromJson(json);
      expect(response.lat, 0);
      expect(response.lng, 0);
    });

    test('should handle null events list', () {
      final json = <String, dynamic>{
        'count': 0,
        'events': null,
      };
      final response = EventsResponse.fromJson(json);
      expect(response.events, isEmpty);
    });
  });

  // ==================================================================
  // Group 2: EventDto fromJson
  // ==================================================================
  group('EventDto fromJson', () {
    test('should parse full dto correctly', () {
      final json = {
        'id': '1',
        'name': 'Konzert',
        'description': 'Live-Musik',
        'category': 'Kultur',
        'startDate': '2026-08-10T20:00:00Z',
        'endDate': '2026-08-10T23:00:00Z',
        'location': 'Berlin',
        'lat': 52.52,
        'lng': 13.41,
        'url': 'https://example.de',
        'source': 'wikidata',
      };
      final dto = EventDto.fromJson(json);
      expect(dto.id, '1');
      expect(dto.name, 'Konzert');
      expect(dto.description, 'Live-Musik');
      expect(dto.category, 'Kultur');
      expect(dto.startDate, '2026-08-10T20:00:00Z');
      expect(dto.endDate, '2026-08-10T23:00:00Z');
      expect(dto.location, 'Berlin');
      expect(dto.lat, 52.52);
      expect(dto.lng, 13.41);
      expect(dto.url, 'https://example.de');
      expect(dto.source, 'wikidata');
    });

    test('should use defaults for missing fields', () {
      final json = <String, dynamic>{};
      final dto = EventDto.fromJson(json);
      expect(dto.id, '');
      expect(dto.name, '');
      expect(dto.description, '');
      expect(dto.category, 'Veranstaltung');
      expect(dto.source, 'osm');
      expect(dto.startDate, isNull);
      expect(dto.endDate, isNull);
      expect(dto.location, isNull);
      expect(dto.lat, isNull);
      expect(dto.lng, isNull);
      expect(dto.url, isNull);
    });
  });

  // ==================================================================
  // Group 3: EventsProvider Initial State
  // ==================================================================
  group('EventsProvider initial state', () {
    late EventsProvider provider;

    setUp(() {
      provider = EventsProvider();
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

    test('should have empty events list initially', () {
      expect(provider.events, isEmpty);
    });

    test('should have count 0 initially', () {
      expect(provider.count, 0);
    });

    test('should have null coordinates initially', () {
      expect(provider.lat, isNull);
      expect(provider.lng, isNull);
    });

    test('should have all as default category', () {
      expect(provider.selectedCategory, 'all');
    });

    test('should have empty categories initially', () {
      expect(provider.categories, isEmpty);
    });

    test('setCategory should update selectedCategory', () {
      provider.setCategory('Kultur');
      expect(provider.selectedCategory, 'Kultur');
    });

    test('clear should reset all state', () {
      provider.setCategory('Test');
      provider.clear();
      expect(provider.isLoading, false);
      expect(provider.error, isNull);
      expect(provider.response, isNull);
      expect(provider.lat, isNull);
      expect(provider.lng, isNull);
      expect(provider.selectedCategory, 'all');
    });
  });
}
