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
      {double radius = 1000}) async {
    // Kein Netzwerk im Test – Map bleibt ohne Live-Tiles
    return;
  }
}

Widget buildTestApp() {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<MobilityProvider>(create: (_) => _StubMobility()),
      ChangeNotifierProvider<FinanceProvider>(create: (_) => FinanceProvider()),
      ChangeNotifierProvider<HealthProvider>(create: (_) => HealthProvider()),
    ],
    child: MaterialApp(
      title: AppConfig.appName,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      home: const MobilityScreen(),
      debugShowCheckedModeBanner: false,
    ),
  );
}

void main() {
  testWidgets('Mobilität-Tab zeigt Karte + Start/Ziel-Felder',
      (WidgetTester tester) async {
    FlutterError.onError = (details) {
      if (details.toString().contains('openstreetmap')) return;
      FlutterError.presentError(details);
    };

    await tester.pumpWidget(buildTestApp());
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.widgetWithText(AppBar, 'Mobilit\u00e4t'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'Start'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'Ziel'), findsOneWidget);
  });

  testWidgets('Finanzen-Tab zeigt Guthaben-Section',
      (WidgetTester tester) async {
    FlutterError.onError = (details) {
      if (details.toString().contains('openstreetmap')) return;
      FlutterError.presentError(details);
    };

    final app = MultiProvider(
      providers: [
        ChangeNotifierProvider<MobilityProvider>(
            create: (_) => _StubMobility()),
        ChangeNotifierProvider<FinanceProvider>(
            create: (_) => FinanceProvider()),
        ChangeNotifierProvider<HealthProvider>(create: (_) => HealthProvider()),
      ],
      child: MaterialApp(
        home: const FinanceScreen(),
        theme: AppTheme.lightTheme,
      ),
    );

    await tester.pumpWidget(app);
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Aktuelles Guthaben'), findsOneWidget);
  });

  testWidgets('Gesundheit-Tab zeigt Arzt-Screen', (WidgetTester tester) async {
    FlutterError.onError = (details) {
      if (details.toString().contains('openstreetmap')) return;
      FlutterError.presentError(details);
    };

    final app = MultiProvider(
      providers: [
        ChangeNotifierProvider<MobilityProvider>(
            create: (_) => _StubMobility()),
        ChangeNotifierProvider<FinanceProvider>(
            create: (_) => FinanceProvider()),
        ChangeNotifierProvider<HealthProvider>(create: (_) => HealthProvider()),
      ],
      child: MaterialApp(
        home: const HealthScreen(),
        theme: AppTheme.lightTheme,
      ),
    );

    await tester.pumpWidget(app);
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.widgetWithText(AppBar, 'Gesundheit'), findsOneWidget);
  });
}
