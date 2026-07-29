import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../../core/api/api_client.dart';
import '../ai_chat_dto.dart';

/// AiChatProvider — ChatGPT-ähnlicher Chat mit HEIMATs lokalem Ollama.
///
/// **Backend:** POST /api/ai/chat → ollamaService.ts → llama3.1:8b (localhost)
/// **Fallback:** Bei offline-Ollama liefert Backend einen deutschen Hinweistext.
/// **Kein Cache:** Chat-Verlauf nur in-memory (kein SharedPreferences).
///
/// **Architektur (Mirror zu EvChargingProvider):**
/// - sendMessage(): POST-Nachricht + Antwort in _messages anhängen
/// - clear(): Chat-Verlauf löschen
/// - Loading-State: _isLoading während Backend-Antwort
class AiChatProvider extends ChangeNotifier {
  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  bool _isLoading = false;
  String? _error;
  List<ChatMessage> _messages = [];
  String _model = 'llama3.1:8b';

  // ------------------------------------------------------------------
  // Getter
  // ------------------------------------------------------------------
  bool get isLoading => _isLoading;
  String? get error => _error;
  List<ChatMessage> get messages => List.unmodifiable(_messages);
  String get model => _model;

  /// Maximum Chat-Nachrichten (verhindert Speicher-Overflow)
  static const int maxMessages = 50;

  // ------------------------------------------------------------------
  // sendMessage — POST an Backend, Antwort anhängen
  // ------------------------------------------------------------------
  Future<void> sendMessage(String text) async {
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
      final data = await apiPost('/api/ai/chat', {
        'message': text.trim(),
        'model': _model,
      });

      final response = ChatResponse.fromJson(data);

      // Antwort anfügen
      _messages.add(ChatMessage.assistant(response.response));
    } catch (e) {
      _error = e.toString();
      // Bei Network-Fehler: Fallback-Nachricht anfügen
      _messages.add(ChatMessage.assistant(
        'KI-Assistent ist nicht verfügbar. Bitte versuche es später erneut.',
      ));
    } finally {
      _isLoading = false;
      _trimHistory();
      notifyListeners();
    }
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
