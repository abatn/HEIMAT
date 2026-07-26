import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:heimat_app/features/auth/presentation/auth_provider.dart';
import 'package:heimat_app/features/auth/presentation/login_screen.dart';

void main() {
  group('AuthGate (unauth)', () {
    testWidgets('shows LoginScreen when not authenticated',
        (WidgetTester tester) async {
      // AuthProvider without init() → isAuthenticated = false
      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => AuthProvider(),
          child: const MaterialApp(
            home: AuthGate(),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.text('Anmelden'), findsWidgets);
    });
  });
}

// Copy of AuthGate from main.dart (needed here since it's private in main.dart)
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

class MainScreen extends StatelessWidget {
  const MainScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: Text('HEIMAT Main Screen')),
    );
  }
}
