import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:heimat_app/core/auth/auth_gate.dart';
import 'package:heimat_app/features/auth/presentation/auth_provider.dart';
import 'package:heimat_app/features/auth/presentation/login_screen.dart';
import 'package:heimat_app/features/auth/presentation/register_screen.dart';

/// Stub-AuthProvider: überschreibt isAuthenticated + init/login/register/logout
/// damit der Test ohne HTTP-Backend arbeiten kann. Persistiert in
/// SharedPreferences sodass loadFromStorage nach Reload konsistent ist.
///
/// Pattern-Mirror zu _StubFinance/_StubMobility in app_smoke_test.dart.
class _FakeAuthProvider extends AuthProvider {
  bool _isAuth = false;

  @override
  bool get isAuthenticated => _isAuth;

  @override
  String? get userId => _isAuth ? 'fake-user-001' : null;

  @override
  String? get email => _isAuth ? 'fake@heimat.de' : null;

  @override
  String? get displayName => _isAuth ? 'Fake User' : null;

  @override
  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _isAuth = prefs.getString('auth_token') != null;
    notifyListeners();
  }

  @override
  Future<bool> login(String email, String password) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('auth_token', 'fake-token-${DateTime.now().microsecondsSinceEpoch}');
    await prefs.setString('user_id', 'fake-user-001');
    await prefs.setString('user_email', email);
    await prefs.setString('user_display_name', 'Fake User');
    _isAuth = true;
    notifyListeners();
    return true;
  }

  @override
  Future<bool> register(
    String email,
    String password,
    String displayName,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('auth_token', 'fake-token');
    await prefs.setString('user_id', 'fake-user-001');
    await prefs.setString('user_email', email);
    await prefs.setString('user_display_name', displayName);
    _isAuth = true;
    notifyListeners();
    return true;
  }

  @override
  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    _isAuth = false;
    notifyListeners();
  }
}

/// MockMainScreen mit Popup-Logout-Button — spiegelt realen MainScreen.
/// Wir testen AuthGate-Verhalten nicht MainScreen-UX.
class _MockMainWithLogout extends StatelessWidget {
  const _MockMainWithLogout();

  Future<void> _logout(BuildContext context) async {
    await context.read<AuthProvider>().logout();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('MOCK_MAIN_LOGOUT'),
        actions: [
          PopupMenuButton<String>(
            key: const Key('mock-logout-menu'),
            icon: const Icon(Icons.more_vert),
            onSelected: (value) async {
              if (value == 'logout') {
                await _logout(context);
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem<String>(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout, size: 20),
                    SizedBox(width: 12),
                    Text('Abmelden'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: const Center(child: Text('mock-main-content')),
    );
  }
}

Widget _buildApp(AuthProvider auth) {
  return ChangeNotifierProvider<AuthProvider>.value(
    value: auth,
    child: MaterialApp(
      home: AuthGate(authenticated: const _MockMainWithLogout()),
    ),
  );
}

void main() {
  group('Auth Integration Flow (FakeAuthProvider)', () {
    late _FakeAuthProvider auth;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      auth = _FakeAuthProvider();
      await auth.init();
    });

    testWidgets('1. Cold-Start unauth ⇒ LoginScreen sichtbar',
        (tester) async {
      await tester.pumpWidget(_buildApp(auth));
      await tester.pump(const Duration(milliseconds: 100));

      expect(auth.isAuthenticated, false);
      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.byType(_MockMainWithLogout), findsNothing);
    });

    testWidgets('2. Login() triggert MainScreen-Transition', (tester) async {
      await tester.pumpWidget(_buildApp(auth));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byType(LoginScreen), findsOneWidget);

      await auth.login('demo@heimat.de', 'password123');
      await tester.pump(const Duration(milliseconds: 100));

      expect(auth.isAuthenticated, true);
      expect(find.byType(_MockMainWithLogout), findsOneWidget);
      expect(find.byType(LoginScreen), findsNothing);
    });

    testWidgets('3. Logout via PopupMenuButton ⇒ zurück zu LoginScreen',
        (tester) async {
      // First get authenticated
      await auth.login('demo@heimat.de', 'password123');
      await tester.pumpWidget(_buildApp(auth));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byType(_MockMainWithLogout), findsOneWidget);

      // Open popup menu
      await tester.tap(find.byKey(const Key('mock-logout-menu')));
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));

      // Tap "Abmelden" item
      await tester.tap(find.text('Abmelden'));
      await tester.pump(const Duration(milliseconds: 200));

      expect(auth.isAuthenticated, false);
      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.byType(_MockMainWithLogout), findsNothing);
    });

    testWidgets('4. Login → Logout → Login cycle (state consistency)',
        (tester) async {
      await tester.pumpWidget(_buildApp(auth));

      // Round 1: Login
      await auth.login('user1@heimat.de', 'pw');
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byType(_MockMainWithLogout), findsOneWidget);

      // Round 1: Logout
      await auth.logout();
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byType(LoginScreen), findsOneWidget);

      // Round 2: Register
      await auth.register('user2@heimat.de', 'pw2', 'User Two');
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byType(_MockMainWithLogout), findsOneWidget);

      // Round 2: Logout (cleanup)
      await auth.logout();
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byType(LoginScreen), findsOneWidget);
    });

    testWidgets(
        '5. AUTH-LOCK-Injection: AuthGate muss Transition nachziehen wenn State wechselt',
        (tester) async {
      await auth.login('inline@heimat.de', 'pw');
      await tester.pumpWidget(_buildApp(auth));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byType(_MockMainWithLogout), findsOneWidget);

      // Force-flip auth state ohne User-Interaktion
      auth._isAuth = false;
      auth.notifyListeners();

      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.byType(_MockMainWithLogout), findsNothing);
    });

    testWidgets('6. RegisterScreen ist von AuthGate nicht blockiert',
        (tester) async {
      // Test dass /register-Pfad als Top-Level-Route funktioniert
      // (LoginScreen → register_link funktioniert nur wenn beide als Top-Level existieren)
      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: auth,
          child: const MaterialApp(home: RegisterScreen()),
        ),
      );
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(RegisterScreen), findsOneWidget);
      expect(find.text('Konto erstellen'), findsOneWidget);
      expect(find.byType(TextField), findsNWidgets(4)); // name + email + password + confirm
    });
  });
}
