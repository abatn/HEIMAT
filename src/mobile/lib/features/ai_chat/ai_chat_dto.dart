/// AI Chat DTO Layer — spiegelt Backend POST /api/ai/chat JSON.
///
/// **Backend:** ollamaService.ts → llama3.1:8b auf localhost:11434
/// **Fallback:** Bei offline-Ollama liefert Backend 'status: fallback'
/// mit deutscher Meldung "KI-Assistent ist nicht verfügbar".

/// Rolle einer Chat-Nachricht.
enum ChatRole { system, user, assistant }

/// ChatMessage — einzelne Nachricht im Chat-Verlauf.
class ChatMessage {
  final ChatRole role;
  final String content;
  final DateTime timestamp;

  const ChatMessage({
    required this.role,
    required this.content,
    required this.timestamp,
  });

  factory ChatMessage.user(String content) {
    return ChatMessage(
      role: ChatRole.user,
      content: content,
      timestamp: DateTime.now(),
    );
  }

  factory ChatMessage.assistant(String content) {
    return ChatMessage(
      role: ChatRole.assistant,
      content: content,
      timestamp: DateTime.now(),
    );
  }

  factory ChatMessage.system(String content) {
    return ChatMessage(
      role: ChatRole.system,
      content: content,
      timestamp: DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
        'role': role.name,
        'content': content,
      };

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      role: _parseRole(json['role'] as String?),
      content: json['content'] as String? ?? '',
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  static ChatRole _parseRole(String? role) {
    switch (role) {
      case 'system':
        return ChatRole.system;
      case 'user':
        return ChatRole.user;
      case 'assistant':
        return ChatRole.assistant;
      default:
        return ChatRole.assistant;
    }
  }
}

/// ChatResponse — Backend-Antwort von POST /api/ai/chat.
class ChatResponse {
  final String status; // 'ok' | 'fallback' | 'error'
  final String response;
  final String model;

  const ChatResponse({
    required this.status,
    required this.response,
    required this.model,
  });

  factory ChatResponse.fromJson(Map<String, dynamic> json) {
    return ChatResponse(
      status: json['status'] as String? ?? 'error',
      response: json['response'] as String? ?? '',
      model: json['model'] as String? ?? 'llama3.1:8b',
    );
  }

  bool get isFallback => status == 'fallback';
  bool get isError => status == 'error';
  bool get isOk => status == 'ok';
}
