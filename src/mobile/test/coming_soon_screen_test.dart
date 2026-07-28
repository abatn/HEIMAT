import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:heimat_app/core/theme/app_colors.dart';
import 'package:heimat_app/features/miniprogram/presentation/coming_soon_screen.dart';

/// Phase X.1 Tests — ComingSoonScreen rendert ohne IFrame.
///
/// **User-Regel-Konform:** KEIN WebView, KEIN IFrame, KEIN dart:html.
/// ComingSoonScreen ist ein reines Flutter-Widget.
void main() {
  Widget _wrap(Widget child) {
    return MaterialApp(
      theme: ThemeData(
        scaffoldBackgroundColor: AppColors.background,
        useMaterial3: true,
      ),
      home: Scaffold(body: child),
    );
  }

  testWidgets('rendert Service-Name und "Coming Soon"-Badge',
      (WidgetTester tester) async {
    await tester.pumpWidget(_wrap(const ComingSoonScreen(
      serviceName: 'Test-Service',
      description: 'Test-Beschreibung fuer Phase X.1.',
      category: 'Alltag',
      searchTags: ['tag1', 'tag2', 'tag3'],
    )));

    // pumpAndSettle verboten (infinite-animation-hang-Risiko).
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Test-Service'), findsOneWidget);
    expect(find.text('Coming Soon'), findsOneWidget);
    expect(find.text('Test-Beschreibung fuer Phase X.1.'), findsOneWidget);
    expect(find.text('Kategorie: Alltag'), findsOneWidget);
  });

  testWidgets('rendert Search-Tags (max 6 sichtbar)', (WidgetTester tester) async {
    await tester.pumpWidget(_wrap(const ComingSoonScreen(
      serviceName: 'Service',
      description: 'Desc',
      category: 'Kat',
      searchTags: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    )));

    await tester.pump(const Duration(milliseconds: 100));

    // Erste 6 Tags sichtbar (Pattern: searchTags.take(6))
    expect(find.text('a'), findsOneWidget);
    expect(find.text('f'), findsOneWidget);
    // 7. und 8. Tag abgeschnitten
    expect(find.text('g'), findsNothing);
    expect(find.text('h'), findsNothing);
  });

  testWidgets('rendert ohne Search-Tags ohne Crash', (WidgetTester tester) async {
    await tester.pumpWidget(_wrap(const ComingSoonScreen(
      serviceName: 'Service',
      description: 'Beschreibung',
      category: 'Test',
      searchTags: <String>[],
    )));

    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Service'), findsOneWidget);
    expect(find.text('Coming Soon'), findsOneWidget);
  });

  testWidgets('zeigt User-Regel-Footer (kein IFrame)',
      (WidgetTester tester) async {
    await tester.pumpWidget(_wrap(const ComingSoonScreen(
      serviceName: 'Service',
      description: 'Desc',
      category: 'Kat',
      searchTags: <String>[],
    )));

    await tester.pump(const Duration(milliseconds: 100));

    // Footer-Text dokumentiert die IFrame-Verbot-Regel.
    expect(
      find.textContaining('IFrame'),
      findsOneWidget,
      reason: 'Footer-Text mit IFrame-Verbot-Erklaerung muss sichtbar sein',
    );
  });
}