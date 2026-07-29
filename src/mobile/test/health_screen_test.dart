import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/material.dart';
import 'package:heimat_app/features/health/presentation/health_screen.dart';
import 'package:heimat_app/features/health/presentation/health_provider.dart';
import 'package:heimat_app/features/ai_chat/presentation/ai_chat_provider.dart';
import 'package:heimat_app/features/checkin/presentation/checkin_provider.dart';
import 'package:heimat_app/core/services/auth_service.dart';

/// HealthScreen Integration Tests — Phase X.9
///
/// Prüft dass HealthScreen mit den neuen integrierten Providern
/// (AiChatProvider, CheckinProvider) korrekt startet.
///
/// **Keine Mocks/Simulation:** Alle Provider sind echte Instanzen.
/// - AiChatProvider: Echter Provider (On-Demand HTTP)
/// - CheckinProvider: Echter Provider (braucht AuthService)
/// - HealthProvider: Echter Provider
///
/// **Scope:** Nur Initial-Render + Struktur-Prüfung.
/// Keine HTTP-Abhängigkeit (Provider starten ohne Netzwerk).
void main() {
  late HealthProvider healthProvider;
  late AiChatProvider aiChatProvider;
  late CheckinProvider checkinProvider;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    healthProvider = HealthProvider();
    aiChatProvider = AiChatProvider();
    checkinProvider = CheckinProvider(AuthService());
  });

  testWidgets('HealthScreen renders with AI Chat header and Lebenszeichen',
      (tester) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: healthProvider),
          ChangeNotifierProvider.value(value: aiChatProvider),
          ChangeNotifierProvider.value(value: checkinProvider),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: HealthScreen(),
          ),
        ),
      ),
    );

    // Warte auf erste Frame-Render
    await tester.pump(const Duration(milliseconds: 100));

    // Prüfe: Health AI Header existiert
    expect(
      find.text('Health AI Assistent'),
      findsOneWidget,
      reason: 'AI Health Chat Header sollte sichtbar sein',
    );

    // Prüfe: Symptom-Subtitle existiert
    expect(
      find.textContaining('Symptome'),
      findsOneWidget,
      reason: 'Symptome/Triage-Beschreibung sollte sichtbar sein',
    );

    // Prüfe: Filter-Chips existieren (Alle, Allgemein, Zahnarzt, etc.)
    expect(
      find.text('Alle'),
      findsOneWidget,
      reason: 'Filter-Chip "Alle" sollte sichtbar sein',
    );

    // Prüfe: Lebenszeichen Header im Doctor-List-Bereich
    // Nach dem ersten Frame ist provider.doctors noch leer (kein HTTP)
    // Daher zeigen wir den EmptyState — der Lebenszeichen-Status
    // erscheint als erstes Item in der leeren Liste
    expect(
      find.text('Lebenszeichen'),
      findsOneWidget,
      reason: 'Lebenszeichen-Sektion sollte im Screen sichtbar sein',
    );
  });

  testWidgets('HealthScreen AI Chat section can be expanded', (tester) async {
    // Groesserer Viewport fuer den expandierten AI Chat + EmptyState
    addTearDown(tester.view.resetPhysicalSize);
    tester.view.physicalSize = const Size(1080, 2400);

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: healthProvider),
          ChangeNotifierProvider.value(value: aiChatProvider),
          ChangeNotifierProvider.value(value: checkinProvider),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: HealthScreen(),
          ),
        ),
      ),
    );

    await tester.pump(const Duration(milliseconds: 100));

    // Prüfe: Quick Suggestions sind NICHT sichtbar (collapsed)
    expect(
      find.text('Rückenschmerzen'),
      findsNothing,
      reason: 'Quick Suggestions sollten initial collapsed sein',
    );

    // AI Header antippen um zu expandieren
    await tester.tap(find.text('Health AI Assistent'));
    await tester.pump(const Duration(milliseconds: 200));

    // Prüfe: Quick Suggestions sind jetzt sichtbar
    expect(
      find.text('Rückenschmerzen'),
      findsOneWidget,
      reason: 'Nach Expand sollten Quick Suggestions sichtbar sein',
    );
    expect(
      find.text('Kopfschmerzen'),
      findsOneWidget,
      reason: 'Nach Expand sollten Quick Suggestions sichtbar sein',
    );
    expect(
      find.text('Fieber'),
      findsOneWidget,
      reason: 'Nach Expand sollten Quick Suggestions sichtbar sein',
    );
  });

  testWidgets('HealthScreen shows Lebenszeichen toggle', (tester) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: healthProvider),
          ChangeNotifierProvider.value(value: aiChatProvider),
          ChangeNotifierProvider.value(value: checkinProvider),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: HealthScreen(),
          ),
        ),
      ),
    );

    await tester.pump(const Duration(milliseconds: 100));

    // Prüfe: Lebenszeichen Text "Nicht aktiv" sichtbar
    expect(
      find.textContaining('Nicht aktiv'),
      findsOneWidget,
      reason: 'Lebenszeichen sollte initial inaktiv sein',
    );
  });
}
