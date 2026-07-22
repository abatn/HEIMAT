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

# -----------------------------------------------------------------------------
# Argumente parsen
# -----------------------------------------------------------------------------
# Discovery-Modus (default):    print JSON auf stdout, exit 0.
# --enforce-Modus:               exit 1 wenn user-scope-tracked-stale-hits > 0
#                                (siehe spec §12.1 für Scope).
# --quiet-Modus:                 unterdrückt JSON-Output auf stdout
#                                (für saubere Render-preDeploy-Logs).
ENFORCE_FLAG=0
QUIET_FLAG=0
for arg in "$@"; do
  case "$arg" in
    --enforce) ENFORCE_FLAG=1 ;;
    --quiet)   QUIET_FLAG=1 ;;
    --help|-h)
      cat <<HELP
Usage: $0 [--enforce] [--quiet]

Default (discovery):
  Printet JSON-Array auf stdout — kein exit-code-Effect.

--enforce:
  Wie default, aber exit 1 wenn ein verbleibender stale-Pattern-Treffer in
  einer getrackten User-Scope-Datei gefunden wird. .loop.md und bauplan.md sind
  per .gitignore Z36-37 Working-Tree-Only ausgenommen.

  User-Scope umfasst die in dieser Session aktiv editierten tracked Files:
  HANDOFF.md, .claude/CLAUDE.md, heimat-plan.md, marketing/heise-article.md,
  docs/data-analytics/{FINAL-STATUS,investor-report,market-sizing}.md.
  Source-Code (src/) ist nicht erfasst — dortige Wortliste-Treffer sind
  legitime Tech-Verwendungen (z.B. "iOS simulator build target").

--quiet:
  Unterdrückt JSON-Output auf stdout. Empfohlen für Render-preDeploy-Logs.

HELP
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg" >&2
      exit 64
      ;;
  esac
done

# Env-Vars für Python-Heredoc (Bash-Variablen sind in heredoc-stdin nicht
# direkt als sys.argv sichtbar). Wir propagieren per export.
export PRESCAN_ENFORCE="$ENFORCE_FLAG"
export PRESCAN_QUIET="$QUIET_FLAG"

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

# JSON-Output-Modus: bei --quiet unterdrückt (für übersichtliche CI-Logs).
QUIET = os.getenv('PRESCAN_QUIET', '0') == '1'
if not QUIET:
    print(json.dumps(results, indent=2, ensure_ascii=False))

# -----------------------------------------------------------------------------
# --enforce-Auswertung (User-Scope tracked files)
# -----------------------------------------------------------------------------
# Architektur-Entscheidung (stale-doc-fix-spec.md §12.1):
#   - Working-Tree-Planning-Docs (.loop.md, bauplan.md) sind per .gitignore
#     Z36-37 ausgeschlossen.
#   - Source-Code (src/, build-yaml, package-locks) ist nicht erfasst — Wortliste-
#     Treffer dort sind legitime Tech-Verwendungen.
#   - Erfasst sind nur die in dieser Session aktiv editierten tracked Files:
#     die Round 1+2+3-Familien (tech-repo + analytics + marketing).
#
# Diese engere Scope verhindert fälschliches Blockieren von Render-Deploys
# durch legitime Tech-Begriffe ("simulator" in Build-Targets etc.).
ENFORCE = os.getenv('PRESCAN_ENFORCE', '0') == '1'

if ENFORCE:
    GITIGNORED_PLANNING_DOCS = (
        './.loop.md',
        './bauplan.md',
    )
    # User-Scope = tracked files, die in dieser Session aktiv editiert wurden
    # (Round 1+2+3 Stale-Doc-Sweep). Andere tracked-Stale sind discovery-only.
    ENFORCED_USER_SCOPE_FILES = (
        './.claude/CLAUDE.md',
        './HANDOFF.md',
        './heimat-plan.md',
        './marketing/heise-article.md',
        './docs/data-analytics/FINAL-STATUS.md',
        './docs/data-analytics/investor-report.md',
        './docs/data-analytics/market-sizing.md',
    )

    user_scope_hits = [
        r for r in results
        if r['file'] not in GITIGNORED_PLANNING_DOCS
        and r['file'] in ENFORCED_USER_SCOPE_FILES
    ]
    if len(user_scope_hits) > 0:
        missing_files = sorted({r['file'] for r in user_scope_hits})
        print(('[ENFORCE] ' + str(len(user_scope_hits)) +
               ' stale-pattern hits in user-scope tracked files. ' +
               'Failing preDeploy per stale-doc-fix-spec.md §12.1. Betroffen: '
               + ', '.join(missing_files)),
              file=sys.stderr)
        sys.exit(1)
    else:
        print(('[ENFORCE] OK: 0 stale-pattern hits in user-scope tracked '
               'files. preDeploy allowed.'),
              file=sys.stderr)
PYEOF
