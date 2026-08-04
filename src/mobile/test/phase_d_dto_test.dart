/// phase_d_dto_test.dart — Unit Tests für Phase D DTOs
///
/// Testet die FromJson-Parsing für EventsResponse, HotelsResponse, BuergeramtResponse.

import 'package:flutter_test/flutter_test.dart';
import 'package:heimat_app/features/events/events_dto.dart';
import 'package:heimat_app/features/hotels/hotels_dto.dart';
import 'package:heimat_app/features/buergeramt/buergeramt_dto.dart';

void main() {
  // =========================================================================
  // EventsResponse
  // =========================================================================

  group('EventsResponse', () {
    test('should parse from JSON correctly', () {
      final json = {
        'count': 2,
        'events': [
          {
            'id': 'osm/123',
            'name': 'Weihnachtsmarkt',
            'description': 'Berliner Weihnachtsmarkt',
            'category': 'Markt',
            'startDate': null,
            'endDate': null,
            'location': 'Alexanderplatz',
            'lat': 52.5219,
            'lng': 13.4132,
            'url': null,
            'source': 'osm',
          },
          {
            'id': 'wikidata/Q123',
            'name': 'Berliner Philharmoniker',
            'description': 'Konzert',
            'category': 'Kultur',
            'startDate': '2026-08-10T19:00:00Z',
            'endDate': '2026-08-10T21:00:00Z',
            'location': 'Philharmonie',
            'lat': 52.5069,
            'lng': 13.3586,
            'url': 'https://www.berliner-philharmoniker.de',
            'source': 'wikidata',
          },
        ],
        'center': {'lat': 52.52, 'lng': 13.41},
        'radius': 5,
      };

      final response = EventsResponse.fromJson(json);

      expect(response.count, 2);
      expect(response.events.length, 2);
      expect(response.lat, 52.52);
      expect(response.lng, 13.41);
      expect(response.radius, 5.0);

      // First event
      expect(response.events[0].id, 'osm/123');
      expect(response.events[0].name, 'Weihnachtsmarkt');
      expect(response.events[0].category, 'Markt');
      expect(response.events[0].source, 'osm');
      expect(response.events[0].lat, 52.5219);

      // Second event
      expect(response.events[1].id, 'wikidata/Q123');
      expect(response.events[1].name, 'Berliner Philharmoniker');
      expect(response.events[1].source, 'wikidata');
      expect(response.events[1].startDate, '2026-08-10T19:00:00Z');
    });

    test('should handle empty response', () {
      final json = {
        'count': 0,
        'events': [],
        'center': {'lat': 52.52, 'lng': 13.41},
        'radius': 10,
      };

      final response = EventsResponse.fromJson(json);

      expect(response.count, 0);
      expect(response.events, isEmpty);
    });

    test('should handle missing center', () {
      final json = {
        'count': 0,
        'events': [],
      };

      final response = EventsResponse.fromJson(json);

      expect(response.lat, 52.52); // default
      expect(response.lng, 13.41); // default
      expect(response.radius, 10); // default
    });
  });

  // =========================================================================
  // HotelsResponse
  // =========================================================================

  group('HotelsResponse', () {
    test('should parse from JSON correctly', () {
      final json = {
        'count': 1,
        'hotels': [
          {
            'id': 'osm/456',
            'name': 'Hotel Adlon',
            'type': 'Hotel',
            'stars': 5,
            'address': 'Unter den Linden 77, 10117 Berlin',
            'phone': '+49 30 22620',
            'website': 'https://www.hotel-adlon.de',
            'lat': 52.5168,
            'lng': 13.3797,
            'distance_km': 2.5,
            'openingHours': '24/7',
          },
        ],
        'center': {'lat': 52.52, 'lng': 13.41},
        'radius': 5,
      };

      final response = HotelsResponse.fromJson(json);

      expect(response.count, 1);
      expect(response.hotels.length, 1);
      expect(response.hotels[0].name, 'Hotel Adlon');
      expect(response.hotels[0].type, 'Hotel');
      expect(response.hotels[0].stars, 5);
      expect(response.hotels[0].distanceKm, 2.5);
    });

    test('should handle null stars', () {
      final json = {
        'count': 1,
        'hotels': [
          {
            'id': 'osm/789',
            'name': 'Hostel',
            'type': 'Hostel',
            'stars': null,
            'lat': 52.52,
            'lng': 13.41,
          },
        ],
        'center': {'lat': 52.52, 'lng': 13.41},
        'radius': 5,
      };

      final response = HotelsResponse.fromJson(json);

      expect(response.hotels[0].stars, isNull);
    });
  });

  // =========================================================================
  // BuergeramtResponse
  // =========================================================================

  group('BuergeramtResponse', () {
    test('should parse from JSON correctly', () {
      final json = {
        'count': 2,
        'aemter': [
          {
            'id': 'nominatim/101',
            'name': 'Bürgeramt Mitte',
            'type': 'Bürgeramt',
            'address': 'Karl-Marx-Allee 31, 10178 Berlin',
            'phone': null,
            'website': null,
            'lat': 52.5219,
            'lng': 13.4132,
            'distance_km': 1.2,
            'openingHours': null,
          },
          {
            'id': 'nominatim/102',
            'name': 'Rathaus Kreuzberg',
            'type': 'Rathaus',
            'address': 'Oranienstraße 185, 10999 Berlin',
            'phone': null,
            'website': null,
            'lat': 52.4986,
            'lng': 13.4285,
            'distance_km': 3.5,
            'openingHours': null,
          },
        ],
        'center': {'lat': 52.52, 'lng': 13.41},
        'radius': 10,
      };

      final response = BuergeramtResponse.fromJson(json);

      expect(response.count, 2);
      expect(response.aemter.length, 2);
      expect(response.aemter[0].type, 'Bürgeramt');
      expect(response.aemter[1].type, 'Rathaus');
    });

    test('should handle empty response', () {
      final json = {
        'count': 0,
        'aemter': [],
        'center': {'lat': 52.52, 'lng': 13.41},
        'radius': 10,
      };

      final response = BuergeramtResponse.fromJson(json);

      expect(response.count, 0);
      expect(response.aemter, isEmpty);
    });
  });
}
