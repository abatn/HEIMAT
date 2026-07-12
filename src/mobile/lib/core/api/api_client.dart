import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';

final http.Client _client = http.Client();

String get _baseUrl => AppConfig.backendUrl;

Future<Map<String, dynamic>> apiGet(String endpoint) async {
  final response = await _client.get(
    Uri.parse('$_baseUrl$endpoint'),
    headers: {'Content-Type': 'application/json'},
  );
  return json.decode(response.body);
}

Future<Map<String, dynamic>> apiPost(String endpoint, Map<String, dynamic> body) async {
  final response = await _client.post(
    Uri.parse('$_baseUrl$endpoint'),
    headers: {'Content-Type': 'application/json'},
    body: json.encode(body),
  );
  return json.decode(response.body);
}

Future<Map<String, dynamic>> apiPut(String endpoint, Map<String, dynamic> body) async {
  final response = await _client.put(
    Uri.parse('$_baseUrl$endpoint'),
    headers: {'Content-Type': 'application/json'},
    body: json.encode(body),
  );
  return json.decode(response.body);
}
