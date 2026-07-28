import 'package:flutter_test/flutter_test.dart';
import 'package:heimat_app/features/waste/waste_dto.dart';

void main() {
  group('WasteCalendarEvent', () {
    test('parses full event JSON correctly', () {
      final json = {
        'start': '2026-01-15T06:00:00',
        'end': '2026-01-15T07:00:00',
        'summary': 'Restmülltonne',
        'category': 'restmuell',
        'location': 'Berlin, Unter den Linden 1',
      };
      final e = WasteCalendarEvent.fromJson(json);
      expect(e.start, '2026-01-15T06:00:00');
      expect(e.end, '2026-01-15T07:00:00');
      expect(e.summary, 'Restmülltonne');
      expect(e.category, 'restmuell');
      expect(e.location, 'Berlin, Unter den Linden 1');
    });

    test('handles null end/category/location (DURATION-only events)', () {
      final json = {
        'start': '2026-01-15T06:00:00',
        'summary': 'Biotonne',
      };
      final e = WasteCalendarEvent.fromJson(json);
      expect(e.start, '2026-01-15T06:00:00');
      expect(e.end, isNull);
      expect(e.summary, 'Biotonne');
      expect(e.category, isNull);
      expect(e.location, isNull);
    });

    test('handles empty summary as fallback (no crash)', () {
      final json = {'start': '2026-01-17T06:00:00'};
      final e = WasteCalendarEvent.fromJson(json);
      expect(e.start, '2026-01-17T06:00:00');
      expect(e.summary, ''); // fallback per fromJson contract
      expect(e.category, isNull);
      expect(e.location, isNull);
    });

    test('handles malformed event JSON (empty start → empty string fallback)', () {
      final e = WasteCalendarEvent.fromJson(<String, dynamic>{});
      expect(e.start, '');
      expect(e.summary, '');
      expect(e.end, isNull);
    });
  });

  group('WasteCalendarResponse', () {
    test('parses full Berlin positive-control response', () {
      final json = {
        'city': 'berlin',
        'displayName': 'Berlin',
        'weeks': 4,
        'events': [
          {
            'start': '2026-01-15T06:00:00',
            'end': '2026-01-15T07:00:00',
            'summary': 'Restmülltonne',
            'category': 'restmuell',
          },
          {
            'start': '2026-01-17T06:00:00',
            'end': '2026-01-17T07:00:00',
            'summary': 'Biotonne',
            'category': 'bio',
          },
        ],
        'source': 'https://www.bsr.de/abfuhrkalender-ical',
        'attribution': 'Berliner Stadtreinigung (BSR) — CC-BY 4.0',
        'fetchedAt': '2026-01-10T10:00:00.000Z',
        'cached': false,
        'status': 'ok',
      };
      final r = WasteCalendarResponse.fromJson(json);
      expect(r.city, 'berlin');
      expect(r.displayName, 'Berlin');
      expect(r.weeks, 4);
      expect(r.events.length, 2);
      expect(r.events[0].summary, 'Restmülltonne');
      expect(r.source, contains('bsr'));
      expect(r.attribution, contains('BSR'));
      expect(r.fetchedAt, '2026-01-10T10:00:00.000Z');
      expect(r.cached, false);
      expect(r.status, 'ok');
    });

    test('parses Hamburg 422 AddressRequiredError payload graceful-fail', () {
      final json = {
        'status': 'error',
        'code': 'ADDRESS_REQUIRED',
        'message':
            'Abfallkalender für Hamburg benötigt eine Adresse (Straße + Hausnummer).',
        'city': 'hamburg',
        'displayName': 'Hamburg',
      };
      final r = WasteCalendarResponse.fromJson(json);
      expect(r.status, 'error');
      expect(r.events, isEmpty);
      expect(r.city, 'hamburg');
      expect(r.displayName, 'Hamburg');
      expect(r.attribution, ''); // 422 hat keine attribution
    });

    test('handles empty events list (e.g. Berlin keine Termine im Fenster)', () {
      final json = {
        'status': 'ok',
        'city': 'berlin',
        'displayName': 'Berlin',
        'weeks': 4,
        'events': [],
        'source': 'test',
        'attribution': 'BSR',
        'fetchedAt': '2026-01-10T10:00:00.000Z',
        'cached': false,
      };
      final r = WasteCalendarResponse.fromJson(json);
      expect(r.events, isEmpty);
      expect(r.weeks, 4);
    });

    test('handles cached:true flag (Backend-24h-Cache-Hit)', () {
      final json = {
        'status': 'ok',
        'city': 'berlin',
        'displayName': 'Berlin',
        'weeks': 4,
        'events': [
          {'start': '2026-01-17T06:00:00', 'summary': 'Biotonne'}
        ],
        'source': 'cache-hit',
        'attribution': 'BSR',
        'fetchedAt': '2026-01-09T08:00:00.000Z',
        'cached': true,
      };
      final r = WasteCalendarResponse.fromJson(json);
      expect(r.cached, true);
      expect(r.events.length, 1);
    });

    test('coerces weeks from integer JSON', () {
      final json = {
        'status': 'ok',
        'city': 'muenchen',
        'displayName': 'München',
        'weeks': 8,
        'events': [],
        'source': 'awb',
        'attribution': 'AWB',
        'fetchedAt': '2026-01-10T10:00:00.000Z',
        'cached': false,
      };
      final r = WasteCalendarResponse.fromJson(json);
      expect(r.weeks, 8);
      expect(r.displayName, 'München');
    });

    test('handles missing optional attribution (default empty string)', () {
      final json = {
        'status': 'ok',
        'city': 'berlin',
        'displayName': 'Berlin',
        'weeks': 4,
        'events': [],
        'source': 'test',
        'fetchedAt': '2026-01-10T10:00:00.000Z',
        'cached': false,
      };
      final r = WasteCalendarResponse.fromJson(json);
      expect(r.attribution, ''); // backend default
    });
  });
}
