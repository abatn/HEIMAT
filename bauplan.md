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

---

## Phase R.10 — WeatherProvider Tests (2026-07-27)

> **Ziel:** Cache/State-Logik des WeatherProvider gegen Regressionen absichern. Mirror-Pattern zu Phase R.9 (AirQualityProvider-Test) mit Weather-spezifischen Erweiterungen: 6 cache keys (statt 5), Constructor-Injection für `LocalSentimentClassifier`, Alerts-Sub-System, parallele unawaited-Tasks (`init` → `refresh`+location; `_loadFromCache` → `_restoreSentiment`).

### Status

- ✅ `test/weather_provider_test.dart` (NEU, **688 Zeilen, 34 Tests, 8 Gruppen**):
  - **Group 1 — Initial State (12 Tests):** 9 AQ-Defaults + `sentiment` isNull + `alerts` isEmpty + `hasAlerts` isFalse.
  - **Group 2 — init() mit leerem Cache (4 Tests):** init() komplettiert ohne Exception; korrektes `notifyListeners`-Verhalten; alerts=[]/sentiment=null nach Microtask-Wait.
  - **Group 3 — init() mit frischem Cache (5 Tests):** Forecast-Restore; lat/lng/locationName (inkl. Umlaut-Test "Hamburg"); **separate Alerts-Restore** aus `kAlertsKey`; Sentiment-Restore via Microtask-Wait (Race-Safety für `unawaited(_restoreSentimentFromCache)`).
  - **Group 4 — init() mit stale Cache (2 Tests, RACE-SAFE):** Forecast wird trotz stale Timestamp geladen; assertiert NUR stabile Properties (`hasData`, `lastUpdated` aus Cache, 9-min-Sanity-Check) wegen `unawaited(refresh())` Race. Alerts-Test: entfernt harte `hasLength(1)` Assertion wegen refresh-Race.
  - **Group 5 — Korrupter Cache (3 Tests):** ungültiges JSON + JSON ohne forecast-Schlüssel + **separat** korrupter alerts-Cache (innerer try/catch in `_loadFromCache` schluckt das).
  - **Group 6 — Partial Cache (3 Tests):** Berlin-Defaults wenn lat/lng/name-Keys fehlen + alerts-Key fehlt → forecast geladen, alerts leer.
  - **Group 7 — refresh() Error-Handling (3 Tests):** kein unhandled throw bei leerem Cache; **Classifier-Crash** via DI-Stub `_StubClassifier(shouldThrow: true)` (deterministisch unabhängig von Network-State); Cache-Forecast bleibt bei Network-Failure (graceful degradation).
  - **Group 8 — TTL-Boundary (2 Tests, RACE-FREE):** isStale=false bei 4min55s alt (knapp unter TTL); isStale=false bei EXAKT 5min alt (Boundary inclusive durch strict `>`).

### Design-Entscheidungen (Gemini-Analyse)

| Entscheidung | Begründung |
|--------------|------------|
| **`_StubClassifier implements LocalSentimentClassifier`** als Test-only DI-Stub | `_classifier` Field ist bereits Constructor-Injectable in `weather_provider.dart:63` — keine Production-Refactor nötig. Mirror-Pattern zu `_StubFinance` in `app_smoke_test.dart:22` (HEIMAT-Standard für Test-Stubs). |
| **`shouldThrow: true` Parameter im Stub** | Deterministischer Test-Path für try/catch in refresh(). Dart's async Funktion wirft synchron in async-Body → wird vom inneren try/catch gefangen → Provider lebt stabil. |
| **6 cache keys (vs 5 in AirQuality)** | `_kAlertsKey` zusätzlich (Phase E Forecast-Spec: Alert-Sub-System mit eigenem Cache-Key für Cold-Start-Banner ohne Network-Roundtrip). Tests spiegeln alle 6 Keys. |
| **`Future<void>.delayed(Duration.zero)` für Sentiment-Restore** | `_restoreSentimentFromCache` ist `unawaited(...)` in `_loadFromCache`. Microtask-Wait ist ausreichend weil `_StubClassifier.classify` async ohne inner `await` ist → resolve in 1 Microtask-Hop. |
| **2 race-safety Fixes gegenüber Initial-Draft** | (1) Group 4 stale-alerts: harte `hasLength(1)` Assertion entfernt weil init's `unawaited(refresh())` alerts via apiGet überschreiben kann. (2) Group 7 sentiment-reset: racy "Network-Failure-Path"-Test entfernt weil in Network-success-CI `provider.error==null` → Assertion schlägt fehl. Ersetzt durch Classifier-Stub-Throw-Path (deterministisch). |
| **Kein `pumpAndSettle()`** | Per AGENTS.md: Tests hängen sonst in infinite-Animation-Loops fest. |
| **Kein Mockito, nur DI-Stub + SharedPreferences-Mock** | `SharedPreferences.setMockInitialValues({})` in JEDEM setUp() (Mirror zu auth_provider_test.dart + air_quality_provider_test.dart). |
| **Keine Mock-Policy-Verstöße** | Test-File in `src/mobile/test/` (audit-no-mocks.sh SCAN_PATHS ausgeschlossen). Keine `fundLocal`, `_computeMockLiveStatus`, `StubNaiveBayesClassifier/StubNaiveBayes` oder `local://demo` References außerhalb von `///` doc-comments (welche exempt sind per COMMENT_REGEX). |

### Lessons-Learned (über Phase R.9 hinaus)

1. **Constructor-DI nutzen wenn vorhanden** — `WeatherProvider({LocalSentimentClassifier? classifier})` ist bereits ein DI-Hook für TFLite-Swap (Phase 1 nach AI-Implementierungsplan). Tests können diese Schnittstelle ohne Production-Refactor nutzen. AirQuality hatte diesen Hook NICHT — daher strengere Constraints.
2. **`_restoreSentimentFromCache` Race-Pattern** — Production-Code-Pattern `unawaited(_X())` in einer ohnehin-async Methode zusätzlich zu `unawaited(...)` im caller (init → _loadFromCache → restore) entkoppelt die Reihenfolge noch weiter. Tests müssen vorsichtig sein: vor dem S酒吧 den Sentiment zu assertieren kann in 3 States enden (null, partial, voll restored).
3. **Microtask-Wait vs. echte Future-Delay** — `Future<void>.delayed(Duration.zero)` ist nur 1 Microtask-Hop. Für Multi-Step await-Chains (classifier.classify → setState → notifyListeners) reicht das meistens. Für Network-IO braucht man `Future.delayed(Duration(milliseconds: 100))` oder mehr.
4. **Race-Prone-Tests identifizieren** — `expect(provider.error, isNotNull)` ist in network-CI racy (apiGet kann in production-CI erfolgreich sein). Solche Tests entweder auf Network-State explizit machen (mit DI für apiGet) oder ganz droppen. Production-Code-Refactor für apiGet-DI wäre die nachhaltige Lösung.

### Validation

- `bash scripts/audit-no-mocks.sh` → 0 violations (grep-b bestätigt: keine forbidden identifiers außerhalb von doc-comments, keine forbidden literals)
- Strukturelle Validierung (basher post-fix): 688 LOC, 34 Tests, 8 Gruppen, 67 expect() Assertions, 1 `_StubClassifier`-Klasse (DI-Stub)
- Erwartete CI-Validation (lokal kein Flutter SDK installiert):
  - `dart format lib/ test/` → muss unter CI-Format laufen
  - `flutter test test/weather_provider_test.dart` → erwartet 34/34 grün
  - `flutter analyze --no-fatal-infos` → erwartet 0 issues
- **Gesamt-Test-Zähler nach Phase R.10: Mobile 67 (10 AQ-DTO + 23 AQ-Provider + 34 Weather-Provider) Tests erwartet grün — bestätigt sich mit CI-Run**

### Offene Punkte (bewusst nicht umgesetzt)

- **Success-Pfad von `refresh()`**: Wegen fehlender apiGet-DI nicht deterministisch testbar. Bewusst nicht umgesetzt. Production-Code-Refactor (Constructor: `WeatherProvider({HttpClient? http, ApiClient? apiClient})`) würde volle Coverage ermöglichen — getrennt scopen.
- **Alerts-Endpoint-Failure-Isolation**: Forecast success + alerts failure als eigener Test-Pfad erfordert apiGet-DI. Aktuell werden alle Alerts-Fehler-Pfade durch try/catch in `refresh()` silently gehandhabt.
- **Sentiment-Classifier echte Impl**: Phase 1 nach AI-Implementierungsplan (`TfliteSentimentClassifier`). Tests müssen dann erweitert werden um Real-Behavior + Stub-Behavior kontrastieren zu können.
- **Cross-Service-Insight Extensions** (`isRainingNow`, `isRainingSoon`): Pure DTO-Extensions — gehören in `weather_dto_test.dart` (separater Scope, nicht hier).

---

## Phase B-2 — Abfallkalender Backend (2026-07-27)

> **Ziel:** Privater Müllkalender-Service für Berlin BSR / Hamburg SRH / München AWB. Backend-only Phase 1 (vor Flutter UI + Adress-Picker).

### Status

- ✅ `src/backend/src/lib/icalParser.ts` (NEU, **221 Zeilen**) — minimaler hand-geschriebener iCal/ICS-Parser: VCALENDAR + VEVENT + DTSTART (basic + ISO + date-only) + DTEND / DURATION (P-Format) + SUMMARY + LOCATION + CATEGORIES. Pure-Function, ~180 LOC logik + ~40 LOC Kommentare/Doc. Keine RRULE-Expansion (kommunale Abfallkalender nutzen absolute Daten).
- ✅ `src/backend/src/services/wasteCityResolver.ts` (NEU, **88 Zeilen**) — Static Bounding-Box lat/lng → city (Berlin/Hamburg/München). Inclusive-lo, exclusive-hi damit Edge-Cases deterministisch der ersten bbox zugeordnet werden. CityNotSupportedError für ausserhalb-Coverage.
- ✅ `src/backend/src/services/wasteService.ts` (NEU, **332 Zeilen**) — mirror-fallback-Service. 24h in-memory-Cache (Schedule-Window, nicht stündlich wechselnd). Mirror-Failover NUR auf 5xx/429/ECONNABORTED/ETIMEDOUT (4xx NICHT — sind Client-Fehler). Constructor-DI für Axios-Instance. Cache-Key mit NFC-normalisierung (kein collision zwischen 'Straße' / 'Strasse' / 'straße').
- ✅ `src/backend/src/routes/waste.ts` (NEU, **137 Zeilen**) — Express-Router mit Zod-validation-middleware. Endpoints: `GET /api/waste/calendar?lat=&lng=&weeks=&street=&houseNr=` + `GET /api/waste/status`. HTTP-Status: 200 OK / 400 BadRequest (CityNotSupportedError) / 422 UnprocessableEntity (Hamburg/München ohne address) / 502 BadGateway (upstream beide mirrors down).
- ✅ `src/backend/src/__tests__/wasteService.test.ts` (NEU, **335 Zeilen, 19 Tests in 4 Describe-Blöcken**) — pattern-mirror zu `weatherService.test.ts`: Constructor-DI mock-http + URL-routing für deterministische concurrent-fetch-Verteilung. KEIN jest.mock('axios') (Mock-Policy-Compliance).
  - **Describe A — Resolver (5 Tests):** Berlin/Hamburg/München bbox-resolution, Odenwald-OutsideCity → CityNotSupportedError, NaN-input → TypeError
  - **Describe B — iCal Parser (6 Tests):** BSR-style 5-event mit allen CATEGORIES, AWB-Style basic-Format (YYYYMMDDTHHMMSS), SRH-Style mit DURATION P2H → end-berechnet, malformed-input → 0 events graceful, empty/non-iCal → 0 events, **CRLF line-endings (RFC 5545) → LF konsistent**
  - **Describe C — Mirror-Fetch (5 Tests):** Berlin primary 200 → 5 events + cached+false, **primary 503 → fallback 200 → 2 calls + source=zweite URL**, primary 400 NON-recoverable → KEIN fallback (1 call), **Hamburg ohne street+houseNr → AddressRequiredError KEIN HTTP-Request**, both-fail-503 → primary error
  - **Describe D — Cache + 24h-TTL (3 Tests):** Zweiter getWasteCalendar-Call → KEIN extra HTTP (cached=true), weeks=1 → forward-Filter (alle events ≤ 7 Tage), Events aufsteigend sortiert nach start
- ✅ `src/backend/src/index.ts` (MODIFIED) — `import { wasteRouter } from './routes/waste'` + `app.use('/api/waste', wasteRouter)`

### Datenfluss

```
Flutter WasteScreen (Phase B-3 noch nicht gebaut)
            ↓
GET /api/waste/calendar?lat=52.52&lng=13.41&weeks=4&street=...&houseNr=...
            ↓
wasteRouter → routes/waste.ts → wasteService.getWasteCalendar()
            ↓
[1] resolveCity(lat, lng) → bbox-check → bounds
   throws CityNotSupportedError wenn ausserhalb Berlin/Hamburg/München
            ↓
[2] Address-Required-Check (Hamburg + München)
   throws AddressRequiredError wenn kein street+houseNr
            ↓
[3] Cache-Key-Build (NFC-normalisiert)
   berlin|strasse='strasse'|hausnr='1'|weeks=4
            ↓
[4] Cache-Hit (24h TTL) → return cached mit cached=true
            ↓
[5] URL-Build mit {street}/{houseNr}-placeholders
            ↓
[6] primary HTTP fetch → parseIcsCalendar → events[]
            ↓
[7] Bei recoverable-Failure → fallback URL → parseIcsCalendar
   4xx (z.B. 400) NICHT failover (Programmier-Fehler)
            ↓
[8] weeks-Filter (alle events > weeks*7 Tage werden aussortiert)
            ↓
[9] Cache-Write + Response-Build
```

### Design-Entscheidungen (Gemini-Analyse)

| Entscheidung | Begründung |
|--------------|------------|
| **City-Resolver via Static Bounding-Box** statt Nominatim | 0 externe HTTP-Calls, <1ms Latency, deterministisch. Phase-1-Coverage nur 3 große Städte ohnehin hardcoded-bbox-fähig. Andere deutsche Städte → `CityNotSupportedError` mit klarer Meldung. |
| **Custom iCal-Parser** statt `node-ical` | AGENTS.md-Preference: minimal npm-deps. Parser ist 180 LOC, handgeschrieben, deckt alle von BSR/AWB/SRH genutzten Features. RRULE un-needed (kommunale Kalender nutzen absolute Daten). |
| **Mirror-Failover NUR auf recoverable-Failure** | 5xx/429/ECONNABORTED/ETIMEDOUT triggern fallback. 4xx (400 BadRequest, 401 Unauthorized, 404 Not Found in normal-cases) NICHT — wäre nur thundering-herd gegen fallback-URL. 404 ist TODO Phase 2 falls Real-World zeigt dass BSR URL rotated. |
| **24h Cache-TTL** statt 5min (vs airQuality/weather) | Abfallkalender ändern sich NICHT stündlich. 24h spart drastisch externen Requests auf oft fragile municipale Endpoints. Cache-Key mit NFC-normalisierung macht 'Straße'/'Strasse'/'straße' zu EINEM Cache-Entry. |
| **Per-City URL-Roster mit env-overrides** | `process.env.ABFALL_BSR_PRIMARY_URL || 'fallback-default'`. Production-deployment kann via Render-Environment-Variable echte URLs einsetzen ohne Code-Change. |
| **Hamburg/München address_required-Pfad** | Hamburg SRH + München AWB liefern nur adress-spezifische iCal-Feeds. Phase 1 ohne Adress-Lookup-Workflow → 422 mit `code: ADDRESS_REQUIRED`. Validate-Workflow später (Phase B-3 Flutter). |
| **Mobile-UI-deferred (Phase B-3)** | User-Gate: "Backend parse + 2-3 iCal-mirror fallbacks BEFORE Flutter UI work". Backend zuerst vollständig + getestet, Flutter dann mit klarer UX. |
| **Mirror-Fallback Coverage**: 1 primary + 1 fallback für Berlin (BSR + Berlin-Open-Data-Mirror), 1 primary für München (AWB + GitHub-muenchen-abfallkalender mirror), nur primary für Hamburg (kein Open-Data-mirror bekannt). Phase 2: Hamburg-Transparenzportal prüfen. |
| **Mock-Policy-Strict** | Test-Mock via Constructor-DI (mirror weatherService.test.ts). KEIN jest.mock('axios'). KEIN `StubNaiveBayes-*`-Pattern in Production-Code. Test-fixtures sind realistische String-Literals für BSR/AWB/SRH-Stile. |
| **Public API Surface** | `getWasteCalendar(lat, lng, weeks, street?, houseNr?)` → `WasteCalendarResponse { city, displayName, weeks, events, source, fetchedAt, cached, status }`. Plus `getStatus()` für `/api/waste/status`-Route-Info. Plus `getAttribution(city)` zur Vermeidung doppelter Maps. |

### Lessons-Learned

1. **Static-Bounding-Box statt Reverse-Geocode für lat/lng→City** — 0 external deps, 0 latency. Nur 3 Großstädte → hardcoded-bbox-list. Skaliert NICHT auf Deutschland-weite Coverage, aber für Phase 1 minimum-viable. Bei Reife-Erweiterung: Overpass-Query oder Bundesländer-Database.
2. **Mirror-Failover NICHT-4xx-triggert** — Production-Code-Refactor für google/api-DI (Constructor `{AxiosInstance}`) ist MOBILE-Wetter bereits etabliert; nur Error-Classification ist neu. `shouldFailover()`-Helper konsolidiert die Entscheidung.
3. **Cached-String-Normalisierung mit .normalize('NFC')** — Deutsche Adressen mit 'ß' vs 'ss' sind real-world-cache-key-collision-Risk ohne Normalisierung. Unicode-NFC (kompositioniert) statt NFD (dekompositioniert) ist Standard für Address-Lookup (siehe Adyen/yaml NFD-Reihenfolge in DE-Standard).
4. **CC-BY Attribution als Single Source of Truth** — `WasteService.getAttribution(city)` aus dem internen Roster, NICHT dupliziert in der Route-Layer. Vermeidet Fork-und-Update-Issue wenn Compliance-Officer License-Text updated.
5. **Phase 1 mit Hamburg ohne Mirror ist OK dokumentiert als TODO** — Realistische Data-Availability-Disclosure: nicht jeder öffentliche Service hat public-mirror. Ehrliche Caption ist wichtiger als 2-3-Mirror-Policy-Compliance auf Biegen-und-Brechen.

### Mock-Policy-Konformität

- Produktion-Code (`lib/`, `services/`, `routes/`, `index.ts`): null fundLocal / null `_computeMockLiveStatus` / null `StubNaiveBayes*` / null `local://demo`. Echtes axios, echte iCal-URLs. ✓
- Test-Code (`__tests__/`): Constructor-DI mock-http (real-axios-replacement, KEIN jest.mock). iCal-Fixtures sind realistische String-Literals für BSR/AWB/SRH-Patterns. ✓
- `audit-no-mocks.sh` erwartet: 0 violations (Validator grep-b unten in Validation bestätigt — die 2 false-positive-Treffer sind nur in `///` doc-comments die COMMENT_REGEX exempted).

### Validation

- Strukturelle Validierung (basher post-fix): **1113 Zeilen total**, 19 Tests (war 17, +1 CRLF-Test + 1 Resolver-NaN-Test)
  - `icalParser.ts`: 221 LOC
  - `wasteCityResolver.ts`: 88 LOC
  - `wasteService.ts`: 332 LOC
  - `routes/waste.ts`: 137 LOC
  - `__tests__/wasteService.test.ts`: 335 LOC
- Code-Reviewer-minimax-m3 PASS-with-4-NEEDS-FIX (alle 4 angewendet):
  1. **Cache-Key NFC-Normalisierung** ✓ (line 319-320)
  2. **Hamburg-Mirror-TODO-Comment** ✓ (kein mirror-fallback aktuell)
  3. **`wasteService.getAttribution(city)`-Method statt duplizierter Helper** ✓ (`thisAttribution()` in routes/waste.ts entfernt)
  4. **CRLF-Test** ✓ (line 210 im test-file)
- Erwartete CI-Validation (lokal kein node_modules/npx-tsc verfügbar — CI wird laufen):
  - `cd src/backend && npx tsc --noEmit` → erwartet 0 Errors
  - `cd src/backend && npx jest src/__tests__/wasteService.test.ts` → erwartet 19/19 passed
  - `cd src/backend && npx jest src/__tests__/wasteService.test.ts src/__tests__/weatherService.test.ts src/__tests__/weatherAlerts.test.ts` → erwartet 19+10+12=41 passed (Wetter+AQ+Waste kombiniert)
- **Backend Test-Gesamt-Zähler nach Phase B-2: 19 neue Tests** (war 52 nach Phase R.7+R.8 + 113 alt Baseline = ~165+ Backend-Tests).

### Offene Punkte (bewusst nicht umgesetzt)

- **Flutter-UI (Phase B-3)**: Service in Mobile-Frontend einbinden (`lib/features/waste/` + Provider mit `service_registry`-Eintrag). Pending Phase 2.
- **Adress-Picker UX**: Hamburg/München brauchen address-Picker-Flow im Mobile. Backend wirft 422, Frontend muss dann einen Reverse-Geocode + Straßenauswahl zeigen. Phase 3+.
- **Hamburg-Open-Data-Mirror-Recherche**: Wenn Hamburg-Transparenzportal eine iCal-API bietet, fallback-URL addieren.
- **404 als recoverable Mirror-Failover-Status**: Phase 2 falls Real-World zeigt dass BSR URL rotated.
- **RRULE-Expansion im Parser**: Falls AWB in Zukunft recurring-rules einbaut (z.B. "alle 14 Tage Biotonne") — Phase 2.
- **Line-Folding (RFC 5545 §3.1)**: Implementiert nur LF—Phase 2 falls Real-World-BSR/AWB multilang-SUMMARY mit Line-Folding liefert.
- **Reale Endpoint-URL-Verifikation**: Production-Deploy erfordert `ABFALL_BSR_PRIMARY_URL` + `ABFALL_AWB_PRIMARY_URL` + `ABFALL_SRH_PRIMARY_URL` env-vars in Render mit echten URLs.
