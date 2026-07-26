/**
 * auth_finance_logout_test.dart — Integration-Tests für den
 * Login -> Finance -> Logout Flow.
 *
 * Testet:
 *   1. AuthGate-Routing: nicht authentifiziert -> LoginScreen,
 *      authentifiziert -> MainScreen
 *   2. Navigation-Tabs: Mobilitat, Finanzen, Gesundheit
 *   3. Logout-Button im AppBar-Menu -> zurueck zu LoginScreen
 *   4. Finanzen-Screen mit Guthaben-Anzeige (Stub-Provider)
 *   5. "Guthaben aufladen" Bottom-Sheet mit Demo-KUDOS-Button
 *
 * Diese Tests verwenden gemockte Provider (kein HTTP, kein echtes Backend).
 * Der Auth-Gate-Flow wird uber SharedPreferences-Mock + AuthProvider.init()
 * gesteuert. buildTestApp akzeptiert einen bereits vorkonfigurierten
 * AuthProvider (mit init() aufgerufen) — so ist isAuthenticated korrekt.
 */

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:heimat_app/core/config/app_config.dart';
import 'package:heimat_app/core/services/auth_service.dart';
import 'package:heimat_app/core/theme/app_theme.dart';
import 'package:heimat_app/features/auth/presentation/auth_provider.dart';
import 'package:heimat_app/features/auth/presentation/login_screen.dart';
import 'package:heimat_app/features/auth/presentation/register_screen.dart';
import 'package:heimat_app/features/finance/presentation/finance_provider.dart';
import 'package:heimat_app/features/finance/presentation/finance_screen.dart';
import 'package:heimat_app/features/mobility/presentation/mobility_provider.dart';
import 'package:heimat_app/features/health/presentation/health_provider.dart';
import 'package:heimat_app/features/mobility/presentation/mobility_screen.dart';
import 'package:heimat_app/features/health/presentation/health_screen.dart';

// ============================================================================
// Stub-Provider (kein HTTP, kein Backend)
// ============================================================================

class _StubMobility extends MobilityProvider {
  @override
  Future<void> loadNearbyStops(double lat, double lng,
      {double radius = 1000}) async {}
}

class _StubFinance extends FinanceProvider {
  _StubFinance(super.authService);

  double _stubBalance = 0.0;
  bool _stubHasLoaded = false;

  @override
  double get balance => _stubBalance;
  @override
  bool get hasLoaded => _stubHasLoaded;

  void setBalance(double b) {
    _stubBalance = b;
    _stubHasLoaded = true;
    notifyListeners();
  }

  @override
  Future<void> loadWallet() async {
    // no-op: kein HTTP, Balance wird via setBalance() gesetzt
  }

  @override
  Future<void> loadTransactions() async {}

  @override
  Future<bool> fundLocal() async {
    _stubBalance = 25.0;
    _stubHasLoaded = true;
    notifyListeners();
    return true;
  }
}

class _StubHealth extends HealthProvider {
  @override
  Future<void> searchDoctors(
      {String? specialty, double? lat, double? lng}) async {}
}

// ============================================================================
// Hilfsfunktionen
// ============================================================================

/// Setzt SharedPreferences-Mock auf authentifizierten Zustand.
/// Aufruf VOR authProvider.init() erforderlich.
Future<void> setupAuthenticatedPrefs() async {
  SharedPreferences.setMockInitialValues({
    'auth_token': 'test-token',
    'user_id': 'test-user-id',
    'user_email': 'test@heimat.de',
    'user_display_name': 'Test User',
  });
}

/// Erzeugt einen vorkonfigurierten AuthProvider (init() aufgerufen).
/// - authenticated=true: SharedPreferences werden vorher gemockt
/// - authenticated=false: SharedPreferences bleiben leer
Future<AuthProvider> createAuthProvider({required bool authenticated}) async {
  if (authenticated) {
    await setupAuthenticatedPrefs();
  }
  final auth = AuthProvider();
  await auth.init();
  return auth;
}

/// Baut den vollstandigen Provider-Baum mit AuthGate.
/// authProvider muss bereits via createAuthProvider() + init() vorkonfiguriert
/// sein — buildTestApp ruft init() NICHT selbst auf.
Widget buildTestApp({
  required AuthProvider authProvider,
  double financeBalance = 0.0,
}) {
  final financeProvider = _StubFinance(authProvider.authService);
  if (financeBalance > 0) {
    financeProvider.setBalance(financeBalance);
  }

  return MultiProvider(
    providers: [
      ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
      ChangeNotifierProvider<FinanceProvider>.value(value: financeProvider),
      ChangeNotifierProvider<MobilityProvider>(create: (_) => _StubMobility()),
      ChangeNotifierProvider<HealthProvider>(create: (_) => _StubHealth()),
    ],
    child: MaterialApp(
      title: AppConfig.appName,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      routes: {
        '/': (_) => const _AuthGateWithLogout(),
        '/login': (_) => const LoginScreen(),
        '/register': (_) => const RegisterScreen(),
      },
      initialRoute: '/',
      debugShowCheckedModeBanner: false,
    ),
  );
}

// ============================================================================
// AuthGate + MainScreen (repliziert main.dart ohne Import-Zirkel)
// ============================================================================

class _AuthGateWithLogout extends StatelessWidget {
  const _AuthGateWithLogout();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (auth.isAuthenticated) {
      return const _TestMainScreen();
    }
    return const LoginScreen();
  }
}

class _TestMainScreen extends StatefulWidget {
  const _TestMainScreen();

  @override
  State<_TestMainScreen> createState() => _TestMainScreenState();
}

class _TestMainScreenState extends State<_TestMainScreen> {
  int _currentIndex = 0;

  final List<Widget> _screens = [
    const MobilityScreen(),
    const FinanceScreen(),
    const HealthScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('HEIMAT'),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (value) async {
              if (value == 'logout') {
                await context.read<AuthProvider>().logout();
              }
            },
            itemBuilder: (context) => const [
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
      body: _screens[_currentIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() => _currentIndex = index);
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.map_outlined),
            selectedIcon: Icon(Icons.map),
            label: 'Mobilitat',
          ),
          NavigationDestination(
            icon: Icon(Icons.account_balance_wallet_outlined),
            selectedIcon: Icon(Icons.account_balance_wallet),
            label: 'Finanzen',
          ),
          NavigationDestination(
            icon: Icon(Icons.local_hospital_outlined),
            selectedIcon: Icon(Icons.local_hospital),
            label: 'Gesundheit',
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// Tests
// ============================================================================

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
  });

  // ==========================================================================
  // AuthGate-Routing
  // ==========================================================================

  group('AuthGate routing', () {
    testWidgets('zeigt LoginScreen wenn nicht authentifiziert',
        (WidgetTester tester) async {
      final auth = await createAuthProvider(authenticated: false);
      await tester.pumpWidget(buildTestApp(authProvider: auth));
      await tester.pumpAndSettle();

      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.text('Anmelden'), findsOneWidget);
    });

    testWidgets('zeigt MainScreen wenn authentifiziert',
        (WidgetTester tester) async {
      final auth = await createAuthProvider(authenticated: true);
      await tester.pumpWidget(buildTestApp(authProvider: auth));
      await tester.pumpAndSettle();

      expect(find.text('HEIMAT'), findsWidgets);
      expect(find.byType(LoginScreen), findsNothing);
    });
  });

  // ==========================================================================
  // LoginScreen -> Navigation zu RegisterScreen
  // ==========================================================================

  group('LoginScreen', () {
    testWidgets('hat Registrieren-Link', (WidgetTester tester) async {
      final auth = await createAuthProvider(authenticated: false);
      await tester.pumpWidget(buildTestApp(authProvider: auth));
      await tester.pumpAndSettle();

      expect(find.text('Noch kein Konto? Registrieren'), findsOneWidget);
    });

    testWidgets('klicken auf Registrieren navigiert zu RegisterScreen',
        (WidgetTester tester) async {
      final auth = await createAuthProvider(authenticated: false);
      await tester.pumpWidget(buildTestApp(authProvider: auth));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Noch kein Konto? Registrieren'));
      await tester.pumpAndSettle();

      expect(find.byType(RegisterScreen), findsOneWidget);
    });
  });

  // ==========================================================================
  // MainScreen: Navigation-Tabs
  // ==========================================================================

  group('MainScreen Navigation', () {
    testWidgets('zeigt Mobilitaets-Tab standardmaessig',
        (WidgetTester tester) async {
      final auth = await createAuthProvider(authenticated: true);
      await tester.pumpWidget(buildTestApp(authProvider: auth));
      await tester.pumpAndSettle();

      expect(find.byType(MobilityScreen), findsOneWidget);
    });

    testWidgets('wechselt zu Finanzen-Tab bei Klick',
        (WidgetTester tester) async {
      final auth = await createAuthProvider(authenticated: true);
      await tester.pumpWidget(buildTestApp(authProvider: auth));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Finanzen'));
      await tester.pumpAndSettle();

      expect(find.byType(FinanceScreen), findsOneWidget);
    });

    testWidgets('wechselt zu Gesundheit-Tab bei Klick',
        (WidgetTester tester) async {
      final auth = await createAuthProvider(authenticated: true);
      await tester.pumpWidget(buildTestApp(authProvider: auth));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Gesundheit'));
      await tester.pumpAndSettle();

      expect(find.byType(HealthScreen), findsOneWidget);
    });
  });

  // ==========================================================================
  // Finanzen-Screen anzeigen
  // ==========================================================================

  group('FinanceScreen', () {
    testWidgets('zeigt Guthaben wenn geladen', (WidgetTester tester) async {
      final auth = await createAuthProvider(authenticated: true);
      await tester.pumpWidget(buildTestApp(
        authProvider: auth,
        financeBalance: 25.0,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Finanzen'));
      await tester.pumpAndSettle();

      expect(find.textContaining('KUDOS'), findsWidgets);
    });

    testWidgets('zeigt Guthaben aufladen Button', (WidgetTester tester) async {
      final auth = await createAuthProvider(authenticated: true);
      await tester.pumpWidget(buildTestApp(
        authProvider: auth,
        financeBalance: 25.0,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Finanzen'));
      await tester.pumpAndSettle();

      expect(find.text('Guthaben aufladen'), findsOneWidget);
    });

    testWidgets('Guthaben aufladen oeffnet Bottom-Sheet mit Demo-KUDOS',
        (WidgetTester tester) async {
      final auth = await createAuthProvider(authenticated: true);
      await tester.pumpWidget(buildTestApp(
        authProvider: auth,
        financeBalance: 25.0,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Finanzen'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Guthaben aufladen'));
      await tester.pumpAndSettle();

      expect(find.text('25 Demo-KUDOS erhalten'), findsOneWidget);
    });
  });

  // ==========================================================================
  // Logout-Flow
  // ==========================================================================

  group('Logout', () {
    testWidgets('AppBar zeigt Menue-Button', (WidgetTester tester) async {
      final auth = await createAuthProvider(authenticated: true);
      await tester.pumpWidget(buildTestApp(authProvider: auth));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.more_vert), findsOneWidget);
    });

    testWidgets('Menue enthaelt Abmelden-Eintrag',
        (WidgetTester tester) async {
      final auth = await createAuthProvider(authenticated: true);
      await tester.pumpWidget(buildTestApp(authProvider: auth));
      await tester.pumpAndSettle();

      await tester.tap(find.byIcon(Icons.more_vert));
      await tester.pumpAndSettle();

      expect(find.text('Abmelden'), findsOneWidget);
    });

    testWidgets('Abmelden navigiert zurueck zu LoginScreen (AuthGate)',
        (WidgetTester tester) async {
      final auth = await createAuthProvider(authenticated: true);
      await tester.pumpWidget(buildTestApp(authProvider: auth));
      await tester.pumpAndSettle();

      expect(find.text('HEIMAT'), findsWidgets);

      await tester.tap(find.byIcon(Icons.more_vert));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Abmelden'));
      await tester.pumpAndSettle();

      expect(find.byType(LoginScreen), findsOneWidget);
    });
  });
}
