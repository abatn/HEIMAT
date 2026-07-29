import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/config/app_config.dart';
import 'core/navigator/app_navigator.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/app_colors.dart';
import 'features/auth/presentation/auth_provider.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/auth/presentation/register_screen.dart';
import 'core/auth/auth_gate.dart';
import 'features/mobility/presentation/mobility_provider.dart';
import 'features/finance/presentation/finance_provider.dart';
import 'features/health/presentation/health_provider.dart';
import 'features/mobility/presentation/mobility_screen.dart';
import 'features/finance/presentation/finance_screen.dart';
import 'features/health/presentation/health_screen.dart';
import 'features/home/presentation/home_screen.dart';
import 'features/home/presentation/home_provider.dart';
import 'features/miniprogram/presentation/miniprogram_provider.dart';
import 'features/miniprogram/presentation/launchpad_screen.dart';
import 'features/miniprogram/domain/service_registry.dart';
import 'features/weather/weather_provider.dart';
import 'features/air_quality/air_quality_provider.dart';
import 'features/waste/presentation/waste_provider.dart';
import 'features/ev_charging/presentation/ev_charging_provider.dart';
import 'features/ai_chat/presentation/ai_chat_provider.dart';
import 'features/checkin/presentation/checkin_provider.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Phase E: ServiceRegistry wird beim App-Start initialisiert, damit der
  // erste Tap auf das Wetter-Mini-Program sofort das native Widget zeigt.
  ServiceRegistry.instance.initialize();
  runApp(const HeimatApp());
}

class HeimatApp extends StatelessWidget {
  const HeimatApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthProvider()..init(),
      child: Consumer<AuthProvider>(
        builder: (context, auth, _) {
          return MultiProvider(
            providers: [
              ChangeNotifierProvider.value(value: auth),
              ChangeNotifierProvider(
                create: (_) => FinanceProvider(auth.authService),
              ),
              ChangeNotifierProvider(create: (_) => MobilityProvider()),
              ChangeNotifierProvider(create: (_) => HealthProvider()),
              ChangeNotifierProvider(create: (_) => MiniProgramProvider()),
              ChangeNotifierProvider(
                create: (_) {
                  final hp = HomeProvider(auth.authService);
                  HomeProvider.onUserAction = hp.recordAction;
                  return hp;
                },
              ),
              ChangeNotifierProvider(create: (_) => WeatherProvider()..init()),
              ChangeNotifierProvider(
                create: (_) => AirQualityProvider()..init(),
              ),
              // Phase B-3: Abfallkalender als 3. nativer Flutter-Service (nach weather + air).
              ChangeNotifierProvider(create: (_) => WasteProvider()..init()),
              // Phase B-4: E-Ladestationen als 4. nativer Flutter-Service.
              ChangeNotifierProvider(
                create: (_) => EvChargingProvider()..init(),
              ),
              // Phase AI-2: AI Chat als 5. nativer Flutter-Service.
              ChangeNotifierProvider(create: (_) => AiChatProvider()),
              // Phase AI-Health-3: Lebenszeichen Check-in (2026-07-29).
              ChangeNotifierProvider(
                create: (_) =>
                    CheckinProvider(auth.authService)..refreshStatus(),
              ),
            ],
            child: MaterialApp(
              title: AppConfig.appName,
              theme: AppTheme.lightTheme,
              darkTheme: AppTheme.darkTheme,
              themeMode: ThemeMode.system,
              routes: {
                '/': (_) => AuthGate(authenticated: const MainScreen()),
                '/login': (_) => const LoginScreen(),
                '/register': (_) => const RegisterScreen(),
              },
              initialRoute: '/',
              debugShowCheckedModeBanner: false,
            ),
          );
        },
      ),
    );
  }
}

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _currentIndex = 0;

  /// Registers in den globalen AppNavigator-switchMainTab static-mirror
  /// (Pattern-Mirror zu HomeProvider.onUserAction). Damit koennen
  /// Sub-Baeume (Cross-Service-Insight in Wetter, Mini-Program-Container)
  /// ohne Navigation-Callback durch-Threading zum Mobility-Tab springen.
  @override
  void initState() {
    super.initState();
    AppNavigator.switchMainTab = _onSwitchTab;
  }

  @override
  void dispose() {
    // Identical-Check damit nur unser eigener Handler geraeumt wird
    // (nicht ein spaeter von aussen gesetzter).
    if (identical(AppNavigator.switchMainTab, _onSwitchTab)) {
      AppNavigator.switchMainTab = null;
    }
    super.dispose();
  }

  void _onSwitchTab(int index) {
    if (mounted) {
      setState(() => _currentIndex = index);
    }
  }

  List<Widget> get _screens => [
    HomeScreen(onNavigateTab: (index) => setState(() => _currentIndex = index)),
    const MobilityScreen(),
    const FinanceScreen(),
    const HealthScreen(),
    const LaunchpadScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('HEIMAT'),
        backgroundColor: AppColors.card,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            tooltip: 'Menü',
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
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: AppColors.border, width: 0.5)),
        ),
        child: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: (index) {
            setState(() => _currentIndex = index);
          },
          backgroundColor: AppColors.card,
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home),
              label: 'Dashboard',
            ),
            NavigationDestination(
              icon: Icon(Icons.map_outlined),
              selectedIcon: Icon(Icons.map),
              label: 'Mobilität',
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
            NavigationDestination(
              icon: Icon(Icons.apps_outlined),
              selectedIcon: Icon(Icons.apps),
              label: 'Apps',
            ),
          ],
        ),
      ),
    );
  }
}
