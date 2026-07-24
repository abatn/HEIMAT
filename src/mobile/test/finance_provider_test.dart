import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:heimat_app/core/services/auth_service.dart';
import 'package:heimat_app/features/finance/presentation/finance_provider.dart';

void main() {
  late FinanceProvider financeProvider;
  late AuthService authService;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    authService = AuthService();
    await authService.loadFromStorage();
    financeProvider = FinanceProvider(authService);
  });

  group('FinanceProvider', () {
    group('Initial state', () {
      test('balance is 0.0 initially', () {
        expect(financeProvider.balance, 0.0);
      });

      test('isLoading is false initially', () {
        expect(financeProvider.isLoading, false);
      });

      test('error is null initially', () {
        expect(financeProvider.error, null);
      });

      test('hasLoaded is false initially', () {
        expect(financeProvider.hasLoaded, false);
      });

      test('transactions is empty list initially', () {
        expect(financeProvider.transactions, isEmpty);
      });

      test('currentUserId is null when not authenticated', () {
        expect(financeProvider.currentUserId, null);
      });

      test('currency is KUDOS', () {
        expect(financeProvider.currency, 'KUDOS');
      });

      test('walletInitialized is false initially', () {
        expect(financeProvider.walletInitialized, false);
      });

      test('walletId is empty string initially', () {
        expect(financeProvider.walletId, '');
      });
    });

    group('currentUserId', () {
      test('returns null when not authenticated', () {
        expect(financeProvider.currentUserId, null);
      });

      test('returns userId when authenticated', () async {
        // Simulate authentication by setting up SharedPreferences with auth data
        SharedPreferences.setMockInitialValues({
          'auth_token': 'test-token',
          'user_id': 'test-user-id',
          'user_email': 'test@example.com',
          'user_display_name': 'Test User',
        });

        final authenticatedAuthService = AuthService();
        await authenticatedAuthService.loadFromStorage();

        final authenticatedFinanceProvider =
            FinanceProvider(authenticatedAuthService);

        expect(authenticatedFinanceProvider.currentUserId, 'test-user-id');
      });
    });

    group('loadWallet', () {
      test('sets error when not authenticated', () async {
        await financeProvider.loadWallet();

        expect(financeProvider.error, 'Nicht angemeldet');
        // hasLoaded is not set when returning early due to null userId
        expect(financeProvider.hasLoaded, false);
      });
    });

    group('loadTransactions', () {
      test('returns empty list when not authenticated', () async {
        await financeProvider.loadTransactions();

        expect(financeProvider.transactions, isEmpty);
      });
    });

    group('sendMoney', () {
      test('returns false when not authenticated', () async {
        final result = await financeProvider.sendMoney('receiver-id', 10.0);

        expect(result, false);
        expect(financeProvider.error, 'Nicht angemeldet');
      });
    });

    group('Transaction', () {
      test('fromJson creates transaction correctly', () {
        final json = {
          'id': 'tx-123',
          'amount': 25.5,
          'currency': 'KUDOS',
          'status': 'completed',
          'description': 'Test payment',
          'created_at': '2024-01-01T00:00:00Z',
          'from_wallet_id': 'wallet-1',
          'to_wallet_id': 'wallet-2',
        };

        final transaction = Transaction.fromJson(json);

        expect(transaction.id, 'tx-123');
        expect(transaction.amount, 25.5);
        expect(transaction.currency, 'KUDOS');
        expect(transaction.status, 'completed');
        expect(transaction.description, 'Test payment');
        expect(transaction.createdAt, '2024-01-01T00:00:00Z');
        expect(transaction.fromWalletId, 'wallet-1');
        expect(transaction.toWalletId, 'wallet-2');
      });

      test('fromJson handles null values with defaults', () {
        final json = <String, dynamic>{};

        final transaction = Transaction.fromJson(json);

        expect(transaction.id, '');
        expect(transaction.amount, 0.0);
        expect(transaction.currency, 'KUDOS');
        expect(transaction.status, 'pending');
        expect(transaction.description, null);
        expect(transaction.createdAt, '');
        expect(transaction.fromWalletId, '');
        expect(transaction.toWalletId, '');
      });

      test('fromJson handles string amount', () {
        final json = {
          'amount': '42.5',
        };

        final transaction = Transaction.fromJson(json);

        expect(transaction.amount, 42.5);
      });

      test('fromJson handles null amount', () {
        final json = {
          'amount': null,
        };

        final transaction = Transaction.fromJson(json);

        expect(transaction.amount, 0.0);
      });
    });

    group('notifyListeners', () {
      test('loadWallet notifies listeners', () async {
        int notifyCount = 0;
        financeProvider.addListener(() {
          notifyCount++;
        });

        await financeProvider.loadWallet();

        expect(notifyCount, greaterThan(0));
      });
    });
  });
}
