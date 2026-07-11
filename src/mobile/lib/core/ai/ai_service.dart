import 'package:http/http.dart' as http;
import 'dart:convert';

class AiService {
  final String mlServiceUrl;

  AiService({this.mlServiceUrl = 'http://10.0.2.2:8000'});

  Future<Map<String, dynamic>> predictDelay({
    required String line,
    required int hour,
    required int dayOfWeek,
    String weather = 'clear',
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$mlServiceUrl/predict/delay'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'line': line,
          'hour': hour,
          'day_of_week': dayOfWeek,
          'weather': weather,
        }),
      );

      if (response.statusCode == 200) {
        return json.decode(response.body);
      } else {
        throw Exception('ML Service Error: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('ML Service unavailable: $e');
    }
  }

  Future<Map<String, dynamic>> predictBudgetCategory({
    required String description,
    required double amount,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$mlServiceUrl/predict/budget-category'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'description': description,
          'amount': amount,
        }),
      );

      if (response.statusCode == 200) {
        return json.decode(response.body);
      } else {
        throw Exception('ML Service Error: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('ML Service unavailable: $e');
    }
  }

  Future<bool> healthCheck() async {
    try {
      final response = await http.get(Uri.parse('$mlServiceUrl/health'));
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }
}

final aiService = AiService();
