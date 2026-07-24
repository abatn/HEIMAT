import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mockito/annotations.dart';
import 'package:mockito/mockito.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:heimat_app/core/services/auth_service.dart';
import 'package:heimat_app/core/config/app_config.dart';

import 'auth_service_test.mocks.dart';

@GenerateMocks([http.Client])
void main() {
  late AuthService authService;

  setUp(() {
    authService = AuthService();
  });

  group('AuthService', () {
    group('Initial state', () {
      test('isAuthenticated is false when not logged in', () {
        expect(authService.isAuthenticated, false);
      });

      test('token is null when not logged in', () {
        expect(authService.token, null);
      });

      test('userId is null when not logged in', () {
        expect(authService.userId, null);
      });

      test('email is null when not logged in', () {
        expect(authService.email, null);
      });

      test('displayName is null when not logged in', () {
        expect(authService.displayName, null);
      });
    });

    group('logout', () {
      test('clears all user data', () async {
        // First set some user data
        SharedPreferences.setMockInitialValues({
          'auth_token': 'test-token-789',
          'user_id': 'user-789',
          'user_email': 'logout@example.com',
          'user_display_name': 'Logout User',
        });

        // Load from storage
        await authService.loadFromStorage();
        expect(authService.isAuthenticated, true);

        // Then logout
        await authService.logout();

        expect(authService.isAuthenticated, false);
        expect(authService.token, null);
        expect(authService.userId, null);
        expect(authService.email, null);
        expect(authService.displayName, null);
      });
    });

    group('authHeaders', () {
      test('does not include Authorization header when not authenticated', () {
        final headers = authService.authHeaders;
        expect(headers.containsKey('Authorization'), false);
        expect(headers['Content-Type'], 'application/json');
      });
    });

    group('loadFromStorage', () {
      test('loads user data from SharedPreferences', () async {
        SharedPreferences.setMockInitialValues({
          'auth_token': 'stored-token',
          'user_id': 'stored-user-id',
          'user_email': 'stored@example.com',
          'user_display_name': 'Stored User',
        });

        await authService.loadFromStorage();

        expect(authService.isAuthenticated, true);
        expect(authService.token, 'stored-token');
        expect(authService.userId, 'stored-user-id');
        expect(authService.email, 'stored@example.com');
        expect(authService.displayName, 'Stored User');
      });

      test('handles empty SharedPreferences', () async {
        SharedPreferences.setMockInitialValues({});

        await authService.loadFromStorage();

        expect(authService.isAuthenticated, false);
        expect(authService.token, null);
        expect(authService.userId, null);
        expect(authService.email, null);
        expect(authService.displayName, null);
      });

      test('clears storage on logout', () async {
        SharedPreferences.setMockInitialValues({
          'auth_token': 'token-to-clear',
          'user_id': 'user-to-clear',
          'user_email': 'clear@example.com',
          'user_display_name': 'Clear User',
        });

        await authService.loadFromStorage();
        expect(authService.isAuthenticated, true);

        await authService.logout();

        final prefs = await SharedPreferences.getInstance();
        expect(prefs.getString('auth_token'), null);
        expect(prefs.getString('user_id'), null);
        expect(prefs.getString('user_email'), null);
        expect(prefs.getString('user_display_name'), null);
      });
    });

    group('AuthResult', () {
      test('success creates result with success=true', () {
        final result = AuthResult.success();
        expect(result.success, true);
        expect(result.error, null);
      });

      test('error creates result with success=false and error message', () {
        final result = AuthResult.error('Test error');
        expect(result.success, false);
        expect(result.error, 'Test error');
      });
    });
  });
}
