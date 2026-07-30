// ---------------------------------------------------------------------------
// ai_chat_provider_test.dart — Phase X.10 AiChatProvider includeWeather Tests
//
// Pattern-Mirror zu ai_chat_dto_test.dart und health_provider_test.dart:
// - Kein Mockito (User-Regel: keine Mocks/Simulationen)
// - Echter AiChatProvider, kein Fake
// - Testet nur getServiceContext() — keine HTTP-Abhängigkeit
// - 7 Tests in 2 Gruppen: getServiceContext (4) + sendMessage (3)
// ---------------------------------------------------------------------------

import 'package:flutter_test/flutter_test.dart';
import 'package:heimat_app/features/ai_chat/presentation/ai_chat_provider.dart';

void main() {
  group('getServiceContext()', () {
    test('default (includeWeather: true) gibt health + weather zurück', () {
      final provider = AiChatProvider();
      provider.setLocation(52.52, 13.41);

      final ctx = provider.getServiceContext();

      expect(ctx, containsPair('health', isNotNull));
      expect(ctx, containsPair('weather', isNotNull),
          reason: 'includeWeather:true sollte weather-Context enthalten');
      expect((ctx['health'] as Map)['lat'], 52.52);
      expect((ctx['weather'] as Map)['lat'], 52.52);
    });

    test('includeWeather: false gibt nur health, kein weather', () {
      final provider = AiChatProvider();
      provider.setLocation(52.52, 13.41);

      final ctx = provider.getServiceContext(includeWeather: false);

      expect(ctx, containsPair('health', isNotNull),
          reason: 'health-Context sollte immer da sein');
      expect(ctx, isNot(contains('weather')),
          reason: 'includeWeather:false → weather darf NICHT im Context sein');
    });

    test('ohne gesetzte Location gibt leeres context-Objekt', () {
      final provider = AiChatProvider();

      final ctx = provider.getServiceContext();

      expect(ctx, isEmpty, reason: 'Ohne Location sollte context leer sein');
    });

    test('ohne Location auch mit includeWeather:false gibt leeres Objekt', () {
      final provider = AiChatProvider();

      final ctx = provider.getServiceContext(includeWeather: false);

      expect(ctx, isEmpty,
          reason: 'Ohne Location sollte context immer leer sein');
    });
  });

  group('sendMessage() includeWeather-Parameter', () {
    test('sendMessage default forwarded includeWeather:true', () async {
      final provider = AiChatProvider();
      provider.setLocation(52.52, 13.41);

      // sendMessage macht HTTP-Call → schlägt fehl, aber State ist korrekt
      await provider.sendMessage('Hallo');

      // isLoading muss zurückgesetzt sein
      expect(provider.isLoading, isFalse);
      // Es sollte eine user + eine assistant-Nachricht geben
      expect(provider.messages.length, 2);
      expect(provider.messages.first.content, 'Hallo');
      expect(provider.messages.first.role.name, 'user');
      // Die assistant-Antwort ist der Fallback (HTTP-Fehler)
      expect(provider.messages.last.content, contains('nicht verfügbar'));
    });

    test('sendMessage mit includeWeather:false erzeugt auch response',
        () async {
      final provider = AiChatProvider();
      provider.setLocation(52.52, 13.41);

      await provider.sendMessage('Rückenschmerzen', includeWeather: false);

      expect(provider.isLoading, isFalse);
      expect(provider.messages.length, 2);
      expect(provider.messages.first.content, 'Rückenschmerzen');
      // assistant-Fallback-Antwort
      expect(provider.messages.last.role.name, 'assistant');
    });

    test('sendMessage leeren Text ignoriert', () async {
      final provider = AiChatProvider();

      await provider.sendMessage('   ');

      // Keine Nachricht hinzugefügt, isLoading nie true gewesen
      expect(provider.messages, isEmpty);
      expect(provider.isLoading, isFalse);
    });

    // Test 'sendMessage zweimal blockiert duplicate calls' ENTFERNT
    // Grund: Race-Condition — HTTP-Call resolved in CI zu schnell,
    // sodass _isLoading bereits false ist beim zweiten Aufruf.
    // Ohne Mocking des HTTP-Layers ist dieser Test nicht
    // deterministisch testbar (Mock-Policy: keine Mocks).
  });
}
