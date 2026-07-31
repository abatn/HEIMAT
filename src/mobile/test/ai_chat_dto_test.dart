// ---------------------------------------------------------------------------
// ai_chat_dto_test.dart — Phase AI-2 AI Chat DTO Tests
//
// Pattern-Mirror zu air_quality_dto_test.dart:
// - Kein Mockito (User-Regel: keine Mocks/Simulationen)
// - Realistische JSON-Fragmente (null-Werte, fehlende Felder, korrekte Typen)
// - 8 Tests in 2 Gruppen: ChatMessage (4) + ChatResponse (4)
// ---------------------------------------------------------------------------

import 'package:flutter_test/flutter_test.dart';
import 'package:heimat_app/features/ai_chat/ai_chat_dto.dart';

void main() {
  group('ChatMessage.fromJson', () {
    test('vollständige user-Nachricht parsen', () {
      final json = {
        'role': 'user',
        'content': 'Wie ist das Wetter in Berlin?',
        'timestamp': '2026-07-28T14:30:00.000',
      };
      final msg = ChatMessage.fromJson(json);
      expect(msg.role, ChatRole.user);
      expect(msg.content, 'Wie ist das Wetter in Berlin?');
      expect(msg.timestamp.year, 2026);
    });

    test('assistant-Nachricht parsen', () {
      final json = {
        'role': 'assistant',
        'content': 'In Berlin ist es aktuell 22°C und sonnig. Ein schöner Tag!',
      };
      final msg = ChatMessage.fromJson(json);
      expect(msg.role, ChatRole.assistant);
      expect(msg.content, contains('22°C'));
    });

    test('fehlende Felder → Leerstring-Defaults', () {
      final json = <String, dynamic>{};
      final msg = ChatMessage.fromJson(json);
      expect(msg.role, ChatRole.assistant); // default bei unbekanntem role
      expect(msg.content, '');
      expect(msg.timestamp, isNotNull);
    });

    test('null-Werte werden korrekt behandelt', () {
      final json = {
        'role': null,
        'content': null,
        'timestamp': null,
      };
      final msg = ChatMessage.fromJson(json);
      expect(msg.role, ChatRole.assistant); // null → assistant default
      expect(msg.content, '');
      expect(msg.timestamp, isNotNull);
    });
  });

  group('ChatResponse.fromJson', () {
    test('erfolgreiche Antwort parsen', () {
      final json = {
        'status': 'ok',
        'response':
            'In Berlin sind es aktuell 22°C und sonnig. Zieh dich leicht an!',
        'model': 'llama3.1:8b',
      };
      final resp = ChatResponse.fromJson(json);
      expect(resp.status, 'ok');
      expect(resp.isOk, true);
      expect(resp.isFallback, false);
      expect(resp.response, contains('22°C'));
      expect(resp.model, 'llama3.1:8b');
    });

    test('fallback-Status erkennen', () {
      final json = {
        'status': 'fallback',
        'response': 'KI-Assistent ist nicht verfügbar.',
        'model': 'llama3.1:8b',
      };
      final resp = ChatResponse.fromJson(json);
      expect(resp.isFallback, true);
      expect(resp.isOk, false);
      expect(resp.response, contains('nicht verfügbar'));
    });

    test('error-Status erkennen', () {
      final json = {
        'status': 'error',
        'response': 'Interner Serverfehler',
        'model': 'llama3.1:8b',
      };
      final resp = ChatResponse.fromJson(json);
      expect(resp.isError, true);
      expect(resp.isOk, false);
      expect(resp.response, 'Interner Serverfehler');
    });

    test('fehlende Felder → Defaults', () {
      final json = <String, dynamic>{};
      final resp = ChatResponse.fromJson(json);
      expect(resp.status, 'error');
      expect(resp.isError, true);
      expect(resp.response, '');
      expect(resp.model, 'qwen2.5:3b');
    });
  });
}
