import 'package:flutter_test/flutter_test.dart';
import '../lib/features/ai_chat/presentation/ai_chat_provider.dart';
import '../lib/features/ai_chat/ai_chat_dto.dart';

void main() {
  // ==================================================================
  // Group 1: AiChatProvider Initial State
  // ==================================================================
  group('AiChatProvider initial state', () {
    late AiChatProvider provider;

    setUp(() {
      provider = AiChatProvider();
    });

    test('should not be loading initially', () {
      expect(provider.isLoading, false);
    });

    test('should have no error initially', () {
      expect(provider.error, isNull);
    });

    test('should have empty messages initially', () {
      expect(provider.messages, isEmpty);
    });

    test('should have null coordinates initially', () {
      expect(provider.currentLat, isNull);
      expect(provider.currentLng, isNull);
    });

    test('should have default model name', () {
      expect(provider.modelName, 'Ollama');
    });

    test('setLocation should update coordinates', () {
      provider.setLocation(52.52, 13.41);
      expect(provider.currentLat, 52.52);
      expect(provider.currentLng, 13.41);
    });

    test('clear should reset messages and error', () {
      provider.clear();
      expect(provider.messages, isEmpty);
      expect(provider.error, isNull);
    });

    test('maxMessages should be 50', () {
      expect(AiChatProvider.maxMessages, 50);
    });
  });

  // ==================================================================
  // Group 2: Quick Suggestions
  // ==================================================================
  group('Quick Suggestions', () {
    test('should have 4 quick suggestions', () {
      expect(AiChatProvider.quickSuggestions.length, 4);
    });

    test('should have weather suggestion', () {
      final weather = AiChatProvider.quickSuggestions
          .firstWhere((s) => s.label == 'Wetter heute');
      expect(weather.question, contains('Wetter'));
    });

    test('should have air quality suggestion', () {
      final air = AiChatProvider.quickSuggestions
          .firstWhere((s) => s.label == 'Luftqualität');
      expect(air.question, contains('Luftqualität'));
    });
  });

  // ==================================================================
  // Group 3: ChatMessage DTO
  // ==================================================================
  group('ChatMessage', () {
    test('user message should have user role', () {
      final msg = ChatMessage.user('Hallo');
      expect(msg.role, ChatRole.user);
      expect(msg.content, 'Hallo');
    });

    test('assistant message should have assistant role', () {
      final msg = ChatMessage.assistant('Hallo zurück');
      expect(msg.role, ChatRole.assistant);
      expect(msg.content, 'Hallo zurück');
    });

    test('system message should have system role', () {
      final msg = ChatMessage.system('Hinweis');
      expect(msg.role, ChatRole.system);
      expect(msg.content, 'Hinweis');
    });
  });

  // ==================================================================
  // Group 4: ChatResponse fromJson
  // ==================================================================
  group('ChatResponse fromJson', () {
    test('should parse ok response', () {
      final json = {
        'status': 'ok',
        'response': 'Hallo!',
        'model': 'qwen2.5:3b',
      };
      final response = ChatResponse.fromJson(json);
      expect(response.status, 'ok');
      expect(response.response, 'Hallo!');
      expect(response.model, 'qwen2.5:3b');
      expect(response.isError, false);
    });

    test('should parse error response', () {
      final json = {
        'status': 'error',
        'response': 'Fehler',
      };
      final response = ChatResponse.fromJson(json);
      expect(response.isError, true);
    });

    test('should parse fallback response', () {
      final json = {
        'status': 'fallback',
        'response': 'Offline',
      };
      final response = ChatResponse.fromJson(json);
      expect(response.isFallback, true);
    });
  });
}
