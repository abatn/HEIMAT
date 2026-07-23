#!/bin/bash
# HEIMAT Safety Hook: Verhindert `git add -A` oder `git add .` vom Repo-Root.
#
# Das Repo enthält untracked Junk:
# - src/mobile/flutter/ (vendored SDK)
# - src/mobile/android/, src/mobile/ios/
# - .mimocode/
#
# Dieser Hook warnt, wenn der gesamte Repo-Root gestaged wird.

set -e

# Prüfe ob `git add .` oder `git add -A` aufgerufen wurde
# (Dies ist ein Wrapper — in der Praxis wird dies manuell oder via Hook ausgeführt)

if [ "$1" = "." ] || [ "$1" = "-A" ] || [ "$1" = "--all" ]; then
    echo "⚠️  WARNUNG: 'git add $1' ist NICHT erlaubt in HEIMAT!"
    echo ""
    echo "Das Repo enthält untracked Junk:"
    echo "  - src/mobile/flutter/ (vendored SDK)"
    echo "  - src/mobile/android/, src/mobile/ios/"
    echo "  - .mimocode/"
    echo ""
    echo "Bitte stage-n Sie Dateien explizit:"
    echo "  git add src/mobile/lib/..."
    echo "  git add src/backend/src/..."
    echo "  git add src/backend/package.json"
    exit 1
fi
