import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/api/api_client.dart';
import '../../../core/config/app_config.dart';
import '../ai_chat_dto.dart';
import '../ai_sse_client.dart';

/// AiChatProvider — ChatGPT-ähnlicher Chat mit HEIMATs lokalem Ollama.
///
/// **Backend:** POST /api/ai/chat → ollamaService.ts → llama3.1:8b (localhost)
/// **Service-Context:** Übergibt Gesundheits-, Wetter- und Standort-Daten im Chat.
/// **Kein Cache:** Chat-Verlauf nur in-memory (kein SharedPreferences).
class AiChatProvider extends ChangeNotifier {
  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  bool _isLoading = false;
  String? _error;
  List<ChatMessage> _messages = [];
  double? _currentLat;
  double? _currentLng;

  // ------------------------------------------------------------------
  // Quick Suggestion Chips (für Empty-State)
  // ------------------------------------------------------------------
  static const List<QuickSuggestion> quickSuggestions = [
    QuickSuggestion(
      icon: Icons.wb_sunny_outlined,
      label: 'Wetter heute',
      question: 'Wie ist das Wetter heute?',
    ),
    QuickSuggestion(
      icon: Icons.air_outlined,
      label: 'Luftqualität',
      question: 'Wie ist die Luftqualität?',
    ),
    QuickSuggestion(
      icon: Icons.local_hospital_outlined,
      label: 'Ärzte in meiner Nähe',
      question: 'Welche Ärzte gibt es in meiner Nähe?',
    ),
    QuickSuggestion(
      icon: Icons.info_outline,
      label: 'Was kannst du?',
      question: 'Was kannst du alles?',
    ),
  ];

  // ------------------------------------------------------------------
  // Getter
  // ------------------------------------------------------------------
  bool get isLoading => _isLoading;
  String? get error => _error;
  List<ChatMessage> get messages => List.unmodifiable(_messages);
  double? get currentLat => _currentLat;
  double? get currentLng => _currentLng;

  /// Maximum Chat-Nachrichten (verhindert Speicher-Overflow)
  static const int maxMessages = 50;

  // ------------------------------------------------------------------
  // setLocation — Standort setzen (für Service-Context)
  // ------------------------------------------------------------------
  void setLocation(double lat, double lng) {
    _currentLat = lat;
    _currentLng = lng;
  }

  // ------------------------------------------------------------------
  // getServiceContext — Baut Service-Context für Backend-Anfrage
  //
  // [includeWeather]: Health-Tab sollte kein weather mitsenden (weather
  //  hat nichts mit Gesundheit zu tun). Standard: true für AI-Dashboard.
  // ------------------------------------------------------------------
  Map<String, dynamic> getServiceContext({bool includeWeather = true}) {
    final context = <String, dynamic>{};
    if (_currentLat != null && _currentLng != null) {
      context['health'] = {'lat': _currentLat, 'lng': _currentLng};
      if (includeWeather) {
        context['weather'] = {'lat': _currentLat, 'lng': _currentLng};
      }
    }
    return context;
  }

  // ------------------------------------------------------------------
  // sendMessage — POST an Backend, Antwort anhängen
  //
  // [includeWeather]: Health-Tab sollte kein weather mitsenden.
  //  Siehe getServiceContext() für Details. Standard: true.
  // ------------------------------------------------------------------
  Future<void> sendMessage(String text, {bool includeWeather = true}) async {
    if (text.trim().isEmpty) return;
    if (_isLoading) return;

    _error = null;

    // User-Nachricht sofort anfügen
    _messages.add(ChatMessage.user(text.trim()));
    _trimHistory();
    notifyListeners();

    // Loading starten
    _isLoading = true;
    notifyListeners();

    try {
      // --- STREAMING PATH ---
      // Versuche Streaming (token-by-token) — bei Fehler: Fallback auf non-streaming
      final buffer = StringBuffer();
      bool streamingWorked = false;

      try {
        final stream = AiSseClient.streamChat(
          baseUrl: AppConfig.backendUrl,
          message: text.trim(),
        );

        await for (final event in stream) {
          if (event.isToken) {
            buffer.write(event.token);
            streamingWorked = true;
            // UI updaten mit aktuellem Buffer
            _updateStreamingMessage(buffer.toString());
          } else if (event.isError) {
            // Streaming-Fehler → Fallback auf non-streaming
            debugPrint('SSE Error: ${event.error}');
            break;
          } else if (event.done) {
            break;
          }
        }
      } catch (e) {
        debugPrint('SSE Stream failed, falling back to non-streaming: $e');
      }

      if (streamingWorked && buffer.isNotEmpty) {
        // Streaming hat funktionieren — finalisiere Nachricht
        _finalizeStreamingMessage(buffer.toString());
      } else {
        // --- NON-STREAMING FALLBACK ---
        await _sendMessageNonStreaming(text.trim(), includeWeather);
      }
    } catch (e) {
      _error = e.toString();
      _messages.add(ChatMessage.assistant(
        'Der KI-Assistent ist nicht verfügbar. '
        'Bitte versuche es später erneut.',
      ));
    } finally {
      _isLoading = false;
      _trimHistory();
      notifyListeners();
    }
  }

  // ------------------------------------------------------------------
  // _updateStreamingMessage — Aktualisiere die letzte Assistant-Nachricht
  // mit dem aktuellen Streaming-Buffer.
  // ------------------------------------------------------------------
  void _updateStreamingMessage(String text) {
    if (_messages.isNotEmpty && _messages.last.role == ChatRole.assistant) {
      // Letzte Assistant-Nachricht updaten
      _messages[_messages.length - 1] = ChatMessage.assistant(text);
    } else {
      // Neue Assistant-Nachricht anfügen
      _messages.add(ChatMessage.assistant(text));
    }
    notifyListeners();
  }

  // ------------------------------------------------------------------
  // _finalizeStreamingMessage — Ersetze die Streaming-Nachricht durch
  // die finale Version mit korrektem Timestamp.
  // ------------------------------------------------------------------
  void _finalizeStreamingMessage(String text) {
    if (_messages.isNotEmpty && _messages.last.role == ChatRole.assistant) {
      _messages[_messages.length - 1] = ChatMessage.assistant(text);
    }
  }

  // ------------------------------------------------------------------
  // _sendMessageNonStreaming — Klassischer POST (Fallback)
  // ------------------------------------------------------------------
  Future<void> _sendMessageNonStreaming(
      String text, bool includeWeather) async {
    final body = <String, dynamic>{'message': text};
    final services = getServiceContext(includeWeather: includeWeather);
    if (services.isNotEmpty) {
      body['services'] = services;
    }

    final data = await apiPost('/api/ai/chat', body,
        timeout: const Duration(seconds: 120));

    final response = ChatResponse.fromJson(data);

    if (response.isError) {
      _messages.add(ChatMessage.assistant(
        response.response.isNotEmpty
            ? response.response
            : 'Entschuldigung, ich habe einen internen Fehler.',
      ));
    } else {
      _messages.add(ChatMessage.assistant(response.response));
      if (response.isFallback) {
        _messages.add(ChatMessage.system(
          'Der KI-Assistent ist aktuell im Offline-Modus.',
        ));
      }
    }
  }

  // ------------------------------------------------------------------
  // retryLast — Letzte User-Nachricht erneut senden (nach Fehler)
  // ------------------------------------------------------------------
  Future<void> retryLast() async {
    // Letzte User-Nachricht finden
    final lastUserIndex = _messages.lastIndexWhere(
      (m) => m.role == ChatRole.user,
    );
    if (lastUserIndex < 0) return;

    // Nachfolgende System/Assistant-Nachrichten entfernen
    _messages = _messages.sublist(0, lastUserIndex + 1);
    notifyListeners();

    // Erneut senden
    await sendMessage(_messages.last.content);
  }

  // ------------------------------------------------------------------
  // clear — Chat-Verlauf löschen
  // ------------------------------------------------------------------
  void clear() {
    _messages = [];
    _error = null;
    notifyListeners();
  }

  // ------------------------------------------------------------------
  // _trimHistory — Nachrichten-Limit einhalten (maxMessages)
  // ------------------------------------------------------------------
  void _trimHistory() {
    if (_messages.length > maxMessages) {
      _messages = _messages.sublist(_messages.length - maxMessages);
    }
  }
}

/// QuickSuggestion — Vorschlag-Chip für schnelle Fragen.
class QuickSuggestion {
  final IconData icon;
  final String label;
  final String question;

  const QuickSuggestion({
    required this.icon,
    required this.label,
    required this.question,
  });
}
