import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:heimat_app/features/miniprogram/domain/service_registry.dart';

/// Phase X.1 Tests — ServiceRegistry ohne IFrame-Fallback.
///
/// **User-Regel-Konform:** Alle 10 Services muessen via `nativeBuilder`
/// aufgeloest werden. KEIN IFrame, KEIN WebView, KEIN externer Webseiten-Aufruf.
void main() {
  setUp(() {
    // ServiceRegistry ist ein Singleton mit Lazy-Init.
    // Vor jedem Test initialize() aufrufen damit _definitions befuellt ist.
    ServiceRegistry.instance.initialize();
  });

  group('ServiceRegistry - alle 10 Services', () {
    const expectedIds = <String>[
      'weather',
      'air',
      'waste',
      'mobility',
      'finance',
      'health',
      'events',
      'jobs',
      'hotels',
      'buergeramt',
    ];

    test('10 erwartete Service-IDs sind vollstaendig registriert', () {
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
}
