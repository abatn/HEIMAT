import 'dart:convert';
import 'dart:html' as html;

import 'api_client.dart';

ApiClientBase createApiClient(String baseUrl) => ApiClientWeb(baseUrl);

class ApiClientWeb implements ApiClientBase {
  final String baseUrl;

  ApiClientWeb(this.baseUrl);

  @override
  Future<Map<String, dynamic>> get(String endpoint) async {
    try {
      final response = await html.HttpRequest.request(
        '$baseUrl$endpoint',
        method: 'GET',
        requestHeaders: {'Content-Type': 'application/json'},
      );
      return json.decode(response.responseText!);
    } catch (e) {
      throw Exception('Network Error: $e');
    }
  }

  @override
  Future<Map<String, dynamic>> post(String endpoint, Map<String, dynamic> body) async {
    try {
      final response = await html.HttpRequest.request(
        '$baseUrl$endpoint',
        method: 'POST',
        sendData: json.encode(body),
        requestHeaders: {'Content-Type': 'application/json'},
      );
      return json.decode(response.responseText!);
    } catch (e) {
      throw Exception('Network Error: $e');
    }
  }

  @override
  Future<Map<String, dynamic>> put(String endpoint, Map<String, dynamic> body) async {
    try {
      final response = await html.HttpRequest.request(
        '$baseUrl$endpoint',
        method: 'PUT',
        sendData: json.encode(body),
        requestHeaders: {'Content-Type': 'application/json'},
      );
      return json.decode(response.responseText!);
    } catch (e) {
      throw Exception('Network Error: $e');
    }
  }

  @override
  void dispose() {}
}
