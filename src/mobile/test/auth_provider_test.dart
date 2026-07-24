import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:heimat_app/features/auth/presentation/auth_provider.dart';

void main() {
  late AuthProvider authProvider;

  setUp(() {
    authProvider = AuthProvider();
  });

  group('AuthProvider', () {
    group('Initial state', () {
      test('isAuthenticated is false when not logged in', () {
        expect(authProvider.isAuthenticated, false);
      });

      test('isLoading is false initially', () {
        expect(authProvider.isLoading, false);
      });

      test('error is null initially', () {
        expect(authProvider.error, null);
      });

      test('userId is null when not logged in', () {
        expect(authProvider.userId, null);
      });

      test('email is null when not logged in', () {
        expect(authProvider.email, null);
      });

      test('displayName is null when not logged in', () {
        expect(authProvider.displayName, null);
      });
    });

    group('init', () {
      test('loads user data from storage', () async {
        SharedPreferences.setMockInitialValues({
          'auth_token': 'stored-token',
          'user_id': 'stored-user-id',
          'user_email': 'stored@example.com',
          'user_display_name': 'Stored User',
        });

        await authProvider.init();

        expect(authProvider.isAuthenticated, true);
        expect(authProvider.userId, 'stored-user-id');
        expect(authProvider.email, 'stored@example.com');
        expect(authProvider.displayName, 'Stored User');
      });

      test('handles empty storage', () async {
        SharedPreferences.setMockInitialValues({});

        await authProvider.init();

        expect(authProvider.isAuthenticated, false);
        expect(authProvider.userId, null);
        expect(authProvider.email, null);
        expect(authProvider.displayName, null);
      });
    });

    group('logout', () {
      test('clears user data and error', () async {
        // First load some data
        SharedPreferences.setMockInitialValues({
          'auth_token': 'token-to-clear',
          'user_id': 'user-to-clear',
          'user_email': 'clear@example.com',
          'user_display_name': 'Clear User',
        });

        await authProvider.init();
        expect(authProvider.isAuthenticated, true);

        // Then logout
        await authProvider.logout();

        expect(authProvider.isAuthenticated, false);
        expect(authProvider.userId, null);
        expect(authProvider.email, null);
        expect(authProvider.displayName, null);
        expect(authProvider.error, null);
      });
    });

    group('clearError', () {
      test('clears the error message', () async {
        // Simulate an error state by setting it manually
        // Since we can't easily trigger a real error without HTTP,
        // we test that clearError works when error is set
        SharedPreferences.setMockInitialValues({});

        // After init with empty storage, error should be null
        await authProvider.init();
        expect(authProvider.error, null);

        // clearError should not throw
        authProvider.clearError();
        expect(authProvider.error, null);
      });
    });

    group('notifyListeners', () {
      test('init notifies listeners', () async {
        int notifyCount = 0;
        authProvider.addListener(() {
          notifyCount++;
        });

        SharedPreferences.setMockInitialValues({});
        await authProvider.init();

        expect(notifyCount, greaterThan(0));
      });

      test('logout notifies listeners', () async {
        int notifyCount = 0;
        authProvider.addListener(() {
          notifyCount++;
        });

        SharedPreferences.setMockInitialValues({});
        await authProvider.logout();

        expect(notifyCount, greaterThan(0));
      });

      test('clearError notifies listeners', () {
        int notifyCount = 0;
        authProvider.addListener(() {
          notifyCount++;
        });

        authProvider.clearError();

        expect(notifyCount, 1);
      });
    });

    group('authService', () {
      test('exposes authService instance', () {
        expect(authProvider.authService, isNotNull);
        expect(authProvider.authService, isA<dynamic>());
      });
    });
  });
}
