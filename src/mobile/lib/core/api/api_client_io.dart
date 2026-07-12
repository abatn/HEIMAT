import 'dart:convert';
import 'package:http/http.dart' as http;

import 'api_client.dart';

ApiClientBase createApiClient(String baseUrl) => ApiClientIO(baseUrl);

class ApiClientIO implements ApiClientBase {
  final String baseUrl;
  final http.Client _client = http.Client();

  ApiClientIO(this.baseUrl);

  @override
  Future<Map<String, dynamic>> get(String endpoint) async {
    final response = await _client.get(
      Uri.parse('$baseUrl$endpoint'),
      headers: {'Content-Type': 'application/json'},
    );
    return json.decode(response.body);
  }

  @override
  Future<Map<String, dynamic>> post(String endpoint, Map<String, dynamic> body) async {
    final response = await _client.post(
      Uri.parse('$baseUrl$endpoint'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(body),
    );
    return json.decode(response.body);
  }

  @override
  Future<Map<String, dynamic>> put(String endpoint, Map<String, dynamic> body) async {
    final response = await _client.put(
      Uri.parse('$baseUrl$endpoint'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(body),
    );
    return json.decode(response.body);
  }

  @override
  void dispose() => _client.close();
}
