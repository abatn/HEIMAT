import 'package:flutter_test/flutter_test.dart';
import 'package:heimat_app/features/miniprogram/domain/service_registry.dart';

/// Phase X.1 Tests — ServiceRegistry ohne IFrame-Fallback.
///
/// **User-Regel-Konform:** Alle 10 Services muessen via `nativeBuilder`
/// aufgeloest werden. KEIN IFrame, KEIN WebView, KEIN externer Webseiten-Aufruf.
void main() {
  setUp(() {
    ServiceRegistry.instance.initialize();
  });

  group('ServiceRegistry - alle 14 Services', () {
    const expectedIds = <String>[
      'mobility',
      'parking',
      'ev_charging',
      'health',
      'checkin',
      'weather',
      'air',
      'waste',
      'buergeramt',
      'jobs',
      'events',
      'hotels',
      'finance',
      'ai_chat',
    ];

    test('14 erwartete Service-IDs sind vollstaendig registriert', () {
      for (final id in expectedIds) {
        final def = ServiceRegistry.instance.lookup(id);
        expect(def, isNotNull, reason: 'Service "$id" fehlt in der Registry');
      }
    });

    for (final id in expectedIds) {
      test('Service "$id" hat isNative=true und non-null nativeBuilder', () {
        final def = ServiceRegistry.instance.lookup(id);
        expect(def, isNotNull);
        expect(def!.isNative, isTrue,
            reason: 'isNative("$id") muss true sein (KEIN IFrame-Fallback)');
        expect(def.nativeBuilder, isNotNull,
            reason: 'nativeBuilder("$id") muss non-null sein');
      });
    }

    test('Unbekannte Service-ID liefert null (kein Crash)', () {
      final def =
          ServiceRegistry.instance.lookup('nicht-existierender-service');
      expect(def, isNull);
      expect(ServiceRegistry.instance.isNative('nicht-existierender-service'),
          isFalse);
    });
  });

  group('ServiceRegistry - Kategorien', () {
    test('categoriesGrouped liefert 6 Kategorien', () {
      final grouped = ServiceRegistry.instance.categoriesGrouped();
      expect(grouped.length, equals(6));
      final names = grouped.map((e) => e.$1).toList();
      expect(names, contains('Mobilität'));
      expect(names, contains('Gesundheit'));
      expect(names, contains('Alltag'));
      expect(names, contains('Kultur & Reise'));
      expect(names, contains('Finanzen'));
      expect(names, contains('AI'));
    });

    test('Mobilität-Kategorie hat 3 Services', () {
      final grouped = ServiceRegistry.instance.categoriesGrouped();
      final mobility = grouped.firstWhere((e) => e.$1 == 'Mobilität');
      expect(mobility.$2.length, equals(3));
    });

    test('Services sind nach displayOrder sortiert', () {
      final grouped = ServiceRegistry.instance.categoriesGrouped();
      for (final (_, services) in grouped) {
        for (int i = 1; i < services.length; i++) {
          expect(
            services[i].displayOrder,
            greaterThanOrEqualTo(services[i - 1].displayOrder),
            reason:
                'displayOrder muss aufsteigend sein in ${services[0].category}',
          );
        }
      }
    });
  });

  group('ServiceRegistry - häufig benutzt', () {
    test('frequentlyUsed liefert mindestens 4 Services', () {
      final frequent = ServiceRegistry.instance.frequentlyUsed();
      expect(frequent.length, greaterThanOrEqualTo(4));
    });

    test('frequentlyUsed Services haben isFrequentlyUsed=true', () {
      final frequent = ServiceRegistry.instance.frequentlyUsed();
      for (final def in frequent) {
        expect(def.isFrequentlyUsed, isTrue,
            reason: '${def.id} muss isFrequentlyUsed=true haben');
      }
    });

    test('frequentlyUsed ist nach displayOrder sortiert', () {
      final frequent = ServiceRegistry.instance.frequentlyUsed();
      for (int i = 1; i < frequent.length; i++) {
        expect(
          frequent[i].displayOrder,
          greaterThanOrEqualTo(frequent[i - 1].displayOrder),
        );
      }
    });
  });
}
