---
name: heimat-flutter
description: "Flutter-Entwicklung für HEIMAT. Trigger bei Änderungen an src/mobile/lib/ oder src/mobile/test/. Enthält Vendored-SDK-Befehle, Format-Regeln und bekannte Bugs."
---

# HEIMAT Flutter Skill

## Vendored SDK

Das Flutter SDK liegt in `src/mobile/flutter/bin/`. NIE `flutter` oder `dart` direkt aufrufen.

```bash
src/mobile/flutter/bin/flutter pub get
src/mobile/flutter/bin/dart format lib/ test/
src/mobile/flutter/bin/flutter analyze --no-fatal-infos
src/mobile/flutter/bin/flutter test
```

## Format-Pflicht

Vor JEDEM Commit, der Dart-Dateien berührt:
```bash
src/mobile/flutter/bin/dart format lib/ test/
```
CI prüft `dart format --set-exit-if-changed .` — unformatierter Dart ist der häufigste CI-Fehler.

## Bekannte Bugs

### DECIMAL-to-double Crash
PostgreSQL gibt DECIMAL als Strings zurück → Flutter `.toDouble()` auf null.
**Fix:** `double.parse(json['latitude'].toString())` in Providern.

### Journey Parameter-Mismatch
Frontend: `?from=lat,lng&to=lat,lng`
Backend: `?from_lat=&from_lng=&to_lat=&to_lng=`
**Fix:** Query-Params in `mobility_provider.dart` an Backend anpassen.

## Datei-Struktur

```
src/mobile/lib/
├── main.dart
├── core/
│   ├── config/app_config.dart    # Service-URLs
│   ├── theme/                    # App-Theme, Farben
│   └── widgets/                  # Shared Widgets
└── features/
    ├── mobility/presentation/    # ÖPNV, Karten, Routing
    ├── finance/presentation/     # Taler P2P
    └── health/presentation/      # Arzt-Suche
```
