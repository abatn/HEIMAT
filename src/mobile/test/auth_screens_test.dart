import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:heimat_app/features/auth/presentation/auth_provider.dart';
import 'package:heimat_app/features/auth/presentation/login_screen.dart';
import 'package:heimat_app/features/auth/presentation/register_screen.dart';

void main() {
  group('LoginScreen', () {
    testWidgets('renders correctly', (WidgetTester tester) async {
      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => AuthProvider(),
          child: const MaterialApp(
            home: LoginScreen(),
          ),
        ),
      );

      // Verify the screen renders
      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.byType(TextField), findsNWidgets(2)); // Email and password
      expect(find.byType(ElevatedButton), findsOneWidget); // Login button
    });

    testWidgets('displays HEIMAT title', (WidgetTester tester) async {
      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => AuthProvider(),
          child: const MaterialApp(
            home: LoginScreen(),
          ),
        ),
      );

      expect(find.text('HEIMAT'), findsOneWidget);
      expect(find.text('Anmelden'), findsWidgets);
    });

    testWidgets('has email and password fields', (WidgetTester tester) async {
      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => AuthProvider(),
          child: const MaterialApp(
            home: LoginScreen(),
          ),
        ),
      );

      expect(find.byType(TextField), findsNWidgets(2));
      expect(find.text('E-Mail'), findsOneWidget);
      expect(find.text('Passwort'), findsOneWidget);
    });

    testWidgets('has register link', (WidgetTester tester) async {
      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => AuthProvider(),
          child: const MaterialApp(
            home: LoginScreen(),
          ),
        ),
      );

      expect(find.text('Noch kein Konto? Registrieren'), findsOneWidget);
    });
  });

  group('RegisterScreen', () {
    testWidgets('renders correctly', (WidgetTester tester) async {
      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => AuthProvider(),
          child: const MaterialApp(
            home: RegisterScreen(),
          ),
        ),
      );

      // Verify the screen renders
      expect(find.byType(RegisterScreen), findsOneWidget);
      expect(find.byType(TextField),
          findsNWidgets(4)); // Name, email, password, confirm password
      expect(find.byType(ElevatedButton), findsOneWidget); // Register button
    });

    testWidgets('displays HEIMAT title', (WidgetTester tester) async {
      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => AuthProvider(),
          child: const MaterialApp(
            home: RegisterScreen(),
          ),
        ),
      );

      expect(find.text('HEIMAT'), findsOneWidget);
      expect(find.text('Konto erstellen'), findsOneWidget);
    });

    testWidgets('has name, email, and password fields',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => AuthProvider(),
          child: const MaterialApp(
            home: RegisterScreen(),
          ),
        ),
      );

      expect(find.byType(TextField), findsNWidgets(4));
      expect(find.text('Name'), findsOneWidget);
      expect(find.text('E-Mail'), findsOneWidget);
      expect(find.text('Passwort'), findsWidgets);
      expect(find.text('Passwort bestätigen'), findsOneWidget);
    });

    testWidgets('has login link', (WidgetTester tester) async {
      await tester.pumpWidget(
        ChangeNotifierProvider(
          create: (_) => AuthProvider(),
          child: const MaterialApp(
            home: RegisterScreen(),
          ),
        ),
      );

      expect(find.text('Bereits ein Konto? Anmelden'), findsOneWidget);
    });
  });
}
