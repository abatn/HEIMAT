# HANDOFF-PROMPT: Dependabot Major-Version-Bumps

> **⚠️ SUPERSEDED by Phase 22 (2026-07-23):** Alle 5 🟢-🟡 Backend-Bumps + eslint+typescript-eslint+express erledigt via `bauplan.md:Phase 22`. Flutter-Bumps (flutter_map ^7, flutter_lints ^5) versionstechnisch maxed out. Nur noch TypeScript 7 (blocked) und mobility.test.ts (Infra) offen.

## Aktueller Stand

**5 von 17 PRs manuell erledigt** (GitHub Actions). Commit: `180ebf1`.

### ✅ Erledigt (geschlossen)
- actions/checkout v4 → v7
- actions/setup-node v4 → v6
- actions/upload-artifact v4 → v7
- actions/setup-java v4 → v5
- actions/deploy-pages v4 → v5

### 🔲 Offen (12 PRs)

| Priorität | PR | Package | Von → Nach | Aufwand |
|-----------|-----|---------|------------|---------|
| 🟢 Niedrig | #33 | bcryptjs | 2.x → 3.x | gering |
| 🟢 Niedrig | #32 | supertest | 6.x → 7.x | gering |
| 🟡 Mittel | #40 | helmet | 7.x → 8.x | mittel |
| 🟡 Mittel | #39 | express-rate-limit | 7.x → 8.x | mittel |
| 🟡 Mittel | #35 | yauzl | 2.x → 3.x | mittel |
| 🟡 Mittel | #36 | @types/node | 20.x → 26.x | gering |
| 🔴 Hoch | #34 | express | 4.x → 5.x | hoch |
| 🔴 Hoch | #38 | @typescript-eslint/eslint-plugin | 6.x → 8.x | hoch |
| 🔴 Hoch | #37 | @typescript-eslint/parser | 6.x → 8.x | hoch |
| 🔴 Hoch | #19 | eslint | 8.x → 10.x | hoch |
| 🔴 Hoch | #42 | flutter_map | 6.x → 8.x | hoch |
| 🔴 Hoch | #41 | flutter_lints | 3.x → 6.x | mittel |

## Strategie

### Schritt 1: Niedrige Priorität (bcryptjs, supertest)
```bash
cd src/backend && npm install bcryptjs@3 @types/bcryptjs@3 supertest@7 @types/supertest@7
npm test && npx tsc --noEmit
gh pr merge 33 --squash && gh pr merge 32 --squash
```

### Schritt 2: Mittlere Priorität (helmet, express-rate-limit, yauzl, @types/node)
```bash
cd src/backend && npm install helmet@8 express-rate-limit@8 yauzl@3 @types/node@26
# Code anpassen wo nötig (helmet API, etc.)
npm run lint && npm test && npx tsc --noEmit
gh pr merge 40 --squash && gh pr merge 39 --squash && gh pr merge 35 --squash && gh pr merge 36 --squash
```

### Schritt 3: Express 5 (größter Aufwand)
```bash
cd src/backend && npm install express@5 @types/express@5
# Breaking Changes:
# - req.query ist jetzt unknown (nicht mehr ParsedQs)
# - path-to-regexp API geändert
# - req.params Typen geändert
# Alle Routes prüfen und anpassen
npm run lint && npm test && npx tsc --noEmit
gh pr merge 34 --squash
```

### Schritt 4: ESLint 10 (Config-Migration)
```bash
cd src/backend && npm install eslint@10 @typescript-eslint/eslint-plugin@8 @typescript-eslint/parser@8
# .eslintrc.json → eslint.config.js migrieren (Flat Config)
# Alle Rules prüfen
npm run lint
gh pr merge 19 --squash && gh pr merge 38 --squash && gh pr merge 37 --squash
```

### Schritt 5: Flutter (flutter_map, flutter_lints)
```bash
cd src/mobile
# pubspec.yaml manuell updaten:
#   flutter_map: ^8.3.1
#   flutter_lints: ^6.0.0
./flutter/bin/flutter pub upgrade
# API-Änderungen in mobility_screen.dart prüfen
./flutter/bin/flutter analyze --no-fatal-infos
./flutter/bin/flutter test
./flutter/bin/dart format lib/ test/
gh pr merge 42 --squash && gh pr merge 41 --squash
```

## Befehle

```bash
# Status prüfen
gh pr list --label dependencies --state open

# PR Details
gh pr diff <PR-NUMBER>
gh pr view <PR-NUMBER>

# PR mergen
gh pr merge <PR-NUMBER> --squash --delete-branch

# CI prüfen
gh run list --limit 5
gh run view <RUN-ID> --log-failed

# Bei Failure
cd src/backend && npm run lint && npm test && npx tsc --noEmit
cd src/mobile && ./flutter/bin/flutter analyze --no-fatal-infos && ./flutter/bin/flutter test
```

## Dateien die geändert werden müssen

- `src/backend/package.json` (alle Backend-PRs)
- `src/backend/package-lock.json`
- `src/backend/src/index.ts` (helmet, express)
- `src/backend/.eslintrc.json` → `eslint.config.js` (bei eslint 10.x)
- `src/mobile/pubspec.yaml` (flutter PRs)
- `src/mobile/lib/features/mobility/presentation/mobility_screen.dart` (flutter_map)
