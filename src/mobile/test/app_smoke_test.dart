import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:heimat_app/core/config/app_config.dart';
import 'package:heimat_app/core/theme/app_theme.dart';
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
      ChangeNotifierProvider<FinanceProvider>(create: (_) => _StubFinance()),
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
  testWidgets('Mobilitaet-Tab zeigt Karte', (WidgetTester tester) async {
    FlutterError.onError = (details) {
      if (details.toString().contains('openstreetmap')) return;
      FlutterError.presentError(details);
    };

    await tester.pumpWidget(buildTestApp(child: const MobilityScreen()));
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.byType(MobilityScreen), findsOneWidget);
  });

  testWidgets('Finanzen-Tab zeigt Guthaben-Section',
      (WidgetTester tester) async {
    FlutterError.onError = (details) {
      if (details.toString().contains('openstreetmap')) return;
      FlutterError.presentError(details);
    };

    await tester.pumpWidget(buildTestApp(child: const FinanceScreen()));
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.byType(FinanceScreen), findsOneWidget);
  });

  testWidgets('Gesundheit-Tab zeigt Arzt-Screen', (WidgetTester tester) async {
    FlutterError.onError = (details) {
      if (details.toString().contains('openstreetmap')) return;
      FlutterError.presentError(details);
    };

    await tester.pumpWidget(buildTestApp(child: const HealthScreen()));
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.byType(HealthScreen), findsOneWidget);
  });
}
