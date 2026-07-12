import 'dart:convert';
import 'dart:html' as html;
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
    _isLoading = true; _error = null; notifyListeners();
    try {
      final url = '${AppConfig.backendUrl}/api/finance/wallet/$_currentUserId';
      final response = await html.HttpRequest.request(url, method: 'GET', requestHeaders: {'Content-Type': 'application/json'});
      final data = json.decode(response.responseText!);
      _balance = (data['wallet']['balance'] ?? 0).toDouble();
    } catch (e) { _error = 'Wallet konnte nicht geladen werden: $e'; }
    finally { _isLoading = false; _hasLoaded = true; notifyListeners(); }
  }
}
