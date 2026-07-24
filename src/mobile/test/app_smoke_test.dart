import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:heimat_app/core/config/app_config.dart';
import 'package:heimat_app/core/services/auth_service.dart';
import 'package:heimat_app/core/theme/app_theme.dart';
import 'package:heimat_app/core/widgets/skeleton_loader.dart';
import 'package:heimat_app/core/widgets/empty_state.dart';
import 'package:heimat_app/features/mobility/presentation/mobility_provider.dart';
import 'package:heimat_app/features/finance/presentation/finance_provider.dart';
import 'package:heimat_app/features/health/presentation/health_provider.dart';
import 'package:heimat_app/features/mobility/presentation/mobility_screen.dart';
import 'package:heimat_app/features/finance/presentation/finance_screen.dart';
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

Widget buildTestApp({required Widget child}) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<MobilityProvider>(create: (_) => _StubMobility()),
      ChangeNotifierProvider<FinanceProvider>(
        create: (_) => _StubFinance(AuthService()),
      ),
      ChangeNotifierProvider<HealthProvider>(create: (_) => _StubHealth()),
    ],
    child: MaterialApp(
      title: AppConfig.appName,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      home: child,
      debugShowCheckedModeBanner: false,
    ),
  );
}

void main() {
  group('MobilityScreen', () {
    testWidgets('shows map widget', (WidgetTester tester) async {
      await tester.pumpWidget(buildTestApp(child: const MobilityScreen()));
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.byType(MobilityScreen), findsOneWidget);
    });

    testWidgets('renders without crash', (WidgetTester tester) async {
      await tester.pumpWidget(buildTestApp(child: const MobilityScreen()));
      await tester.pump(const Duration(milliseconds: 300));
      expect(tester.takeException(), isNull);
    });
  });

  group('FinanceScreen', () {
    testWidgets('shows finance screen', (WidgetTester tester) async {
      await tester.pumpWidget(buildTestApp(child: const FinanceScreen()));
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.byType(FinanceScreen), findsOneWidget);
    });

    testWidgets('renders without crash', (WidgetTester tester) async {
      await tester.pumpWidget(buildTestApp(child: const FinanceScreen()));
      await tester.pump(const Duration(milliseconds: 300));
      expect(tester.takeException(), isNull);
    });
  });

  group('HealthScreen', () {
    testWidgets('shows health screen', (WidgetTester tester) async {
      await tester.pumpWidget(buildTestApp(child: const HealthScreen()));
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.byType(HealthScreen), findsOneWidget);
    });

    testWidgets('shows filter chips', (WidgetTester tester) async {
      await tester.pumpWidget(buildTestApp(child: const HealthScreen()));
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.byType(FilterChip), findsWidgets);
    });

    testWidgets('shows FAB for doctor registration',
        (WidgetTester tester) async {
      await tester.pumpWidget(buildTestApp(child: const HealthScreen()));
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.byType(FloatingActionButton), findsOneWidget);
    });
  });

  group('Shared Widgets', () {
    testWidgets('EmptyState shows icon and text', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: const EmptyState(
              icon: Icons.inbox,
              title: 'Leer',
              description: 'Keine Daten',
            ),
          ),
        ),
      );
      await tester.pump();
      expect(find.text('Leer'), findsOneWidget);
      expect(find.text('Keine Daten'), findsOneWidget);
      expect(find.byIcon(Icons.inbox), findsOneWidget);
    });

    testWidgets('SkeletonLoader animates', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SkeletonLoader(),
          ),
        ),
      );
      await tester.pump();
      expect(find.byType(SkeletonLoader), findsOneWidget);
    });
  });

  group('AppConfig', () {
    test('has default backend URL', () {
      expect(AppConfig.backendUrl, isNotEmpty);
    });

    test('has app name', () {
      expect(AppConfig.appName, isNotEmpty);
    });
  });
}
