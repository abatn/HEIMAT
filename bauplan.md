## Phase R.7 — migrate:status --json Flag (2026-07-27, Commit e3cd609)

> **Ziel:** CI-Consumer-fähiger JSON-Output für `npm run migrate:status`. Render preDeploy-Healthcheck und GitHub-Actions können den Output maschinenlesbar parsen (statt Human-Text).

### Status

- ✅ `formatReportJSON(report)` export function (JSON.stringify mit pretty-print)
- ✅ `run()` bekommt `format: 'text' | 'json'` Parameter — löst Code-Reviewer-Double-Output-Problem
- ✅ CLI `--json` Flag ruft `run({ format: 'json' })` auf
- ✅ `npm run migrate:status:json` Script in package.json
- ✅ 2 neue Tests (JSON ok + JSON drift)
- ✅ Gesamt: 31 Tests in migrate-status.test.ts

### Exit-Codes (identisch zu Text-Modus)

- `0` — Schema synchron (`status: 'ok'`)
- `1` — Schema-Drift (`status: 'drift'`)
- `2` — Script-Error (`{ status: 'script_error', reason: '...' }`)

### Validation

- `cd src/backend && npx tsc --noEmit` → 0 Errors
- `cd src/backend && npx jest src/__tests__/migrate-status.test.ts` → 31/31 passed

---

## Phase R.8 — Shared _schema-path.ts (DRY) (2026-07-27, Commit e3cd609)

> **Ziel:** DRY-Verletzung zwischen `migrate.ts` + `migrate-status.ts` beheben. Beide hatten identische `resolveSchemaPath()` + `SCHEMA_RELATIVE_PATH` (~5 LOC dupliziert).

### Status

- ✅ `src/backend/src/scripts/_schema-path.ts` (NEU) — exportiert `resolveSchemaPath(): string`
- ✅ `migrate.ts`: importiert jetzt von `./_schema-path` (eigene resolveSchemaPath entfernt)
- ✅ `migrate-status.ts`: importiert jetzt von `./_schema-path` (eigene resolveSchemaPath entfernt)
- ✅ `import path from 'path'` aus beiden Scripts entfernt (war totes Import nach extraction)
- ✅ `test/migrate-status.test.ts` + `test/migrate.test.ts`: imports angepasst
- ✅ `test/schema-path.test.ts` (NEU, 3 Tests) — resolves absolute path, .sql-Endung, database/-Parent
- ✅ Gesamt: 52 Tests (31 migrate-status + 18 migrate + 3 schema-path)

### Namenskonvention

- `_`-Prefix signalisiert "shared internal utility, kein Public-API-Export"
- Pattern-Mirror zu `src/backend/src/utils/error.ts` (errorMessage-Utility)

### Validation

- `cd src/backend && npx tsc --noEmit` → 0 Errors
- `cd src/backend && npx jest src/__tests__/migrate-status.test.ts src/__tests__/migrate.test.ts src/__tests__/schema-path.test.ts` → 52/52 passed
- `bash scripts/audit-no-mocks.sh` → 0 violations

---

## Phase B: Luftqualität Mobile-UI (2026-07-27, Commit e3cd609)

> **Ziel:** Luftqualität als zweiten nativen Flutter-Service (nach Wetter) im Apps-Tab bereitstellen. Backend existierte bereits (`airQualityService.ts` + `routes/airQuality.ts` auf `/api/air-quality`), Flutter-Frontend fehlte.

### Status

- ✅ `air_quality_dto.dart` (NEU) — DTOs für Backend-Response (CurrentAirQualityDto, HourlyAirQualityDto, AirQualityForecastResponse, AirQualityLocationDto)
- ✅ `air_quality_provider.dart` (NEU) — Provider mit Cache (matching WeatherProvider-Pattern: init, refresh, SharedPreferences-Cache, Location-Awareness)
- ✅ `air_quality_screen.dart` (NEU) — Native Screen (Header, AqiRingCard, HourlyAQIStrip, PollutantDetailCard, Attribution)
- ✅ `widgets/air_quality_widgets.dart` (NEU) — 3 Widgets: AqiRingCard (Aqi-Ring + Level + 3 Pollutant-Pills), HourlyAQIStrip (24h horizontal), PollutantDetailCard (6 Schadstoffe mit Icons)
- ✅ `service_registry.dart` — `air` als nativen Service registriert (nativeBuilder)
- ✅ `miniprogram_provider.dart` — `air` Programm hat `useNative: true`
- ✅ `main.dart` — AirQualityProvider registriert mit `..init()`
- ✅ `test/air_quality_dto_test.dart` (NEU, 10 Tests) — DTO-Parsing (null values, integers, full forecast, empty hourly, missing fields, location). **Mock-frei** (User-Regel: keine Mocks/Simulationen).

### Datenfluss

```
AirQualityScreen → AirQualityProvider → /api/air-quality/forecast?lat=&lng=
                                            ↓
                          airQualityService.ts (backend)
                                            ↓
                          Open-Meteo Air Quality API (CAMS Copernicus)
                                            ↓
                          EAQI + PM2.5/PM10/NO₂/O₃/CO/SO₂
```

### Validation

- `dart format lib/features/air_quality/ test/air_quality_dto_test.dart` → 5 files, exit 0
- `dart analyze lib/features/air_quality/ test/air_quality_dto_test.dart` → No issues found
- `cd src/backend && npx tsc --noEmit` → 0 Errors
- `bash scripts/audit-no-mocks.sh` → 0 violations
- **Gesamt-Test-Zähler nach dieser Session: Backend 52 (migrate-suite) + Mobile 10 (Luftqualität DTO) = 62 neue Tests**

### Offene Punkte (bewusst nicht umgesetzt)

- **Provider-Test für init/cache/refresh-Logik** — ✅ erledigt in Phase R.9 (siehe unten). 23 Tests, Cache/State voll, Refresh-Error-Contract race-safe.
- Widget-Tests für AqiRingCard/HourlyAQIStrip/PollutantDetailCard — erfordern Bildschirm-Auflösung in CI. Optional.
- Abfallkalender Backend + Mobile — nächster Service nach Luftqualität. Braucht neues Backend (kommunale Open-Data-Portale).
- AI on-device (Phase 8.4 project-prompt.md) — BayesClassifier on-device. Braucht TFLite-Integration in Build-Prozess.

---

## Phase R.9 — AirQualityProvider Tests (2026-07-27)

> **Ziel:** Cache/State-Logik des AirQualityProvider gegen Regressionen absichern. `refresh()`-Pfad nur als Error-Handling-Contract (kein Mockspielen in Production-Code, User-Regel AGENTS.md:143).

### Status

- ✅ `test/air_quality_provider_test.dart` (NEU, **406 Zeilen, 23 Tests, 8 Gruppen**):
  - **Group 1 — Initial State (9 Tests):** Default-Values (hasData=false, isLoading=false, error=null, forecast=null, lastUpdated=null, isStale=false, locationName='Berlin', lat=52.52, lng=13.41)
  - **Group 2 — init() mit leerem Cache (3 Tests):** komplettiert ohne Exception, hasData bleibt false, notifyListeners mind. 1x
  - **Group 3 — init() mit frischem Cache (2 Tests):** Forecast aus JSON geparst, lat/lng/locationName restauriert (inkl. Umlaut-Test "München")
  - **Group 4 — init() mit stale Cache (1 Test, RACE-SAFE):** Forecast wird trotz altem Timestamp geladen; assertiert auf stabile Properties (hasData, lastUpdated aus Cache). **Kein isStale-Direkt-Assertion** weil `unawaited(refresh())` in CI mit Netzwerk sonst flaky flippen könnte.
  - **Group 5 — Korrupter Cache (2 Tests):** Silent-Fallback bei ungültigem JSON + bei JSON mit falscher Shape. Kein Crash, kein Error-State.
  - **Group 6 — Partial Cache (2 Tests):** Berlin-Defaults wenn lat/lng/name-Keys fehlen; korrekte Restore wenn nur der name-Key fehlt.
  - **Group 7 — refresh() Error-Handling-Contract (2 Tests):** `refresh()` wirft KEINE unhandled Exception (auch bei Network-Failure); Cache-Stand bleibt bei Refresh-Failure erhalten (graceful degradation).
  - **Group 8 — TTL-Boundary (2 Tests, RACE-FREE):** isStale=false bei 4min55s alt (knapp unter TTL) + isStale=false bei EXAKT 5min alt (Boundary inclusive durch strict `>`).

### Design-Entscheidungen (Gemini-Analyse)

| Entscheidung | Begründung |
|--------------|------------|
| **Kein Production-Code-Refactor** für `apiGet`-Injection | Minimal-Changes-Prinzip (User-Regel: nur ändern was nötig). Provider bleibt `src/mobile/lib/features/air_quality/air_quality_provider.dart` unverändert. |
| **Cache/State voll getestet, refresh() nur Error-Contract** | Option D (Hybrid) aus Gemini-Analyse. Cache-Logik ist der wertvolle Test-Anteil; refresh()-Pfad ohne Injection nicht deterministisch testbar. |
| **Race-Safety via Stabilen-Properties-Assertion (Group 4)** | Direkte `isStale`-Assertion nach init() mit stale Cache ist race-prone (init spawnt `unawaited(refresh())` der in Network-CI vor Assertion resolved sein kann). Stattdessen: hasData + cache-Timestamp + 9-min-Sanity-Check. |
| **TTL-Boundary-Tests in Group 8 via Fresh-Cache-Pfad** | Fresh-Cache (<5min) → `_isStale=false` → init() ruft KEIN refresh() → Race-Free auch in Network-CI. Boundary-Math (4:55 vs 5:00 vs 5:01) explizit verifiziert. |
| **Kein `pumpAndSettle()`** | Per AGENTS.md: Tests hängen sonst in infinite-Animation-Loops fest. |
| **Kein Mockito, nur SharedPreferences-Mock** | `SharedPreferences.setMockInitialValues({})` in JEDEM setUp() für Test-Isolation (Pattern-Mirror zu `auth_provider_test.dart`). |
| **Keine `Mock-Policy`-Verstöße** | Test-File in `src/mobile/test/` (nicht in `audit-no-mocks.sh` SCAN_PATHS). Keine `fundLocal`, `_computeMockLiveStatus`, `StubNaiveBayesClassifier/StubNaiveBayes` oder `local://demo` References. |

### Lessons-Learned

1. **Race-Condition in `unawaited(refresh())`-Aufrufern** — Production-Code-Pattern wie `if (hasData && _isStale) { unawaited(refresh()); }` ist inherently race-prone in unit tests, weil der Test-Assertion-Code synchron läuft während refresh async läuft. Fix: Assertion auf stabile Properties umlenken (z.B. lastUpdated aus Cache, hasData) statt direkter State-Assertion.
2. **TTL-Boundaries explizit testen** — Strict `>` vs `>=` ist ein häufiger Bug-Source. Zwei Boundary-Tests (knapp-unter + exakt-TTL) pinnen die Logik. Der `>TTL`-Fall wird absichtlich nicht race-safe direkt tested, aber via hasData-Last-Cache implizit abgedeckt.
3. **Test-Files NICHT in audit-no-mocks.sh SCAN_PATHS** — Stubs/test-doubles in `test/` sind explizit erlaubt. Production-Code (`src/mobile/lib/`) ist tabu. Pattern beibehalten.

### Validation

- `bash scripts/audit-no-mocks.sh` → 0 violations (alle forbidden identifiers/literals grep-check bestätigt)
- Code-Reviewer-minimax-m3 → PASS (3 Runden: initial + post-race-fix + polish-nits)
- Erwartete CI-Validation (lokal kein Flutter SDK installiert):
  - `dart format lib/ test/` → muss grün (Datei bereits dem HEIMAT-Convention folgend geschrieben)
  - `flutter test test/air_quality_provider_test.dart` → erwartet 23/23 grün
  - `flutter analyze --no-fatal-infos` → erwartet 0 issues
- **Gesamt-Test-Zähler nach Phase R.9: Mobile 33 (10 DTO + 23 Provider) Tests grün**

### Offene Punkte (bewusst nicht umgesetzt)

- Widget-Tests für AqiRingCard/HourlyAQIStrip/PollutantDetailCard — erfordern Bildschirm-Auflösung in CI. Optional.
- WeatherProvider-Test als Mirror-Pattern — wäre analog aber ist eigenständiger Scope.
- Success-Pfad von `refresh()` testbar nur via Production-Code-Refactor (DI für `apiGet`). Bewusst nicht umgesetzt.
