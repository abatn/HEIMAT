import 'package:flutter/material.dart';

/// ServiceDefinition ist der Vertrag zwischen der Registry und dem
/// NativeMiniProgramScreen. Eine ServiceDefinition beschreibt:
///
/// 1. **Identität**: id + name + beschreibung
/// 2. **Native Builder**: optional Widget-Function die Native Flutter rendert
/// 3. **Fallback URL**: für Services die noch nicht migriert sind (IFrame-Pfad)
///
/// Wenn [nativeBuilder] gesetzt ist, wird das native Widget gerendert (kein IFrame).
/// Andernfalls greift der bestehende MiniProgramContainer (Web IFrame / Mobile Fallback).
///
/// **Phase E:** Ersetzt die alte MiniProgram.url→IFrame-Logik schrittweise.
/// **AI-Architektur.md konform:** On-Device Flutter-Widgets statt WebView.
class ServiceDefinition {
  /// Eindeutige Service-ID (z.B. 'weather', 'air', 'finance')
  final String id;

  /// Anzeige-Name für UI
  final String name;

  /// Externe URL — wird nur verwendet wenn kein nativeBuilder gesetzt ist
  final String? fallbackUrl;

  /// Builder für das native Flutter-Widget. Wenn null, wird IFrame-Pfad benutzt.
  final Widget Function(BuildContext context)? nativeBuilder;

  const ServiceDefinition({
    required this.id,
    required this.name,
    this.fallbackUrl,
    this.nativeBuilder,
  });

  /// True wenn ein native Flutter-Widget verfügbar ist
  bool get isNative => nativeBuilder != null;
}
