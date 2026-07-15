import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import '../../../core/config/app_config.dart';

class FinanceProvider extends ChangeNotifier {
  static const String _currentUserId = 'user-demo-001';
  double _balance = 0.0;
  bool _isLoading = false;
  String? _error;
  bool _hasLoaded = false;

  double get balance => _balance;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasLoaded => _hasLoaded;

  Future<void> loadWallet() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final url = '${AppConfig.backendUrl}/api/finance/wallet/$_currentUserId';
      final response = await http
          .get(Uri.parse(url), headers: {'Content-Type': 'application/json'})
          .timeout(const Duration(seconds: 30));
      if (response.statusCode != 200) {
        throw Exception('Server error: ${response.statusCode}');
      }
      final data = json.decode(response.body);
      _balance = double.parse(data['wallet']['balance'].toString());
    } catch (e) {
      _error = 'Wallet konnte nicht geladen werden: $e';
    } finally {
      _isLoading = false;
      _hasLoaded = true;
      notifyListeners();
    }
  }
}
