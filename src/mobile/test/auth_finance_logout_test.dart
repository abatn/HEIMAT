import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:heimat_app/core/config/app_config.dart';
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

class _StubMobility extends MobilityProvider {
  @override
  Future<void> loadNearbyStops(double lat, double lng,
      {double radius = 1000}) async {}
}

class _StubFinance extends FinanceProvider {
  _StubFinance(super.authService);

  @override
  Future<void> loadWallet() async {}

  @override
  Future<void> loadTransactions() async {}
}

class _StubHealth extends HealthProvider {
  @override
  Future<void> searchDoctors(
      {String? specialty, double? lat, double? lng}) async {}
}

Future<void> setupAuthenticatedPrefs() async {
  SharedPreferences.setMockInitialValues({
    'auth_token': 'test-token',
    'user_id': 'test-user-id',
    'user_email': 'test@heimat.de',
    'user_display_name': 'Test User',
  });
}

Future<AuthProvider> createAuthProvider({required bool authenticated}) async {
  if (authenticated) {
    await setupAuthenticatedPrefs();
  }
  final auth = AuthProvider();
  await auth.init();
  return auth;
}

Widget buildTestApp({required AuthProvider authProvider}) {
  final financeProvider = _StubFinance(authProvider.authService);

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

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
  });

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

  group('MainScreen', () {
    testWidgets('standardmaessig auf Mobilitaets-Tab',
        (WidgetTester tester) async {
      final auth = await createAuthProvider(authenticated: true);
      await tester.pumpWidget(buildTestApp(authProvider: auth));
      await tester.pumpAndSettle();

      expect(find.byType(MobilityScreen), findsOneWidget);
    });
  });

  group('Logout', () {
    testWidgets('AppBar zeigt Menue-Button', (WidgetTester tester) async {
      final auth = await createAuthProvider(authenticated: true);
      await tester.pumpWidget(buildTestApp(authProvider: auth));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.more_vert), findsOneWidget);
    });

    testWidgets('Menue enthaelt Abmelden-Eintrag', (WidgetTester tester) async {
      final auth = await createAuthProvider(authenticated: true);
      await tester.pumpWidget(buildTestApp(authProvider: auth));
      await tester.pumpAndSettle();

      await tester.tap(find.byIcon(Icons.more_vert));
      await tester.pumpAndSettle();

      expect(find.text('Abmelden'), findsOneWidget);
    });

    testWidgets('Abmelden navigiert zurueck zu LoginScreen',
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
