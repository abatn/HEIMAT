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

- Provider-Test für init/cache/refresh-Logik — erfordert SharedPreferences-Mock (erlaubt in Tests). Separater Commit sinnvoll.
- Widget-Tests für AqiRingCard/HourlyAQIStrip/PollutantDetailCard — erfordern Bildschirm-Auflösung in CI. Optional.
- Abfallkalender Backend + Mobile — nächster Service nach Luftqualität. Braucht neues Backend (kommunale Open-Data-Portale).
- AI on-device (Phase 8.4 project-prompt.md) — BayesClassifier on-device. Braucht TFLite-Integration in Build-Prozess.
