import 'dart:convert';
import '../config/app_config.dart';

// Conditional import für Web vs Mobile
import 'api_client_web.dart' if (dart.library.io) 'api_client_io.dart';

abstract class ApiClientBase {
  Future<Map<String, dynamic>> get(String endpoint);
  Future<Map<String, dynamic>> post(String endpoint, Map<String, dynamic> body);
  Future<Map<String, dynamic>> put(String endpoint, Map<String, dynamic> body);
  void dispose();
}

class ApiClient implements ApiClientBase {
  final String baseUrl;
  final ApiClientBase _impl;

  ApiClient({String? baseUrl})
      : baseUrl = baseUrl ?? AppConfig.backendUrl,
        _impl = createApiClient(baseUrl ?? AppConfig.backendUrl);

  @override
  Future<Map<String, dynamic>> get(String endpoint) => _impl.get(endpoint);

  @override
  Future<Map<String, dynamic>> post(String endpoint, Map<String, dynamic> body) =>
      _impl.post(endpoint, body);

  @override
  Future<Map<String, dynamic>> put(String endpoint, Map<String, dynamic> body) =>
      _impl.put(endpoint, body);

  @override
  void dispose() => _impl.dispose();
}
