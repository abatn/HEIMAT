import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/api/api_client.dart';
import '../ai_chat_dto.dart';

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
  String _model = '';
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
      label: 'Ärzte in Berlin',
      question: 'Welche Ärzte gibt es in Berlin?',
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
  String get model => _model;
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
      final body = <String, dynamic>{
        'message': text.trim(),
      };

      // Service-Context anhängen (für Health AI, Wetter, etc.)
      // Health-Tab nutzt includeWeather: false (weather ≠ health)
      final services = getServiceContext(includeWeather: includeWeather);
      if (services.isNotEmpty) {
        body['services'] = services;
      }

      // Health-Triage (RAG + Ollama) braucht bis zu 60s Backend + Netzwerk-Latenz
      final data = await apiPost('/api/ai/chat', body,
          timeout: const Duration(seconds: 120));

      final response = ChatResponse.fromJson(data);

      if (response.isError) {
        // Backend meldet Fehler
        _messages.add(ChatMessage.assistant(
          response.response.isNotEmpty
              ? response.response
              : 'Entschuldigung, ich habe einen internen Fehler. Bitte versuche es später erneut.',
        ));
      } else {
        // Normale Antwort anfügen
        _messages.add(ChatMessage.assistant(response.response));

        // Bei Fallback-Meldung: Hinweis auf Modell-Status
        if (response.isFallback) {
          _messages.add(ChatMessage.system(
            'Der KI-Assistent ist aktuell im Offline-Modus. '
            'Einige Funktionen sind eingeschränkt.',
          ));
        }
      }
    } catch (e) {
      _error = e.toString();
      // Bei Network-Fehler: Fallback-Nachricht mit Retry-Hinweis
      _messages.add(ChatMessage.assistant(
        'Der KI-Assistent ist nicht verfügbar. '
        'Bitte versuche es später erneut.',
      ));
      _messages.add(ChatMessage.system(
        'Tippe auf eine Frage unten, um erneut zu starten.',
      ));
    } finally {
      _isLoading = false;
      _trimHistory();
      notifyListeners();
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
  // setModel — Modell wechseln (optional, für zukünftige Modelle)
  // ------------------------------------------------------------------
  void setModel(String model) {
    if (_model == model) return;
    _model = model;
    notifyListeners();
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
