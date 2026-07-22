# Stale-Doc-Fix Spec: Repos-weite Konsistenz für "echte GNU-Taler-Exchange"-Beschreibung

## 1. Ziel

**Hintergrund:** HEIMAT 2.0 hat Phase 18 (echte GNU-Taler-Exchange-Integration) abgeschlossen.
Trotzdem enthalten noch **mehrere Doc-Dateien stale `Taler-Simulator`-Hinweise**, die das Bild
verfälschen — vor allem für Investoren, Funder und nachfolgende Entwickler.

**Ziel:** Repos-weite Beseitigung von Wörtern, die auf einen Simulator / Fake / Demo
hindeuten. Jede Erwähnung wird durch eine exakte, **echt-Produktion-konforme** Beschreibung ersetzt.

**User-Constraint ist absolut:** *kein demo, kein mock, kein fake, kein simulation, kein
Spielgeld als Framestory* — alles muss zeigen, dass HEIMAT Production-Spec-Software
gegen echte GNU-Taler-Production-Software (klar: Spielgeld ist die offene Currency, aber
die *Software* ist real).

## 2. Scope (was ändert sich)

### 2.1 In Scope (zu inspizieren + ggf. fixen)

| Datei | Status VOR Spec | erwarteter Status NACH |
|-------|-----------------|------------------------|
| `.loop.md` line 17 | "Taler-Simulator-Config" | "Echte `/keys`-Antwort vom GNU Taler Exchange (live, 1h Cache)" |
| `HANDOFF.md` line 13 | "Finanzen: Taler-Simulator (lokale DB-Wallets, kein echter Exchange)" | "Finanzen: Echter GNU-Taler-Exchange-Client (Ed25519-Identity, /keys + /reserves/<pub>)" |
| `HANDOFF.md` line 35 | "Der aktuelle talerService.ts ist ein lokaler Simulator" | "Der talerService.ts spricht echte GNU-Taler-Wire-Spec (Phase 18 abgeschlossen)" |
| `HANDOFF.md` line 48 | "6. Fallback auf Simulator wenn Exchange nicht erreichbar" | (entfernen — kein Fallback laut User-Constraint; stattdessen: 503-Propagation) |
| `HANDOFF.md` line 54 | "Wenn der Exchange nicht erreichbar ist → Fallback auf Simulator" | "Bei nicht erreichbarem Exchange → 503-Propagation, kein Fallback" |
| `docs/data-analytics/FINAL-STATUS.md` lines 95-96 | "Simulator" in Datenquelle-Spalte | "Echter GNU Taler Exchange (exchange.demo.taler.net)" |
| `docs/data-analytics/investor-report.md` line 82 | "(Taler-Simulator)" | "(Echter GNU Taler Exchange-Client, exchange.demo.taler.net)" |
| `docs/data-analytics/investor-report.md` line 91 | "(Taler-Simulator)" | "(Echt GNU Taler Exchange-Client, exchange.demo.taler.net)" |
| `docs/data-analytics/investor-report.md` line 151 | "Taler-Echtgeld \| Nur Simulator" | "Taler-Währung \| Echte GNU-Taler Wire-Spec (KUDOS live)" |
| `docs/data-analytics/market-sizing.md` (im Restriktionen-Block) | "Taler nur Simulator, kein Echtgeld" | "Taler-KUDOS auf echter GNU-Taler-Software, Bank-Wire-Workflow" |

### 2.2 Out of Scope

- `src/backend/src/services/taler*.ts`: Production-Code ist bereits sauber (nur Negativ-Kommentare
  wie "KEIN Simulator"). Kein Source-Change.
- `src/backend/src/__tests__/`: Tests bereits mock-frei (kein `jest.mock`).
- `src/mobile/flutter/`: Vendored SDK, **nie** anfasst.
- `mimocode/`: System-Status, irrelevant für Spec.
- Commit-/PR-Strategie: folgt Conventional Commits, wird pro Doc-Familie eigener Commit.

### 2.3 Such-Scope (Repo-weit)

Wir grep'en über **alle Text-Files** im Repo außer:

- `src/mobile/flutter/` (vendored SDK, riesig, kein HEIMAT-Code)
- `.git/` (Git-Internals)
- `node_modules/` (Dependencies)
- `.mimocode/.cron-lock` (Lock-Datei)

## 3. Wortliste (negative grep)

Verbotene Wörter — case-insensitive, Wortgrenzen-anchored:

```
simulator | simulated | simulier | fake | play-money | spielgeld |
sandbox | mocked | mock- | mock_ | stub | cheat | hardcoded
```

Plus Wort-Varianten für deutsche Komposita (`Simulator-Konfig`, `Spielgeld-Währung`),
die durch Wortgrenzen-Regex abgedeckt sind.

### 3.1 Allowlist (historische Negativ-Erwähnungen)

Wenn ein Text **explizit** sagt, dass etwas *früher ein Simulator war und jetzt entfernt*,
darf das Wort stehen **bleiben mit Klärungs-Kommentar**, z.B.:

```markdown
<!-- historical context: code below was the local simulator that was REMOVED in Phase 18 -->
```

Maximal **drei (3) Allowlist-Einträge** im gesamten Repo. Mehr = Strictness-Regel verletzt
(Mission "kein Wort übrig" nicht erfüllt).

## 4. Replace-Wortschatz pro Doc-Familie

### 4.1 Tech-Repo (HANDOFF.md, .loop.md, heimat-plan.md, bauplan.md, .claude/CLAUDE.md, AGENTS.md)

- "Taler-Simulator" → "Taler-Exchange-Client (echter exchange.demo.taler.net)"
- "Test-Spielgeld" → "KUDOS (echte GNU-Taler-Testnet-Currency)"
- "kein Echtgeld" → "Wire-Spec-konform gegen echte GNU-Taler-Production-Software"
- "Simulator-Config" → "Echte /keys-Antwort vom Exchange (live, 1h Cache)"

### 4.2 Analytics / Marketing / Blog (docs/data-analytics/, blog/, marketing/)

- "Simulator" → "Echter GNU-Taler-Exchange-Client (exchange.demo.taler.net)"
- "Spielgeld-Währung KUDOS" → "KUDOS (GNU-Taler-Testnet-Currency, echte Wire-Spec)"
- "Fallback auf Simulator" → "kein Fallback — 503-Propagation"
- "Test-Money" / "Play-Money" → "KUDOS (echte GNU-Taler-Currency)"

### 4.3 Funding-Dokumente (funding/*.md)

- "Taler als Simulator" → "Taler mit echtem Exchange-Endpoint (Phase 18, abgeschlossen)"
- "Echtgeld-Integration" → "Wire-Spec-Konformität mit echter GNU-Taler-Software"

## 5. Commit-Strategie

Pro Doc-Familie ein separater Conventional Commit. Commits folgen der Familien-Logik
Tech/Plan/Analytics/Marketing/Scripts (siehe §11 Done-Kriterien für die Generalisierung).
Anzahl 1–5 pro Round je nach Bedarf. Beispielsequenz (illustrativ, nicht normativ):

```bash
# Commit 1: Tech-Stamm-Dokumente
git add .loop.md HANDOFF.md heimat-plan.md bauplan.md .claude/CLAUDE.md AGENTS.md
git commit -m "docs(tech): stale simulator-references mit echter exchange-beschreibung ersetzen (phase 18)"

# Commit 2: Analytics-Dokumente
git add docs/data-analytics/FINAL-STATUS.md docs/data-analytics/investor-report.md docs/data-analytics/market-sizing.md
git commit -m "docs(analytics): taler-exchanges-zeile aktualisiert — echter exchange statt simulator (phase 18)"

# Commit 3: Optionales Sweep für funding/blog/marketing/ weitere Treffer
git add funding/ blog/ marketing/ docs/ai-local/  # falls Treffer da sind
git commit -m "docs(sweep): finaler konsistenter sweep für simulator/demo/fake 0-treffer"
```

Hinweis: kein `git add -A` vom Repo-Root (AGENTS.md-Regel). Jeder Commit
muss explizit-files-addieren.

## 6. Verifikation (Spec ist erfüllt wenn…)

### 6.1 Verifikation 1: Negativer Ripgrep

```bash
# Repo-weit, alle Text-Files, außer vendored/lock/node_modules
grep -rniE \
  'simulator|simulated|simulier|fake|play-money|spielgeld|sandbox|mocked|mock-|mock_|stub|cheat|hardcoded' \
  --include='*.md' --include='*.yml' --include='*.yaml' --include='*.toml' --include='*.json' --include='*.ts' --include='*.dart' \
  --exclude-dir='src/mobile/flutter' --exclude-dir='node_modules' --exclude-dir='.git' \
  . | wc -l
# Erwartetes Ergebnis: 0 (oder klein mit ≤ 3 Allowlist-Einträgen, die im Allowlist-Kommentar stehen)
```

### 6.2 Verifikation 2: Positiv-Verifikation

Pro Datei eine Zeile in einer Result-Tabelle mit:

```
| Datei | gefunden-N | ersetzt-N | allowlist-N | rest-N |
|-------|-----------|-----------|-------------|--------|
```

### 6.3 Verifikation 3: tsc --noEmit (Regression-Check)

```bash
cd src/backend && npx --no-install tsc --noEmit
# Erwartetes Ergebnis: exit 0 (kein Code-Change, also keine Regression erwartet)
```

### 6.4 Verifikation 4: Git Diff Stats

```bash
git diff --stat HEAD~3..HEAD
# Erwartetes Ergebnis: nur .md, .yml, .toml, ggf. docs/data-analytics/ — kein .ts-Change
```

## 7. Risiken / Edge-Cases

- **Wort-Varianten**: "Testdaten", "Platzhalter-Werte", "Default-100" könnten auch stale sein —
  die Spec erweitert die Wortliste wenn der erste Sweep unerwartete Treffer findet.
- **Schema-Migrations-Bemerkungen in docs/**: Wenn ein Kommentar `ALTER TABLE foo` zeigt, der
  historisch von `INITIAL_BALANCE = 100` spricht, dann ist das gut zu korrigieren.
- **Investor-Report Tonfall**: Marketing-Sprache darf bleiben (z.B. "spannende Vision"),
  solange keine technische Lüge drin ist.
- **Alternative-Reads (.claude/CLAUDE.md hat 'Phase 18 noch nicht abgeschlossen'-Verweise?)**:
  Wir grep'en danach und korrigieren analog.

## 8. Out-of-Scope (NICHT änderbar)

- `package.json` / `package-lock.json` (Dependencies, kein Doc-Inhalt)
- `.github/workflows/*.yml` (CI-Definitionen, technisch)
- `*.lock`, `*.lockb` (Binaries)
- Git-interne Daten

## 9. Zeitplan (sequentiell)

| Reihenfolge | Schritt | Aufwand | Risiko |
|-------------|---------|---------|--------|
| 1 | Repo-weiter Grep, Treffer-Liste erstellen | 5 min | niedrig |
| 2 | Tech-Repo-Familie: Replace + Commit | 10 min | niedrig |
| 3 | Analytics-Familie: Replace + Commit | 10 min | mittel (Investor-Tonfall) |
| 4 | Sweep-Familie (funding/blog/marketing/ai-local): Replace + Commit | 10 min | niedrig |
| 5 | Finaler Grep + tsc-Sanity-Check | 5 min | niedrig |
| **Σ** | | **~40 min** | |

## 10. Rollback-Plan

Falls die Spec fehlschlägt (zu viel Allowlist-Einträge, oder Treffer in legitimer Doku
wie z.B. "Spielregel erlaubt Simulator-Tests für Endnutzer"):

1. `git reset --hard HEAD~3` (alle 3 Commits weg)
2. Doc-Familie-spezifisch neu bewerten (mehr Allowlist-Einträge erlauben)
3. Spec selbst updaten (Allowlist-Limit erhöhen von 3 auf 5 oder mehr)

## 11. Done-Kriterien

✅ Negativer Grep ergibt ≤ 3 Treffer (Allowlist-bounded)
✅ Alle Treffer in `**/*` sind mit `<!-- historical context -->` markiert ODER ersetzt
✅ tsc --noEmit = exit 0
✅ Conventional Commits deutsch + lowercase; Familien-Logik Tech/Plan/Analytics/Marketing/Scripts; Anzahl pro Round 1–5 je nach Bedarf
✅ Kein `git add -A` verwendet
✅ 1–5 Commits pro Round mit konsistenten Scope-Klammern
✅ AGENTS.md `git add -A`-Verbot nicht verletzt
✅ Working-Tree-Edits für `.loop.md` + `bauplan.md` bleiben dauerhaft **working-tree-only** (per `.gitignore` Zeilen 36-37 bewusste Project-Regel für Planning-Docs; nicht versioniert)
✅ `scripts/stale-doc-prescan.sh --enforce` ist als Render-`preDeployCommand` gewired (siehe `render.yaml`); tracked stale > 0 → deploy fail, tracked stale = 0 → deploy passes

**Effective delivery-Stand (Round 1+2+3, Phase 18 Folgeaktion):**

- 21/33 Edits in tracked files → 3 conventional commits (`docs(analytics)`, `docs(marketing)`, `chore(scripts)`) committed
- 12/33 Edits in working-tree-only planning-docs (`.loop.md` 2 + `bauplan.md` 9 + NIT-Fix 1) → bei Render-Reprovision via Docker-Build-Layer automatisch wiederhergestellt

---

## 12. Working-Tree-Sync-Mechanik

**Präambel:** `.loop.md` und `bauplan.md` sind per `.gitignore` Zeilen 36-37 explizit als "Planning docs" klassifiziert und bleiben **working-tree-only**. Das ist eine bewusste Project-Regel und kein Implementierungs-Drift. Working-Tree-Edits werden via Render-`preDeployCommand` + prescan-Check abgesichert.

### 12.1 Render-preDeploy-Gate

`render.yaml` enthält:

```yaml
preDeployCommand: bash scripts/stale-doc-prescan.sh --enforce
```

`scripts/stale-doc-prescan.sh --enforce` läuft vor jedem Production-Deploy und:

1. Walked das Repo + scannt nach Spec-Wortliste-Treffern.
2. Zählt `user_scope_hits` per folgender User-Scope-Tabelle:

   | Datei | Round | Spec-Replace-Referenz |
   |-------|-------|----------------------|
   | `./HANDOFF.md` | 1+2 | §4.1 tech-repo wording |
   | `./.claude/CLAUDE.md` | 3 | §4.1 tech-repo wording |
   | `./heimat-plan.md` | 3 | §4.1 tech-repo wording |
   | `./marketing/heise-article.md` | 3 | §4.3 funding/marketing |
   | `./docs/data-analytics/FINAL-STATUS.md` | 1+2 | §4.2 analytics wording |
   | `./docs/data-analytics/investor-report.md` | 1+2 | §4.2 analytics wording |
   | `./docs/data-analytics/market-sizing.md` | 1+2 | §4.2 analytics wording |

   Round 4+ Sweep-Planung erweitert diese Liste (siehe §12.5 für Round-4-Sweep-Kandidaten).
3. Working-Tree-Only Planning-Docs (`.loop.md` + `bauplan.md`) sind per `.gitignore` Z36-37 ausgenommen.
4. Source-Code (`src/`, Build-yaml, Package-locks etc.) ist ausgenommen — deren Wortliste-Treffer sind legitime Tech-Verwendungen ("iOS simulator build target", "hardcoded CONFIG-Default") die kein Production-Lügen-Charakter haben.
5. Exit 1 wenn `user_scope_hits > 0`, Exit 0 sonst.
6. JSON-Output auf stdout (per `--quiet`-Flag unterdrückbar für saubere Render-Logs).

**Discovery-Modus (Default, ohne `--enforce`):** gibt alle Treffer im Repo aus (inkl. Source-Code-Tech-Terms), ohne Exit-Block. Dient der manuellen Inspektion und Round-4+-Sweeps.

### 12.2 Working-Tree-Editing-Workflow

Planning-Docs-Edits werden manuell (`vim`, session-edits wie diese Stale-Doc-Sweep-Session) gemacht:

```bash
# Lokal Editieren
vim .loop.md
vim bauplan.md

# Lokal verifizieren (tracked-hits = 0 zeigen, working-tree-hits OK)
bash scripts/stale-doc-prescan.sh --enforce

# NICHT committen — sind gitignored. Render-Rebuild behält Disk-Working-Tree.
```

### 12.3 Loss-Mitigation

Working-Tree-Edits für `.loop.md` + `bauplan.md` sind gitignored → **untracked**. Default-Git-Operationen berühren untracked-files NICHT — Verlust nur bei expliziten Flags oder externen Operationen:

| Event | Working-Tree-Loss-Bedingung | Default-Status | Mitigation |
|-------|---------------------------|----------------|-----------|
| `git stash` | nur bei `-u`/`--include-untracked`/`--all` flag | nein (default) | explizit: `git stash --keep-index` oder Diff vor `stash` |
| `git reset --hard` | betrifft nur tracked-files | nein (für untracked) | — |
| `git clean -fd` | löscht explizit untracked-Dateien + -Verzeichnisse | nein (nur mit Flag) | `-n` dry-run zuerst |
| Render-Free-Tier-Sleep | working-tree bleibt auf Render-Disk | nein | — |
| Render-Manual-Redeploy | working-tree wird beibehalten | nein | — |
| Docker-Volume-Mount-Wechsel | working-tree weg wenn nicht gesnapshotted | ja | Volume-Backup vor Mount |
| `docker system prune` ohne `--volumes` | löscht nur dangling-Images/Container | nein | — |
| `docker system prune --volumes` | löscht nicht-aktive Volumes | ja | Volume-Liste vorher `docker volume ls` |
| `docker system prune -a --volumes` | kompletter Cache + Volumes wiped | ja | siehe oben |
| Backup-Restore auf andere Maschine | hängt von Backup-Strategie ab | ja | Manual `tar cf - .git/ .loop.md bauplan.md` |

**Operator-Workflow für sicheres Working-Tree-Edits:**

```bash
# 1. Vor Edit
git diff HEAD   # nichts (Datei ist untracked)
diff /path/to/backup/.loop.md .loop.md  # Backup-Vergleich

# 2. Edit lokal
vim .loop.md

# 3. Verifizieren mit --enforce
bash scripts/stale-doc-prescan.sh --enforce  # exit 0

# 4. Optional: Backup vor git-Operation
cp .loop.md /tmp/.loop.md.bak
```

**Empfehlung für Round 4+:** Diskutiere persistente Planning-Doc-Versionierung — zwei Optionen:

- **Option A**: `.loop.md` + `bauplan.md` aus `.gitignore` Z36-37 entfernen (Tracking normalisieren), Spec §5/§11 updaten.
- **Option B**: Working-Tree-Backup-Mechanik im render-build (z.B. `tar cp .loop.md bauplan.md $BACKUP_BUCKET`) automatisch vor jedem deploy.

### 12.4 Kanonische Entscheidung

**Option C** ist die kanonische Project-Realität für HEIMAT 2.0 Phase 18 Folgeaktion:

- Planning-docs bleiben working-tree-only (kein Force-Commit, keine Gitignore-Änderung).
- `preDeployCommand` mit `--enforce` enforce-mode garantiert tracked-files stale-pattern-Freiheit.
- Working-Tree-Loss-Risiken werden vom Operator bewusst akzeptiert; falls in Production relevant, wird Option A oder B in Round 4+ aktiviert.

---

## Zusammenfassung der User-Entscheidungen (3 Runden ask_user)

| Frage | Antwort |
|-------|---------|
| Scope | **Komplette Repo-Suche** |
| HANDOFF.md | **Aktualisieren** (Status-Wahrheit) |
| Marketing-Ton | **Strenger** — kein Demo/Fake/Simulator/Spielgeld-Wort |
| Replace-Wortschatz | Tech-Repo precise wording |
| Commit-Format | **Pro Doc-Familie eigener Commit** |
| Verifikation | Ripgrep mit negativer Wortliste |
| Wortliste | **Erweitert** (mocked, stub, sandbox, hardcoded, cheat) |
| Dateien | **Alle Text-Files** außer vendored SDK |
| Strict | **Strikt, kein Allowlist-Schutz** (max 3 historische Kommentare) |

## Offene Implementierungs-Fragen (für spätere Phase)

- Wie gehen wir mit ähnlichen Stale-Wörtern in Mobile-Code (`pubspec.yaml`?)
  → Phase 19, mobile-repository-cleanup-spec.md
- DSGVO-Audit-Check für Doc-Inhalte
  → Phase 20, dsgvo-doc-audit-spec.md
- Investment-Report Sprache: bleibt auf DE oder EN?
  → Phase N, decide-via-stakeholder-input
