#!/usr/bin/env bash
# =============================================================================
# install-audit-hook.sh — Install pre-commit hook for Mock-Policy enforcement
# =============================================================================
# Creates a symlink .git/hooks/pre-commit → scripts/audit-no-mocks.sh
# Effect: every git commit run is preceded by the audit; violations block the
#         commit locally before it can reach CI.
#
# Usage:
#   bash scripts/install-audit-hook.sh
#
# Idempotent: re-running just updates the symlink. Safe.
# =============================================================================

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo '.')"
HOOKS_DIR="$REPO_ROOT/.git/hooks"
AUDIT_SCRIPT="$REPO_ROOT/scripts/audit-no-mocks.sh"
PRE_COMMIT_HOOK="$HOOKS_DIR/pre-commit"

if [[ ! -x "$AUDIT_SCRIPT" ]]; then
    echo "ERROR: audit script not found or not executable: $AUDIT_SCRIPT" >&2
    echo "  Run: chmod +x scripts/audit-no-mocks.sh" >&2
    exit 1
fi

if [[ ! -d "$HOOKS_DIR" ]]; then
    echo "ERROR: $HOOKS_DIR not found. Run from a git repo root." >&2
    exit 1
fi

# Create or update symlink
ln -sf "$(realpath "$AUDIT_SCRIPT")" "$PRE_COMMIT_HOOK"

chmod +x "$PRE_COMMIT_HOOK"

echo "✅ Installed pre-commit hook → $PRE_COMMIT_HOOK"
echo "   Now every 'git commit' will run scripts/audit-no-mocks.sh first."
echo "   Violations (exit 1) block the commit."
echo ""
echo "Bypass for emergencies: git commit --no-verify"
echo "Uninstall: rm $PRE_COMMIT_HOOK"
