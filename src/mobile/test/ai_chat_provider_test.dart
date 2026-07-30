// ---------------------------------------------------------------------------
// ai_chat_provider_test.dart — Phase X.10 AiChatProvider includeWeather Tests
//
// Pattern-Mirror zu ai_chat_dto_test.dart und health_provider_test.dart:
// - Kein Mockito (User-Regel: keine Mocks/Simulationen)
// - Echter AiChatProvider, kein Fake
// - Testet NUR getServiceContext() — keine HTTP-Abhängigkeit
// - sendMessage()-Tests entfernt: HTTP-Calls sind im CI ohne Netzwerk
//   nicht deterministisch testbar (Mock-Policy: keine Mocks)
// - 4 Tests in 1 Gruppe: getServiceContext (4)
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
          reason: 'includeWeather:false => weather darf NICHT im Context sein');
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
}
