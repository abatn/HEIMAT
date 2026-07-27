import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:heimat_app/features/auth/presentation/auth_provider.dart';
import 'package:heimat_app/features/auth/presentation/login_screen.dart';
import 'package:heimat_app/core/auth/auth_gate.dart';

/// Mock-Widget das im Test an AuthGate(authenticated:) injiziert wird.
/// Wir testen AuthGate-Routing, NICHT das echte MainScreen.
class _MockMain extends StatelessWidget {
  const _MockMain();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: Text('MOCK_MAIN_MARKER')),
    );
  }
}

Widget _buildGate(AuthProvider auth, {Widget? mockMain}) {
  return ChangeNotifierProvider<AuthProvider>.value(
    value: auth,
    child: MaterialApp(
      home: AuthGate(authenticated: mockMain ?? const _MockMain()),
    ),
  );
}

void main() {
  group('AuthGate Routing (real imported widget)', () {
    testWidgets('1. unauth ⇒ LoginScreen (kein Mock-Main sichtbar)',
        (tester) async {
      SharedPreferences.setMockInitialValues({});
      final auth = AuthProvider();

      await tester.pumpWidget(_buildGate(auth));
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.text('MOCK_MAIN_MARKER'), findsNothing);
    });

    testWidgets('2. auth via init() ⇒ Mock-Main (LoginScreen weg)',
        (tester) async {
      SharedPreferences.setMockInitialValues({
        'auth_token': 'test-token-123',
        'user_id': 'test-user-123',
        'user_email': 'test@heimat.de',
        'user_display_name': 'Test User',
      });
      final auth = AuthProvider();
      await auth.init();

      await tester.pumpWidget(_buildGate(auth));
      await tester.pump(const Duration(milliseconds: 100));

      expect(auth.isAuthenticated, true);
      expect(find.byType(LoginScreen), findsNothing);
      expect(find.text('MOCK_MAIN_MARKER'), findsOneWidget);
    });

    testWidgets('3. AUTH-LOCK: transition auth → logout ⇒ LoginScreen zurück',
        (tester) async {
      SharedPreferences.setMockInitialValues({
        'auth_token': 'will-be-cleared',
        'user_id': 'will-be-cleared',
        'user_email': 'x@x.de',
        'user_display_name': 'X',
      });
      final auth = AuthProvider();
      await auth.init();
      await tester.pumpWidget(_buildGate(auth));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('MOCK_MAIN_MARKER'), findsOneWidget);

      // Logout simuliert — AuthGate muss sofort routen
      await auth.logout();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.text('MOCK_MAIN_MARKER'), findsNothing);
    });

    testWidgets(
        '4. AUTH-LOCK: Loading-State (vor init) ⇒ LoginScreen, NIE Mock-Main',
        (tester) async {
      SharedPreferences.setMockInitialValues({});
      final auth = AuthProvider();
      // ACHTUNG: kein auth.init() — simuliert Cold-Start vor Load From Storage

      await tester.pumpWidget(_buildGate(auth));
      await tester.pump(const Duration(milliseconds: 50));

      expect(auth.isAuthenticated, false);
      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.text('MOCK_MAIN_MARKER'), findsNothing);
    });

    testWidgets('5. AUTH-LOCK: Partial-Auth (Token ohne user_id) ⇒ LoginScreen',
        (tester) async {
      // AuthService.isAuthenticated requires BOTH token AND userId.
      // Wenn eins fehlt, ist der User ungültig angemeldet.
      SharedPreferences.setMockInitialValues({
        'auth_token': 'orphan-token',
        // user_id bewusst weggelassen
      });
      final auth = AuthProvider();
      await auth.init();

      await tester.pumpWidget(_buildGate(auth));
      await tester.pump(const Duration(milliseconds: 100));

      expect(auth.isAuthenticated, false);
      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.text('MOCK_MAIN_MARKER'), findsNothing);
    });
  });
}
