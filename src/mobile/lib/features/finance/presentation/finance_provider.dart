import 'package:flutter/material.dart';
import '../../../core/api/api_client.dart';

class Wallet {
  final String id;
  final String userId;
  final double balance;
  final String currency;

  Wallet({
    required this.id,
    required this.userId,
    required this.balance,
    required this.currency,
  });

  factory Wallet.fromJson(Map<String, dynamic> json) {
    return Wallet(
      id: json['id'] ?? '',
      userId: json['user_id'] ?? '',
      balance: (json['balance'] ?? 0).toDouble(),
      currency: json['currency'] ?? 'EUR',
    );
  }
}

class Transaction {
  final String id;
  final String fromWalletId;
  final String toWalletId;
  final double amount;
  final String currency;
  final String status;
  final String createdAt;

  Transaction({
    required this.id,
    required this.fromWalletId,
    required this.toWalletId,
    required this.amount,
    required this.currency,
    required this.status,
    required this.createdAt,
  });

  factory Transaction.fromJson(Map<String, dynamic> json) {
    return Transaction(
      id: json['id'] ?? '',
      fromWalletId: json['from_wallet_id'] ?? '',
      toWalletId: json['to_wallet_id'] ?? '',
      amount: (json['amount'] ?? 0).toDouble(),
      currency: json['currency'] ?? 'EUR',
      status: json['status'] ?? '',
      createdAt: json['created_at'] ?? '',
    );
  }
}

class FinanceProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  // Demo-User-ID (wird später durch echte Auth ersetzt)
  static const String _currentUserId = 'user-demo-001';

  Wallet? _wallet;
  List<Transaction> _transactions = [];
  double _balance = 0.0;

  bool _isLoading = false;
  String? _error;
  bool _hasLoaded = false;

  Wallet? get wallet => _wallet;
  List<Transaction> get transactions => _transactions;
  double get balance => _balance;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasLoaded => _hasLoaded;

  String get currentUserId => _currentUserId;

  Future<void> loadWallet() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.get('/api/finance/wallet/$_currentUserId');
      _wallet = Wallet.fromJson(response['wallet']);
      _balance = _wallet!.balance;
    } catch (e) {
      _error = 'Wallet konnte nicht geladen werden: $e';
    } finally {
      _isLoading = false;
      _hasLoaded = true;
      notifyListeners();
    }
  }

  Future<void> loadTransactions() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response =
          await _api.get('/api/finance/transactions/$_currentUserId');
      _transactions = (response['transactions'] as List)
          .map((t) => Transaction.fromJson(t))
          .toList();
    } catch (e) {
      _error = 'Transaktionen konnten nicht geladen werden: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> sendPayment(String toUserId, double amount,
      {String currency = 'EUR'}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _api.post('/api/finance/pay', {
        'from': _currentUserId,
        'to': toUserId,
        'amount': amount,
        'currency': currency,
      });
      // Nach Zahlung: Wallet neu laden
      await loadWallet();
      await loadTransactions();
      return true;
    } catch (e) {
      _error = 'Zahlung fehlgeschlagen: $e';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  @override
  void dispose() {
    _api.dispose();
    super.dispose();
  }
}
