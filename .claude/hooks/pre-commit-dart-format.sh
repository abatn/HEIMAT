#!/bin/bash
# HEIMAT Pre-Commit Hook: Dart Format Check
# Prüft ob Dart-Dateien korrekt formatiert sind vor dem Commit.
#
# Verwendung: Als Git-Pre-Commit-Hook oder manuell ausführen.

set -e

FLUTTER_SDK="src/mobile/flutter/bin"
DART_FORMAT="$FLUTTER_SDK/dart"

if [ ! -f "$DART_FORMAT" ]; then
    echo "WARNUNG: Vendored Flutter SDK nicht gefunden unter $FLUTTER_SDK"
    echo "Überspringe Dart-Format-Check."
    exit 0
fi

# Prüfe ob es Dart-Dateien gibt die geändert wurden
CHANGED_DART=$(git diff --cached --name-only --diff-filter=ACM -- '*.dart' 2>/dev/null || true)

if [ -z "$CHANGED_DART" ]; then
    echo "Keine Dart-Dateien geändert — überspringe Format-Check."
    exit 0
fi

echo "Prüfe Formatierung von geänderten Dart-Dateien..."

# Formatiere die geänderten Dateien
echo "$CHANGED_DART" | xargs "$DART_FORMAT" format

# Prüfe ob sich etwas geändert hat (d.h. Dateien waren unformatiert)
NOT_FORMATTED=$(git diff --name-only -- '*.dart' 2>/dev/null || true)

if [ -n "$NOT_FORMATTED" ]; then
    echo "FEHLER: Folgende Dart-Dateien sind nicht formatiert:"
    echo "$NOT_FORMATTED"
    echo ""
    echo "Bitte führen Sie aus: $DART_FORMAT format lib/ test/"
    echo "Dann stage-n und erneut committen."
    exit 1
fi

echo "Dart-Formatierung OK."
