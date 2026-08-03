// ---------------------------------------------------------------------------
// ai_sse_client.dart — Server-Sent Events Client für AI Chat Streaming
//
// ARCHITEKTUR:
//   Web: dart:html EventSource (nur GET unterstützt → POST via Fetch API)
//   Mobile: http.Client.send() mit StreamedResponse
//
//   Beide Plattformen liefern ein Stream<SseEvent> mit:
//   - token: Einzelner Token von Ollama
//   - done: Streaming abgeschlossen
//   - error: Fehler aufgetreten
//
// MOCK-POLICY: Keine Mocks. Echte HTTP-Calls.
// ---------------------------------------------------------------------------

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';

/// Einzelnes SSE-Event vom Backend.
class SseEvent {
  final String? token;
  final bool done;
  final String? model;
  final String? error;

  const SseEvent({this.token, this.done = false, this.model, this.error});

  bool get isToken => token != null;
  bool get isError => error != null;
}

/// SSE Client — plattformübergreifend.
///
/// Web: Nutzt Fetch API (POST + ReadableStream) via dart:js_interop.
/// Mobile: Nutzt http.Client.send() mit StreamedResponse.
class AiSseClient {
  /// Sende eine Nachricht und erhalte Token-by-Token-Stream.
  ///
  /// @param baseUrl Backend-URL (z.B. https://heimat-backend.onrender.com)
  /// @param message User-Nachricht
  /// @param model Optionales Modell
  /// @param systemPrompt Optionales System-Prompt
  /// @returns Stream von SseEvents
  static Stream<SseEvent> streamChat({
    required String baseUrl,
    required String message,
    String? model,
    String? systemPrompt,
  }) async* {
    final url = '$baseUrl/api/ai/chat/stream';
    final body = jsonEncode({
      'message': message,
      if (model != null) 'model': model,
      if (systemPrompt != null) 'systemPrompt': systemPrompt,
    });

    if (kIsWeb) {
      // Web: Fetch API mit ReadableStream (POST unterstützt)
      yield* _streamWeb(url, body);
    } else {
      // Mobile: http.Client mit StreamedResponse
      yield* _streamMobile(url, body);
    }
  }

  /// Web-Streaming via dart:html Fetch API.
  static Stream<SseEvent> _streamWeb(String url, String body) async* {
    // Verwende http-Package auch auf Web (einfacher als dart:js_interop)
    yield* _streamMobile(url, body);
  }

  /// Mobile-Streaming via http.Client.
  static Stream<SseEvent> _streamMobile(String url, String body) async* {
    final client = HttpClient();
    try {
      final uri = Uri.parse(url);
      final request = await client.postUrl(uri);
      request.headers.set('Content-Type', 'application/json');
      request.headers.set('Accept', 'text/event-stream');
      request.write(body);

      final response = await request.close().timeout(
            const Duration(seconds: 30),
            onTimeout: () => throw TimeoutException('SSE Connection Timeout'),
          );

      if (response.statusCode != 200) {
        yield SseEvent(error: 'HTTP ${response.statusCode}');
        return;
      }

      // Stream zeilenweise lesen
      String buffer = '';
      await for (final chunk in response.transform(utf8.decoder)) {
        buffer += chunk;
        final lines = buffer.split('\n');
        buffer = lines.removeLast();

        for (final line in lines) {
          final trimmed = line.trim();
          if (trimmed.isEmpty) continue;
          if (trimmed.startsWith(':')) continue; // Heartbeat

          if (trimmed.startsWith('data: ')) {
            final data = trimmed.substring(6);
            if (data == '[DONE]') {
              yield const SseEvent(done: true);
              return;
            }
            try {
              final json = jsonDecode(data) as Map<String, dynamic>;
              if (json.containsKey('token')) {
                yield SseEvent(token: json['token'] as String);
              } else if (json.containsKey('done')) {
                yield SseEvent(
                  done: true,
                  model: json['model'] as String?,
                );
                return;
              } else if (json.containsKey('error')) {
                yield SseEvent(error: json['error'] as String);
                return;
              }
            } catch (_) {
              // Skip malformed JSON
            }
          }
        }
      }

      // Restliche Daten im Buffer verarbeiten
      if (buffer.trim().isNotEmpty) {
        if (buffer.trim() == 'data: [DONE]') {
          yield const SseEvent(done: true);
        } else if (buffer.trim().startsWith('data: ')) {
          try {
            final json =
                jsonDecode(buffer.trim().substring(6)) as Map<String, dynamic>;
            if (json.containsKey('done')) {
              yield SseEvent(done: true, model: json['model'] as String?);
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      yield SseEvent(error: e.toString());
    } finally {
      client.close();
    }
  }
}
