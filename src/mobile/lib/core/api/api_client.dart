import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';

final http.Client _client = http.Client();

String get _baseUrl => AppConfig.backendUrl;

/// Retry-Helfer für transient-errors (503 Render Cold-Start, 429 Rate-Limit).
/// maxRetries=2, exponential backoff (1s, 2s).
Future<T> _withRetry<T>(Future<T> Function() fn, {int maxRetries = 2}) async {
  int attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e) {
      attempt++;
      if (attempt > maxRetries) rethrow;
      // Nur bei 503/502/429 retry — andere Fehler sofort werfen
      final msg = e.toString();
      if (!msg.contains('503') &&
          !msg.contains('502') &&
          !msg.contains('429')) {
        rethrow;
      }
      await Future.delayed(Duration(milliseconds: 1000 * attempt));
    }
  }
}

Future<Map<String, dynamic>> apiGet(String endpoint) async {
  return _withRetry(() async {
    final response = await _client.get(
      Uri.parse('$_baseUrl$endpoint'),
      headers: {'Content-Type': 'application/json'},
    ).timeout(const Duration(seconds: 30));
    if (response.statusCode == 429) {
      throw Exception(
        'Zu viele Anfragen. Bitte warte kurz '
        'und versuche es erneut.',
      );
    }
    if (response.statusCode >= 500) {
      throw Exception(
        'Server-Fehler (${response.statusCode}). '
        'Bitte versuche es später erneut.',
      );
    }
    return json.decode(response.body);
  });
}

Future<Map<String, dynamic>> apiPost(
  String endpoint,
  Map<String, dynamic> body, {
  Duration timeout = const Duration(seconds: 30),
}) async {
  return _withRetry(() async {
    final response = await _client
        .post(
          Uri.parse('$_baseUrl$endpoint'),
          headers: {'Content-Type': 'application/json'},
          body: json.encode(body),
        )
        .timeout(timeout);
    if (response.statusCode == 429) {
      throw Exception(
        'Zu viele Anfragen. Bitte warte kurz '
        'und versuche es erneut.',
      );
    }
    if (response.statusCode >= 500) {
      throw Exception(
        'Server-Fehler (${response.statusCode}). '
        'Bitte versuche es später erneut.',
      );
    }
    return json.decode(response.body);
  });
}

Future<Map<String, dynamic>> apiPut(
    String endpoint, Map<String, dynamic> body) async {
  return _withRetry(() async {
    final response = await _client
        .put(
          Uri.parse('$_baseUrl$endpoint'),
          headers: {'Content-Type': 'application/json'},
          body: json.encode(body),
        )
        .timeout(const Duration(seconds: 30));
    if (response.statusCode == 429) {
      throw Exception(
        'Zu viele Anfragen. Bitte warte kurz '
        'und versuche es erneut.',
      );
    }
    if (response.statusCode >= 500) {
      throw Exception(
        'Server-Fehler (${response.statusCode}). '
        'Bitte versuche es später erneut.',
      );
    }
    return json.decode(response.body);
  });
}
