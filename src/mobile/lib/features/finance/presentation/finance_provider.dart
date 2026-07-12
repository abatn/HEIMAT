import 'package:flutter/material.dart';
import '../../../core/api/api_client.dart';

class FinanceProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();
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
      final response = await _api.get('/api/finance/wallet/$_currentUserId');
      _balance = (response['wallet']['balance'] ?? 0).toDouble();
    } catch (e) { _error = 'Wallet konnte nicht geladen werden: $e'; }
    finally { _isLoading = false; _hasLoaded = true; notifyListeners(); }
  }
}
