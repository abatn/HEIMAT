#!/usr/bin/env bash
# =============================================================================
# audit-no-mocks.sh — Mock-Policy enforcement for HEIMAT 2.0
# =============================================================================
# User-Regel: AGENTS.md:143 + knowledge.md:283 — "mock, simulation, fake sind verboten"
#
# Forbidden patterns in PRODUCTION code paths:
#   - Phase R explicit removals: fundLocal, _computeMockLiveStatus,
#                                 StubNaiveBayesClassifier, StubNaiveBayes
#   - String literals: local://demo, exchange_base_url='local://demo'
#
# Allowed exceptions:
#   - Self-Datei (audit-no-mocks.sh)
#   - Policy-Dateien: AGENTS.md, knowledge.md, .claude/CLAUDE.md (per Glob)
#   - Kommentar-Linien mit Markern: Phase R, entfernt, removed, REMOVED,
#     histor, Mock-Policy, mock-policy, verboten, removed_in_phase,
#     removed_at, policy-link
#   - Vendored: *.iml, build/, node_modules/, .git/, *.min.js, *.min.dart
#
# Exit codes:
#   0 = clean (0 violations)
#   1 = violations found
#   2 = script error (rg not found, paths invalid, etc.)
#
# Usage:
#   bash scripts/audit-no-mocks.sh
#
# Exit 1 blockiert CI + Pre-Commit-Hook.
# =============================================================================

set -uo pipefail

# -----------------------------------------------------------------------------
# Configuration (alle Variablen in main scope — kein `local`-Keyword hier)
# -----------------------------------------------------------------------------

# Production code paths (single source of truth — no tests/ no docs/)
SCAN_PATHS=(
    "src/backend/src/services/"
    "src/backend/src/routes/"
    "src/backend/src/middleware/"
    "src/mobile/lib/"
)

# Forbidden identifier patterns
FORBIDDEN_IDENTIFIERS=(
    'fundLocal\b'
    '_computeMockLiveStatus\b'
    'StubNaiveBayesClassifier\b'
    'StubNaiveBayes\b'
)

# Forbidden string-literal patterns
FORBIDDEN_LITERALS=(
    'local://demo'
    'exchange_base_url[[:space:]]*=[[:space:]]*[\x27\x22]local://demo'
)

# Allowed file path patterns (rg --glob syntax, ! = exclude)
ALLOWED_GLOBS=(
    '!scripts/audit-no-mocks.sh'
    '!**/*.iml'
    '!**/build/**'
    '!**/node_modules/**'
    '!**/.git/**'
    '!**/*.min.js'
    '!**/*.min.dart'
    '!**/AGENTS.md'
    '!**/knowledge.md'
    '!**/.claude/CLAUDE.md'
    '!**/.opencode/skills/*.md'
)

# Allowed line-content markers (historical-reference markers — exempt).
# "Mock-Policy" + "Phase R" sind die beiden Haupt-Marker aus dem Phase-R-Refactor;
# "entfernt/removed/REMOVED/histor" sind generische Cleanup-Stempel.
# "policy-link" / "policy:http" sind Future-Proofing fuer direkte
# AGENTS.md-Policy-Link-Referenzen (z.B. in 410-Gone Response-Bodies).
ALLOWED_MARKER_REGEX='(Phase R|Mock-Policy|mock-policy|entfernt|removed|REMOVED|histor|Verboten|verboten|removed_in_phase|removed_at|policy-link|policy:http)'

# Pure-comment regex (Bash/Dart/C/HTML-Comments am Zeilen-Anfang)
COMMENT_REGEX='^[[:space:]]*(#|//|/\*|\*|<!--)'

# -----------------------------------------------------------------------------
# Pre-flight validation
# -----------------------------------------------------------------------------

if ! command -v rg >/dev/null 2>&1; then
    echo "ERROR: ripgrep (rg) is required for audit-no-mocks.sh" >&2
    echo "  Install: apt install ripgrep / brew install ripgrep" >&2
    exit 2
fi

for p in "${SCAN_PATHS[@]}"; do
    if [[ ! -d "$p" ]]; then
        echo "ERROR: scan-path '$p' does not exist. Run from repo root." >&2
        exit 2
    fi
done

# -----------------------------------------------------------------------------
# rg glob-args (assemble once)
# -----------------------------------------------------------------------------

RG_GLOB_ARGS=()
for G in "${ALLOWED_GLOBS[@]}"; do
    RG_GLOB_ARGS+=(--glob "$G")
done

# -----------------------------------------------------------------------------
# Scan single pattern
# -----------------------------------------------------------------------------

# Input: $1 = pattern, $2 = kind-label
# Echoes NUL-delimited: <path>|<line>|<content>
scan_one_pattern() {
    local PATTERN="$1"
    local HITS

    HITS=$(rg --no-heading --line-number --color=never \
        "${RG_GLOB_ARGS[@]}" \
        "$PATTERN" "${SCAN_PATHS[@]}" 2>/dev/null || true)

    if [[ -z "$HITS" ]]; then
        return
    fi

    while IFS= read -r HIT; do
        [[ -z "$HIT" ]] && continue

        # Robust split: file:line:content (content kann Doppelpunkte haben)
        local FILE="${HIT%%:*}"
        local REST="${HIT#*:}"
        local LINE_NUM="${REST%%:*}"
        local CONTENT="${REST#*:}"

        # Skip pure comment lines
        if [[ "$CONTENT" =~ $COMMENT_REGEX ]]; then
            continue
        fi

        # Skip lines with historical-marker keywords
        if [[ "$CONTENT" =~ $ALLOWED_MARKER_REGEX ]]; then
            continue
        fi

        # Emit violation
        printf '%s|%s|%s\n' "$FILE" "$LINE_NUM" "$CONTENT"
    done <<< "$HITS"
}

# -----------------------------------------------------------------------------
# Run scan over all patterns, collect violations
# -----------------------------------------------------------------------------

VIOLATIONS_TXT=""
VIOLATION_COUNT=0
TEMP_VIOLATIONS=$(mktemp)
trap 'rm -f "$TEMP_VIOLATIONS"' EXIT

for PATTERN in "${FORBIDDEN_IDENTIFIERS[@]}"; do
    scan_one_pattern "$PATTERN" >> "$TEMP_VIOLATIONS"
done

for PATTERN in "${FORBIDDEN_LITERALS[@]}"; do
    scan_one_pattern "$PATTERN" >> "$TEMP_VIOLATIONS"
done

VIOLATION_COUNT=$(wc -l < "$TEMP_VIOLATIONS" | tr -d ' ')

# -----------------------------------------------------------------------------
# Output
# -----------------------------------------------------------------------------

if [[ "$VIOLATION_COUNT" == "0" ]]; then
    echo "OK audit-no-mocks.sh: 0 violations -- Mock-Policy konform"
    echo "   User-Regel: AGENTS.md:143 + knowledge.md:283"
    echo "   Scan-Pfade: ${SCAN_PATHS[*]}"
    exit 0
fi

echo "FAIL AUDIT: $VIOLATION_COUNT Mock-Policy-Verletzung(en) gefunden"
echo "======================================================================"

while IFS='|' read -r FILE LINE_NUM CONTENT; do
    echo "  $FILE:$LINE_NUM"
    echo "    -> $CONTENT"
done < "$TEMP_VIOLATIONS"

echo "======================================================================"
echo "User-Regel: AGENTS.md:143 + knowledge.md:283"
echo "  'mock, simulation, fake sind verboten'"
echo ""
echo "Empfohlene Action:"
echo "  1. Wenn historische Referenz: Marker 'entfernt'|'Phase R'|'Mock-Policy' ergaenzen"
echo "  2. Wenn aktiver Mock-Code: Refactor mit echter Datenquelle (Phase R Plan)"
echo "  3. Wenn vertretbar (Test-Stub): in test/*-Datei oder Kommentar."
echo ""
exit 1
