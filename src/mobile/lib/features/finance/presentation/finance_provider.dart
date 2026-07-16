import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import '../../../core/config/app_config.dart';

double _toDouble(dynamic v) =>
    v == null ? 0.0 : (v is num ? v.toDouble() : double.parse(v.toString()));

class Transaction {
  final String id;
  final double amount;
  final String currency;
  final String status;
  final String? description;
  final String createdAt;
  final String fromWalletId;
  final String toWalletId;

  Transaction({
    required this.id,
    required this.amount,
    required this.currency,
    required this.status,
    this.description,
    required this.createdAt,
    required this.fromWalletId,
    required this.toWalletId,
  });

  factory Transaction.fromJson(Map<String, dynamic> json) {
    return Transaction(
      id: json['id'] ?? '',
      amount: _toDouble(json['amount']),
      currency: json['currency'] ?? 'KUDOS',
      status: json['status'] ?? 'pending',
      description: json['description'],
      createdAt: json['created_at'] ?? '',
      fromWalletId: json['from_wallet_id'] ?? '',
      toWalletId: json['to_wallet_id'] ?? '',
    );
  }
}

class FinanceProvider extends ChangeNotifier {
  static const String _currentUserId = 'user-demo-001';
  static const String _currency = 'KUDOS';
  double _balance = 0.0;
  bool _isLoading = false;
  String? _error;
  bool _hasLoaded = false;
  List<Transaction> _transactions = [];
  bool _walletInitialized = false;
  String _walletId = '';

  double get balance => _balance;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasLoaded => _hasLoaded;
  List<Transaction> get transactions => _transactions;
  String get currentUserId => _currentUserId;
  String get currency => _currency;
  bool get walletInitialized => _walletInitialized;
  String get walletId => _walletId;

  Future<void> initWallet() async {
    if (_walletInitialized) return;
    try {
      final url = '${AppConfig.backendUrl}/api/finance/taler/wallet';
      await http
          .post(
            Uri.parse(url),
            headers: {'Content-Type': 'application/json'},
            body: json.encode({'userId': _currentUserId}),
          )
          .timeout(const Duration(seconds: 30));
      _walletInitialized = true;
    } catch (_) {}
  }

  Future<void> loadWallet() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      await initWallet();
      final walletUrl =
          '${AppConfig.backendUrl}/api/finance/wallet/$_currentUserId';
      final walletResponse = await http.get(Uri.parse(walletUrl), headers: {
        'Content-Type': 'application/json'
      }).timeout(const Duration(seconds: 30));
      if (walletResponse.statusCode == 200) {
        final walletData = json.decode(walletResponse.body);
        _walletId = walletData['wallet']['id'] ?? '';
      }
      final url = '${AppConfig.backendUrl}/api/finance/balance/$_currentUserId';
      final response = await http.get(Uri.parse(url), headers: {
        'Content-Type': 'application/json'
      }).timeout(const Duration(seconds: 30));
      if (response.statusCode != 200) {
        throw Exception('Server error: ${response.statusCode}');
      }
      final data = json.decode(response.body);
      final raw = data['balance'];
      _balance = _toDouble(raw);
    } catch (e) {
      _error = 'Wallet konnte nicht geladen werden: $e';
    } finally {
      _isLoading = false;
      _hasLoaded = true;
      notifyListeners();
    }
  }

  Future<void> loadTransactions() async {
    try {
      final url =
          '${AppConfig.backendUrl}/api/finance/transactions/$_currentUserId';
      final response = await http.get(Uri.parse(url), headers: {
        'Content-Type': 'application/json'
      }).timeout(const Duration(seconds: 30));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        _transactions = (data['transactions'] as List)
            .map((t) => Transaction.fromJson(t))
            .toList();
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<bool> sendMoney(String toUserId, double amount) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final url = '${AppConfig.backendUrl}/api/finance/pay';
      final response = await http
          .post(
            Uri.parse(url),
            headers: {'Content-Type': 'application/json'},
            body: json.encode({
              'from': _currentUserId,
              'to': toUserId,
              'amount': amount,
              'currency': _currency,
            }),
          )
          .timeout(const Duration(seconds: 30));
      if (response.statusCode == 200) {
        await loadWallet();
        await loadTransactions();
        return true;
      } else {
        _error = 'Zahlung fehlgeschlagen: ${response.statusCode}';
        return false;
      }
    } catch (e) {
      _error = 'Zahlung fehlgeschlagen: $e';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
