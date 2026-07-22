#!/usr/bin/env bash
# =============================================================================
# stale-doc-prescan.sh
# -----------------------------------------------------------------------------
# Repo-weiter Pre-Scan für stale "Simulator / Demo / Fake" - Referenzen.
# Spec-Kontext: stale-doc-fix-spec.md (Phase 18 Folge-Aktion)
#
# User-Constraint: kein demo, kein mock, kein fake, kein simulation, kein
# spielgeld als framestory. Wir wollen eine exakte Treffer-Liste pro Datei mit
# Kontext, sodass die Replace-Wortschatz-Tabelle Zeile-fuer-Zeile abgearbeitet
# werden kann.
#
# Output: JSON-Array von Treffern mit Schema:
#   [{file: string, line: number, snippet: string, suggested_replace: string}]
#
# Bug-Fix-Geschichte:
#   V1 hatte EXCLUDE_DIRS={'src/mobile/flutter',...} (exact name match) — dies
#   funktionierte NICHT, weil os.walk dir='flutter' liefert, nicht 'src/mobile/flutter'.
#   Resultat: 30+ false positives im vendored Flutter SDK.
#   V2 nutzt EXCLUDE_PREFIXES (path-prefix match) — siehe Python-Code unten.
#
# Usage:
#   ./scripts/stale-doc-prescan.sh             # JSON-Output auf stdout
#   ./scripts/stale-doc-prescan.sh | jq .      # formatiert (wenn jq vorhanden)
#   ./scripts/stale-doc-prescan.sh > hits.json # in Datei
#
# Abhängigkeiten:
#   python3 (auf PATH; getestet mit 3.14)
#   rg, jq sind OPTIONAL — der One-Liner fällt ohne sie zurück auf grep/python3.
#
# Author: HEIMAT 2.0 / Phase 18 Folge-Aktion
# =============================================================================

set -euo pipefail

# Tool-Verfügbarkeit prüfen (informativ)
for t in rg ripgrep jq python3 grep; do
  printf '  %-10s ' "$t" >/dev/stderr
  command -v "$t" >/dev/null 2>&1 && echo "OK" >/dev/stderr || echo "MISSING" >/dev/stderr
done

# ============================================================================
# One-Liner: walk repo, find stale "simulator/demo/fake" mentions in docs,
# produce JSON {file, line, snippet (3 lines around match), suggested_replace}.
#
# Kritische Fixes (gegenüber V1):
#   1. EXCLUDE_PREFIXES statt EXCLUDE_DIRS — os.walk liefert dir-Namen auf
#      mehreren Tiefen; nur path-prefix funktioniert zuverlässig.
#   2. EXCLUDE_FILE_PATTERNS — explizite Lock-/Binär-Datei-Ignorierung.
#   3. Suggested-Replace wird per Datei-Familie aufgelöst (tech-repo /
#      analytics / funding-marketing), wie in spec §4 definiert.
#   4. Snippet enthält 3 Zeilen Drumherum (Zeile-1, Match, Zeile+1).
# ============================================================================

python3 << 'PYEOF'
import os, re, json, sys

ROOT = '.'

# Path-prefix Ausschluss (V2-Fix: war vorher name-match, jetzt pfad-basiert).
# Reihenfolge ist irrelevant — wir testen alle nacheinander mit startswith.
EXCLUDE_PREFIXES = (
    './src/mobile/flutter/',     # Vendored Flutter SDK (3.24.5, riesig)
    './node_modules/',
    './.git/',
    './.dart_tool/',
    './build/',
    './out/',
    './.mimocode/',              # System-Lock-Datei
)

# Einzelne Files die ignoriert werden (z. B. Lock-Files).
EXCLUDE_FILES = (
    './.mimocode/.cron-lock',
    './src/mobile/.git',
)

# Wir scannen nur diese Datei-Typen (kein Binary, keine Sourcen).
GLOBS = ('.md', '.yml', '.yaml', '.toml', '.json')

# Wortliste (case-insensitive) — exakt wie in spec §3.
WR = re.compile(
    r'simulator|simulated|simulier|fake|play-money|spielgeld|'
    r'sandbox|mocked|mock-|mock_|stub|cheat|hardcoded',
    re.IGNORECASE,
)

# Replace-Wortschatz-Routing pro Datei-Familie (siehe spec §4).
FAMILY = {
    './docs/data-analytics/': 'spec §4.2 analytics wording',
    './funding/':             'spec §4.3 funding/marketing',
    './blog/':                'spec §4.3 funding/marketing',
    './marketing/':           'spec §4.3 funding/marketing',
    './docs/ai-local/':       'spec §4.3 funding/marketing',
}


def skip(path: str) -> bool:
    """True wenn der Pfad explizit ausgeschlossen ist."""
    if path in EXCLUDE_FILES:
        return True
    return any(path.startswith(p) for p in EXCLUDE_PREFIXES)


def family(path: str) -> str:
    """Mappt eine Datei auf ihren Replace-Wortschatz-Spec-Pointer."""
    for prefix, spec_ref in FAMILY.items():
        if path.startswith(prefix):
            return spec_ref
    return 'spec §4.1 tech-repo wording'


def build_snippet(lines, i):
    """3 Zeilen Drumherum: (line-1, match, line+1) — kompakt und informativ."""
    ctx_start = max(0, i - 2)
    ctx_end = min(len(lines), i + 1)
    return ' | '.join(lines[ctx_start:ctx_end])


results = []
for r, dirs, files in os.walk(ROOT):
    if skip(r):
        dirs[:] = []
        continue
    for f in files:
        p = os.path.join(r, f)
        if skip(p):
            continue
        if not f.endswith(GLOBS):
            continue
        try:
            with open(p, encoding='utf-8', errors='replace') as fh:
                L = fh.read().splitlines()
        except (PermissionError, IsADirectoryError):
            continue

        for ln_idx, line in enumerate(L, 1):
            if WR.search(line):
                results.append({
                    'file': p,
                    'line': ln_idx,
                    'snippet': build_snippet(L, ln_idx - 1),  # 0-indexed
                    'suggested_replace': family(p),
                })

# Sortiert nach Datei + Zeile für einfache zeilen-fuer-zeilen Abarbeitung.
results.sort(key=lambda x: (x['file'], x['line']))
print(json.dumps(results, indent=2, ensure_ascii=False))
PYEOF
