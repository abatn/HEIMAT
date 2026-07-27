import 'package:flutter/material.dart';

/// AI Context Domain Model — wird vom Provider verwendet um Mini-Programme
/// kontextabhängig zu sortieren und Empfehlungen zu generieren.
///
/// Privacy-by-Design:
/// - Keine PII (kein Name, keine E-Mail)
/// - Nur anonyme Zeit-/Verlaufs-/Standort-Ebene
/// - Wird nicht an Server gesendet (alles client-side)
///
/// Hinweis: Heißt ContextTime (nicht TimeOfDay) weil Flutter material.dart
/// bereits eine TimeOfDay-Klasse exportiert — würde sonst Konflikt geben.
enum ContextTime {
  earlyMorning, // 04:00 - 07:00 (Pendler-Info)
  morning, // 07:00 - 10:00 (Wetter + Verkehr)
  midday, // 10:00 - 14:00 (Events + Mittag)
  afternoon, // 14:00 - 17:00 (Shopping + Freizeit)
  evening, // 17:00 - 22:00 (Finanzen + Abendplanung)
  night; // 22:00 - 04:00 (Notfall-Services) — Semikolon trennt Enum-Werte von Membern

  static ContextTime fromHour(int hour) {
    if (hour >= 4 && hour < 7) return ContextTime.earlyMorning;
    if (hour >= 7 && hour < 10) return ContextTime.morning;
    if (hour >= 10 && hour < 14) return ContextTime.midday;
    if (hour >= 14 && hour < 17) return ContextTime.afternoon;
    if (hour >= 17 && hour < 22) return ContextTime.evening;
    return ContextTime.night;
  }

  String get label {
    switch (this) {
      case ContextTime.earlyMorning:
        return 'Früher Morgen';
      case ContextTime.morning:
        return 'Morgen';
      case ContextTime.midday:
        return 'Mittag';
      case ContextTime.afternoon:
        return 'Nachmittag';
      case ContextTime.evening:
        return 'Abend';
      case ContextTime.night:
        return 'Nacht';
    }
  }

  IconData get icon {
    switch (this) {
      case ContextTime.earlyMorning:
        return Icons.nightlight_outlined;
      case ContextTime.morning:
        return Icons.wb_twilight;
      case ContextTime.midday:
        return Icons.wb_sunny_outlined;
      case ContextTime.afternoon:
        return Icons.wb_sunny;
      case ContextTime.evening:
        return Icons.nights_stay_outlined;
      case ContextTime.night:
        return Icons.bedtime_outlined;
    }
  }
}

/// Repräsentiert den User-Kontext für AI-Personalisierung
class AiContext {
  final ContextTime timeOfDay;
  final bool isWeekend;
  final List<String> recentProgramIds; // Letzte 5 geöffnete Programme
  final bool hasActiveLocation;

  const AiContext({
    required this.timeOfDay,
    required this.isWeekend,
    required this.recentProgramIds,
    required this.hasActiveLocation,
  });

  /// Frischer Kontext für die aktuelle Zeit (anonyme Defaults)
  factory AiContext.now({List<String>? recent, bool hasLocation = false}) {
    final now = DateTime.now();
    return AiContext(
      timeOfDay: ContextTime.fromHour(now.hour),
      isWeekend:
          now.weekday == DateTime.saturday || now.weekday == DateTime.sunday,
      recentProgramIds: recent ?? const [],
      hasActiveLocation: hasLocation,
    );
  }

  /// Score-Berechnung: Wie relevant ist ein Program für diesen Kontext?
  /// Werte: 0.0 (irrelevant) bis 1.0 (highly relevant)
  double scoreForProgram(String programId, {String? primaryTag}) {
    var score = 0.5; // Baseline

    // Bonus: Häufig genutzt
    if (recentProgramIds.contains(programId)) score += 0.1;
    if (recentProgramIds.indexOf(programId) == 0) score += 0.05;

    // Tageszeit-Match (program-spezifisch)
    score += _timeOfDayBonus(programId);

    // Wochenend-Match
    if (isWeekend && primaryTag == 'Reise') score += 0.2;
    if (!isWeekend && primaryTag == 'Mobilität') score += 0.1;

    // Location-Match
    if (!hasActiveLocation && (programId == 'events' || programId == 'jobs')) {
      score += 0.15; // Diese funktionieren auch ohne GPS
    }

    return score.clamp(0.0, 1.0);
  }

  double _timeOfDayBonus(String programId) {
    final tod = timeOfDay;
    const morningIds = ['weather', 'mobility']; // Pendler-relevant
    const middayIds = ['events', 'jobs'];
    const eveningIds = ['finance', 'events'];
    const nightIds = ['buergeramt', 'health'];

    if (tod == ContextTime.morning || tod == ContextTime.earlyMorning) {
      return morningIds.contains(programId) ? 0.25 : 0.0;
    }
    if (tod == ContextTime.midday) {
      return middayIds.contains(programId) ? 0.2 : 0.0;
    }
    if (tod == ContextTime.afternoon) {
      return ['weather', 'events', 'jobs'].contains(programId) ? 0.15 : 0.0;
    }
    if (tod == ContextTime.evening) {
      return eveningIds.contains(programId) ? 0.2 : 0.0;
    }
    if (tod == ContextTime.night) {
      return nightIds.contains(programId) ? 0.15 : 0.0;
    }
    return 0.0;
  }
}
