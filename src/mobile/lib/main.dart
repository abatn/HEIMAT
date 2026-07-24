import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/config/app_config.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/app_colors.dart';
import 'features/auth/presentation/auth_provider.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/auth/presentation/register_screen.dart';
import 'features/mobility/presentation/mobility_provider.dart';
import 'features/finance/presentation/finance_provider.dart';
import 'features/health/presentation/health_provider.dart';
import 'features/mobility/presentation/mobility_screen.dart';
import 'features/finance/presentation/finance_screen.dart';
import 'features/health/presentation/health_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
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
            ],
            child: MaterialApp(
              title: AppConfig.appName,
              theme: AppTheme.lightTheme,
              darkTheme: AppTheme.darkTheme,
              themeMode: ThemeMode.system,
              routes: {
                '/': (_) => const AuthGate(),
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

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (auth.isAuthenticated) {
      return const MainScreen();
    }
    return const LoginScreen();
  }
}

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _currentIndex = 0;

  final List<Widget> _screens = [
    const MobilityScreen(),
    const FinanceScreen(),
    const HealthScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_currentIndex],
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(
            top: BorderSide(color: AppColors.border, width: 0.5),
          ),
        ),
        child: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: (index) {
            setState(() => _currentIndex = index);
          },
          backgroundColor: AppColors.card,
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.map_outlined),
              selectedIcon: Icon(Icons.map),
              label: 'Mobilit\u00e4t',
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
      ),
    );
  }
}
