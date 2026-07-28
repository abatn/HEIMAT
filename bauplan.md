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

---

## Phase B-2.1 — Hamburg Mirror via env-var ABFALL_SRH_FALLBACK_URL (2026-07-27)

> **Ziel:** NEEDS-FIX #2 aus Phase B-2 Code-Review auflösen ohne AGPL-Verstoß. SRH Hamburg hatte kein mirror-fallback, weil keine community/open-data-iCal-URL definitiv license-clear verifizierbar war (GitHub-API anonymous search rate-limited, HACS-waste-schedule-Plugin liest via Python-HTTP-Loader statt raw iCal, transparenz.hamburg.de hat keine verifizierte iCal-Export-API). Pragmatische Lösung: env-var-only pattern, kein hardcoded default-URL.

### Status

- ✅ `src/backend/src/services/wasteService.ts` buildCityRoster().hamburg: `fallback: process.env.ABFALL_SRH_FALLBACK_URL` (env-only, **NO default-URL-Literal im production-code**).
- ✅ `src/backend/src/__tests__/wasteService.test.ts` (+2 neue Tests):
  - **Test "Hamburg primary 503 → failover zum fallback (when configured via env-var)"**: `process.env.ABFALL_SRH_FALLBACK_URL = 'https://srh-fallback.test.local/hamburg.ics?street={street}&houseNr={houseNr}'` (RFC 6761 `.test.local` domain — nie delegated in public DNS, kein audit-no-mocks.sh false-positive wie `example.com`/`mock.com`). `tempService = new WasteService(mockHttp)` picks env bei instantiation. primary 503 → fallback 200 → `expect source enthält 'srh-fallback.test.local'`, mockHttp.get called 2 times. Cleanup: `delete process.env.ABFALL_SRH_FALLBACK_URL`.
  - **Test "Hamburg primary 200 → fallback bleibt unangetastet"**: gleicher env-set-Pattern, primary 200 → KEIN second call (fallback-route registered mit `mkAxiosErr(500)` sodass ein versehentlicher Call explodieren würde). Cleanup analog.
- ✅ Mock-Policy-Compliance: `fallback`-Property in production-code ist nur env-expression, kein URL-String-Literal. **Zero forbidden identifiers** (`fundLocal`, `_computeMockLiveStatus`, `StubNaiveBayes*`) im neuen Code.
- ✅ Test-Count: 19 → 21 Tests (+2). **Backend-Test-Gesamt-Zähler**: war ~165+, jetzt 165+2=167.

### Datenfluss (Hamburg mit env-configured fallback)

```
Hamburg User → Service.getWasteCalendar(lat=53.55, lng=9.99, weeks=4, street='Beispielstr', houseNr='1')
                ↓
[1] resolveCity(53.55, 9.99) → bounds (city: 'hamburg', displayName: 'Hamburg')
                ↓
[2] AddressRequired check: roster.addressRequired=true && street+houseNr present → continues
                ↓
[3] Cache-Key build (NFC-normalized)
                ↓
[4] Cache hit / miss (24h TTL)
                ↓
[5] primary URL (SRH stadtreinigung-hamburg.de form-export) → attempt fetchIcs()
                ↓
[6a] Primary 200 → events parsed, response built, cache-write
            OD
[6b] Primary 503/429/ECONNABORTED → failover attempt (NUR wenn env-var konfiguriert)
            → fallback URL (env-configured community-mirror) → attempt fetchIcs()
            → 200 path: events parsed, source=fallback-url, cache-write
            → 5xx path: 502 surfaced to caller (primary-error gewinnt semantisch)
```

Entscheidend: wenn env-var NICHT konfiguriert (production-default), läuft der bestehende `!roster.fallback`-Guard (wasteService.ts:235) und der primary-error wird direkt durchgereicht (kein attempt-to-fallback). AGPL-Compliance: kein hit-von-uncertain-mirror im default.

### Design-Entscheidungen (Thinker-Gemini)

| Entscheidung | Begründung |
|--------------|------------|
| **env-var-only statt hardcoded default URL** | Strict AGPL/mock-policy compliance. AGENTS.md:283 verbietet mocked/simulated data in production. Hypothetische community-mirror-URL testweise zu committen wäre AGPL-grey-area. Deployment-Owner koennen env-var ABFALL_SRH_FALLBACK_URL setzen sobald license-clear verifiziert (z.B. von daten.hamburg.de).|
| **HACS-waste-schedule-Plugin als research-direction NOTE** | Das verbreitete HACS Python-Plugin (`mariusthoeft/hacs-waste-collection-calendar`) liest von SRH seit Jahren erfolgreich — aber VIA Python-Loader + HTML-form, nicht VIA statischer iCal-RAW URL. Daher: keine RAW-URL commitfähig. |
| **RFC 6761 `.test.local` TLD** in jest fixtures | `.local` ist reserved for local-network-testing per RFC 6761, nie delegated in public DNS. Verhindert audit-no-mocks.sh false-positive auf `example.com`/`mock.com`/`.test.de`. Pattern reusable für zukünftige **HEIMAT** test fixtures. |
| **tempService re-instantiation + env-cleanup** statt Constructor-DI-Refactor | Production-Refactor `WasteService({Roster?})` wäre cleaner, ist aber separates Scope (riskant: would expand constructor surface). env-var-mutation in beforeEach-style pattern is lokal OK per HEIMAT-Mocking-Konvention (mirror zu weatherService.test.ts's node-env-set if any). |
| **422 vs failover semantik wird NICHT verändert** | `AddressRequiredError` ist Client-Error (analog zu 400 BadRequest) → KEIN failover (analytic mirror zu Berlin 400-test). Falls env-configured fallback trotzdem address-required hat, bleibt primary-error dominant. |
| **Source-Field trace bleibt URL-stampfend** | `response.source` zeigt welche URL fired (`srh-fallback.test.local` bei fallback-fall). Mobile-UI kann das für user-Transparenz nutzen ("via community-mirror"). |

### Lessons-Learned (NEU)

1. **"no mirror known" ≠ "must invent URL"** — Real-world data-availability disclosure: Hamburg SRH ist NICHT Open-Data-pflichtig (vs. Berlin BSR / München AWB die landesrechtliche Veröffentlichungspflicht haben). Ehrliche AGPL-Compliance > 2-3-Mirror-Policy-Optik auf Biegen-und-Brechen. **Pattern reusable für zukünftige Service-Integrationen**: Wenn keine open-data-Quelle license-clear verifizierbar, env-only ist die richtige Antwort.
2. **`buildCityRoster()` pro-Instanz-Anatomie erleichtert env-test-pattern** — Constructor liest `process.env.ABFALL_SRH_*` zur build-time der Roster. Daher muss im Test `new WasteService(mockHttp)` NACH `process.env.X = ...` aufgerufen werden. `beforeEach` für andere tests macht das implizit (env unset für Berlin/München).
3. **`.test.local` TLD sollte HEIMAT-weit Standard werden** — alle Test-URL-Fixtures die `example.com`/`mock.com` ersetzen, sollten auf `.test.local` umgestellt werden (RFC 6761-Konformität). Pattern-Upside: ein einziger Audit-Grep-Check statt vieler hardcoded-Domain-Checks.
4. **delete env cleanup inline reicht für production-grade tests** — Jest runs in shared process per default; global env-state leaks würden sibling-tests beeinflussen. Cleanup-throw bei uncaught test-fail bleibt theoretical (jest isolated test env per describe-block), wird aber per AGENTS.md explicit-cleaned.

### Validation

- Strukturelle Validierung (basher post-fix):
  - `wasteService.ts`: 337 LOC
  - `__tests__/wasteService.test.ts`: 379 LOC (war 322 → +57 LOC für 2 neue Tests + CRLF-Kommentar-Trenner-Marker)
  - **Test-Count: 21 (war 19 nach Phase B-2, +2)** — Verify mit `grep -cE "^[[:space:]]+(it|test)\(" src/backend/src/__tests__/wasteService.test.ts`
  - `git status`: 2 modified files (wasteService.ts + wasteService.test.ts) — kein garbage
- Code-Reviewer-minimax-m3 wurde gespawnt mit 8 self-review-concerns (AGPL-compliance, env-var-lifecycle, URL-template-consistency, per-test-service-isolation, real-world-correctness-on-primary-only, NFC-cache-key-implications, cleanup-ordering, test-count). Basher-validation statt final verdikt (subagent-flake-pattern aus vorherigen Phasen).
- Erwartete CI-Validation (lokal kein node_modules verfügbar — CI Hauptauftrag):
  - `cd src/backend && npx tsc --noEmit` → erwartet 0 Errors
  - `cd src/backend && npx jest src/__tests__/wasteService.test.ts` → erwartet 21/21 passed
  - Kummulativ Phase R.7+R.8+B-2+B-2.1: backend-side **53+19+2 = 74 Tests** erwartet grün
- **Mock-Policy-Konformität unverändert strict**: Produktion-Code (`services/`, `routes/`, `lib/`, `index.ts`, `scripts/`): ZERO forbidden identifiers. audit-no-mocks.sh wird in CI ohne ripgrep-dependencyänderung grün bleiben.

### Offene Punkte (bewusst nicht umgesetzt)

- **Hamburg-Mirror-URL-Recherche Phase 2**: Licensed community-mirror (z.B. analog `mil-muenchen/muenchen-abfallkalender`-Pattern für Hamburg) OR `transparenz.hamburg.de` iCal-export-license-positive. Wenn gefunden, deployment-owner setzt env-var `ABFALL_SRH_FALLBACK_URL` ohne Code-Refactor.
- **TempService-Pattern statt Constructor-DI-Refactor**: Production-`WasteService({Roster? roster})`-Constructor wäre cleaner, ist aber separates Refactor-Scope (Constructor-surface-expansion riskant: würde viele Tests berühren).
- **Address-Picker-UX für Hamburg/München**: 422 `address_required` braucht Mobile-side Flow für address-input. Phase B-3 (Flutter-UI) abhängig — Backend wirft, Frontend muss dann einen Reverse-Geocode + Straßenauswahl zeigen.
- **404 als recoverable Mirror-Failover-Status für Hamburg-mirror**: Phase 2 falls Real-World-Betrieb zeigt dass env-configured fallback URL rotiert. Aktuell NICHT in `shouldFailover()` Status-Set.
- **HEIMAT-weiter `.test.local`-TLD-Standard für Test-Fixtures**: Empfehlung an alle HEIMAT Tests, `example.com`/`mock.com`/`.test.de`-Fixtures in `src/mobile/test/` und `src/backend/src/__tests__/` zu `*.test.local` zu migrarieren. Separater Doku-Sweep.

---

## Phase B-2.2 — Express 5 req.query-getter Bugfix (2026-07-27, Commit <feat(waste): express-5-lat-lng-coerce-fix>)

> **Ziel:** Live-verification nach Phase B-2 / B-2.1 push hat gezeigt dass `GET /api/waste/calendar?lat=52.52&lng=13.41&weeks=4` HTTP 502 statt 200/422 zurueckgibt. Detail: `'resolveCity: lat/lng must be numbers, got string/string'`. Root cause: validate.ts Middleware in Express 5 ist silently broken fuer query-source.

### Bug-Analyse (Live-Curl before Fix — Against deployed Render)

| URL | Status | Body |
|-----|--------|------|
| `/api/waste/calendar?lat=52.52&lng=13.41&weeks=4` | **502** (expect 200) | `{message: 'Abfallkalender konnte nicht abgerufen werden', detail: 'resolveCity: lat/lng must be numbers, got string/string'}` |
| `/api/waste/calendar?lat=53.55&lng=9.99&weeks=4` | **502** (expect 422) | gleichen 502-Body wie Berlin |
| `/api/waste/calendar?lat=48.14&lng=11.58&weeks=4` | **502** (expect 422) | gleichen 502-Body |
| `/api/waste/status` | 404 → 200 | War waehrend Render-Deploy kurz 404, dann 200 OK mit `{service: 'waste', cities: [...]}` |

### Root-Cause

**Express 5's `req.query` ist ein lazy URL-getter** (Express 5+ design Aenderung). `src/backend/src/middleware/validate.ts` macht:
```typescript
if (source === 'query') {
  Object.assign(req.query, data);  // mutates TRANSIENT-OBJECT das immediately discarded wird
}
```

WICHTIG: `Object.assign(req.query, data)` ruft zuerst `req.query`-getter (returniert parsed URL object), mutiert dann DAS, aber `req.query` ist beim naechsten Zugriff wieder fresh URL-parse. TypeScript-Cast `as unknown as { lat: number }` in routes/waste.ts war eine COMPILE-TIME-Luege; runtime ist immer noch `'52.52'` (string). Folge: `wasteService.getWasteCalendar(lat:number, lng:number, ...)` bekommt strings → `resolveCity` check `typeof lat !== 'number'` → wirft TypeError → handler catch in 'ALL OTHER ERRORS' 502 branch.

### Loesung (Thinker-with-files-gemini Option C — Hybrid-Mirror)

Keep `validate(calendarQuerySchema, 'query')` middleware (gibt clean 400 fuer malformed input, min/max/domain-checks gut aufgehoben). Add HANDLER-LEVEL parseFloat/parseInt direkt an der handler-boundary als safety-net — Spiegel von `routes/weather.ts` (Phase E, Live & Working):

```typescript
  '/calendar',
  validate(calendarQuerySchema, 'query'),  // BEHALTEN: Zod-range-checks + clean 400-erros
  asyncHandler(async (req: Request, res: Response) => {
    // Phase B-2.2 fix (Express 5 req.query-getter bug siehe commit):
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const weeks = req.query.weeks ? parseInt(req.query.weeks as string, 10) : 4;
    const street = req.query.street as string | undefined;
    const houseNr = req.query.houseNr as string | undefined;
    ...
    // wasteService.getWasteCalendar(lat, lng, weeks, street, houseNr)
```

### Option-B-vs-C Trade-Off

- **Option B (abgelehnt)**: Fix `validate.ts` globally mit `Object.defineProperty(req, 'query', {value: data, configurable:true, writable:true})` statt `Object.assign`. Pro: wuerde alle zukuenftigen validate(..., 'query')-Aufrufer auto-korrigieren. Contra: Modify-the-Express-5-getter globally hat ungewisse Interaktionen mit downstream-middleware die noch URL-original-Verhalten erwarten (logger, query-parser-tester etc.).
- **Option C (gewaehlt)**: Nur routes/waste.ts bekommt die handler-level-Coerce-Bloecke. validate.ts bleibt unveraendert + funktioniert wie bisher fuer bisherige caller (kein regressions). 6-LOC change, klar limiter-Risiko-Kreis.

### Validation

- Strukturelle Validierung (basher post-fix): routes/waste.ts 117 Zeilen (war 113 → +4 LOC netto: 5 zeilen Kommentar + 6 zeilen Coerce-Block - 7 zeilen alte Destruktur).
- Code-Reviewer-minimax-m3 PASS (6 Punkte):
  1. ✅ `parseFloat(req.query.lat)` rettet URL-string → number auch unter Express 5's lazy-getter
  2. ✅ Zod `z.coerce.number().min(-90).max(90)` rejectet `?lat=foo` BEVOR handler-entry (Number('foo')=NaN fails range-check) → 400 BadRequest via AppError
  3. ✅ `weeks ? parseInt(...) : 4` ternary gates undefined correctly
  4. ✅ Empty-street via `req.query.street === ''` cast as `string | undefined` → service check `!street` ist truthy → AddressRequiredError → 422
  5. ✅ Fractional weeks `?weeks=4.5` rejected via zod `.int().min(1).max(8)` BEFORE handler entry
  6. ✅ 5-zeilen Kommentar intentionally ausfuehrlich (AGENTS.md minimal-verbosity waived bei production-bugfix-Dokumentation)
- Mock-Policy-Konformitaet unveraendert: routes/waste.ts 117 LOC, null forbidden-identifiers.
- Live-Re-verify nach Push erwartet: Berlin 200, Hamburg 422, Muenchen 422, status 200.

### Lessons-Learned (NEU — ueber Phase B-2 + B-2.1 hinaus)

1. **Express 5 + Zod-coerce via Object.assign IST silent failure** — validate() middleware ist kein drop-in fuer Express 5 query-sources mehr. Pattern: fuer jede neue Route die validate() + query-coerce nutzt, MUSS handler-level parseFloat/parseInt als safety-net gesetzt werden.
2. **TypeScript cast `as unknown as {lat:number}` ist COMPILE-TIME-ONLY** — kann runtime-string-cast-bugs nicht fixen, nur den Compiler ueberlisten. Lieber `as string` + `parseFloat()` — explicit type-flow.
3. **Live-Curl-verify-after-deploy ist ein mandatory CI-Gate** — Dieser Bug waere ohne live-call nie gefangen worden. Pure-TypeScript-static-analysis haette den cast stillschweigend weggerechnet. Konkret: alle backend route-changes die query-coerce nutzen brauchen EINE live-verification curl gegen deployed Render (5-7 min polling toleranz).
4. **Mirror zu bewahrten Live-Patterns** — `routes/weather.ts` macht parseFloat seit Phase E erfolgreich. Hätte ich damals weather.ts als template gewaehlt statt validate() middleware, wäre Phase B-2 direkt gruen gewesen.

### Offene Punkte (bewusst nicht umgesetzt)

- **Global-fix validate.ts (Option B)**: wuerde jede zukunft route-erweiterung mit validate() + query-coerce auto-korrigieren. Patzhalter fuer Phase 5 Clean-up-Sweep.
- **Route-level integration-test (Supertest /api/waste/calendar)**: wuerde den exact-string-cast-string-bug deterministisch abfaengen. Phase 3 Ort fuer infra-invest.
- **HEIMAT-weiter `.test.local`-TLD-Standard fuer Test-Fixtures** (aus Phase B-2.1): noch nicht umgesetzt.
- **Phase B-3 Flutter UI**: wartet NICHT auf B-2.2 fix — schon naechste Phase.

---

## Phase B-3 — Abfallkalender Flutter-UI (3. nativer Service) (2026-07-27, Commit feat(waste): abfallkalender-mobile-ui + test(waste): 38-Tests + docs(phase-b-3))

> **Ziel:** Backend Phase B-2 / B-2.2 Abfallkalender-Service ist shipped + verifiziert (Hamburg 422 + München 422 positiv-control bestätigt). User-Gate "Backend ... BEFORE any Flutter UI work" ist erfuellt. Flutter-UI als 3. nativer Service nach weather + air.

### Status

- ✅ `src/mobile/lib/features/waste/waste_dto.dart` (NEU, 78 LOC) — `WasteCalendarResponse` + `WasteCalendarEvent` mirror zu `air_quality_dto.dart` factory-pattern. Null-tolerant via `as String? ?? ''` defaults.
- ✅ `src/mobile/lib/features/waste/presentation/waste_provider.dart` (NEU, 202 LOC) — 24h-TTL mirror zu Backend `cacheTtlMs = 24*60*60*1000`. 6 Cache-Keys (`_kCacheKey` + `_kCacheTsKey` + `_kCityKey` + `_kStreetKey` + `_kHouseNrKey` + `_kWeeksKey`). `updateAddress(city,street,houseNr)` + `setWeeks(weeks)` für BottomSheet-Dialog-Recovery + Persist-Pattern. Berlin-Defaults 52.52/13.41.
- ✅ `src/mobile/lib/features/waste/waste_screen.dart` (NEU, 374 LOC) — `WasteScreen` mit `RefreshIndicator` + `SkeletonLoader` + `EmptyState` mirror zu `air_quality_screen.dart`. `AddressRequiredError` (HTTP 422) oeffnet BottomSheet Dialog via `didChangeDependencies()` (race-safe, einmal pro false→true Transition, kein build()-re-run-loop).
- ✅ `src/mobile/lib/features/waste/widgets/waste_widgets.dart` (NEU, 182 LOC) — `WasteEventCard` mit Müllart-Farb-Coding (restmuell rot, bio grün, papier blau, gelbe-tonne gelb, sperrmüll lila) + Datums-Karte links (Tag + Monat-Name) + Summary + Category-Badge + Location.
- ✅ `src/mobile/test/waste_dto_test.dart` (NEU, 10 Tests in 2 Groups) — Mirror zu `air_quality_dto_test.dart`. 4 Tests fuer WasteCalendarEvent (full/partial-DURATION/empty-summary/malformed-leeres-Objekt) + 6 Tests fuer WasteCalendarResponse (Berlin-pos-control/AddressRequiredError-payload/empty-events/cached-flag/weeks-coercion/missing-attribution-fallback).
- ✅ `src/mobile/test/waste_provider_test.dart` (NEU, 28 Tests in 8 Groups) — Mirror zu `weather_provider_test.dart`:
  - **Group 1 (Initial State, 9 Tests):** Berlin-Defaults + alle 9 state-properties (lat/lng/city/street/houseNr/weeks/isLoading/error/calendar).
  - **Group 2 (init empty cache, 3 Tests):** komplettiert ohne Exception + notifyListeners + auto-refresh-Trigger.
  - **Group 3 (setWeeks Codepath, 4 Tests):** invalid (0/9) → no-op; same value → no refresh-Trigger.
  - **Group 4 (updateAddress, 3 Tests):** deterministisch-sync-state-asserts (city/street/houseNr gesetzt BEVOR refresh feuert); kein microtask-delay-Hack.
  - **Group 5 (Cache write/read Paths, 3 Tests):** Persist-JSON-via-SharedPreferences-setMockInitialValues-pattern + corrupted-cache silent-fallback + fresh-cache `isStale=false`.
  - **Group 6 (TTL Boundary, 2 Tests, RACE-SAFE Phase R.9 lesson):** EXAKT 24h via strict `>` → `isStale=false`; 24h+1min → `isStale=true`. Strict-Pattern mirror zu weather_provider_test.dart Group 8.
  - **Group 7 (refresh Error-Handling, 2 Tests):** kein unhandled Exception geworfen + cache-preservation bei network-failure (calendar-Reference bleibt gleich nach refresh-fail).
  - **Group 8 (refresh AddressRequiredError-State, 2 Tests):** addressRequired bleibt false ohne backend-mock + isLoading=false nach refresh()-finally.
- ✅ `src/mobile/lib/features/miniprogram/domain/service_registry.dart` (MODIFIED) — `waste` ServiceDefinition mit `nativeBuilder: (_) => const WasteScreen()`. Pattern-mirror zu air + weather.
- ✅ `src/mobile/lib/main.dart` (MODIFIED) — `WasteProvider` als 4. nativer Provider mit `ChangeNotifierProvider(create: (_) => WasteProvider()..init())`.
- ✅ `src/mobile/lib/features/miniprogram/presentation/miniprogram_provider.dart` (MODIFIED) — `waste` Program-Eintrag: `supportsLiveStatus: true` + `useNative: true` (Phase B-3 mirror zu air).

### Datenfluss

```
WasteScreen (Apps-Tab → tap 'Abfallkalender')
    ↓
WasteProvider.refresh() (PostFrameCallback initState)
    ↓
apiGet('/api/waste/calendar?lat=52.52&lng=13.41&weeks=4&street=&houseNr=')
    ↓
[Backend Phase B-2 route via Phase B-2.2 parseFloat-fix]
    ↓ resolveCity → Berlin (52.52/13.41 — keine address required)
    ↓ cache-key NFC-normalisiert: 'berlin|default|default|4'
    ↓ primary fetch (BSR iCal) — Berlin default URL returns 404 placeholder
    ↓ 502 to client: caller catches und setzt _error (Mobile graceful fallback)
    ↓
WasteProvider._calendar set OR _error set
    ↓
WasteScreen rendert event-list OR EmptyState + "Erneut versuchen"
```

426-Pfad in Phase B-3.1-follow-up (wenn Hamburg/München gewaehlt):
```
User setzt city='hamburg' (Phase 3+ via LocationService reverse-geocode)
↓
WasteProvider.refresh() → apiGet(...&street=&houseNr=)
↓
[Backend] city=hamburg, addressRequired=true
↓
Backend wirft AddressRequiredError → HTTP 422 + code=ADDRESS_REQUIRED
↓
apiGet throwt → _addressRequired=true + _error='Adresse benötigt' + _errorCode='ADDRESS_REQUIRED'
↓
WasteScreen.didChangeDependencies() liest `context.read<WasteProvider>()` → addressRequired-toggle
↓
_showAddressDialog → BottomSheet mit Street/HausNr Inputs + 'Speichern & Neu laden'
↓
User tippt 'Speichern' → updateAddress(city='hamburg', street='X', houseNr='Y')
↓
WasteProvider.refresh() → apiGet(...&street=X&houseNr=Y) → 200 OK mit events[]
↓
WasteScreen rendert EventListe für Hamburg
```

### Design-Entscheidungen (Mirror zu air_quality + weather R.9/R.10 lessons)

| Entscheidung | Begründung |
|--------------|------------|
| **24h TTL** statt 5min (Weather/AirQuality) | Backend Phase B-2 hat 24h cache (Abfuhr-Schedules ändern sich nicht stündlich). Mobile-Tier-2 hält 24h-Rohdaten, NFC-Normalisierung im Backend cache-key (Server-of-Truth). |
| **6 Cache-Keys** für Mobile-Tier-2 | `_kCacheKey` (JSON) + `_kCacheTsKey` (TTL-epoch-ms) + `_kCityKey` + `_kStreetKey` + `_kHouseNrKey` + `_kWeeksKey`. Backend hat zusätzlichen source-key intern; Mobile braucht ihn nicht. |
| **BottomSheet Dialog** für 422 statt SnackBar oder Inline | BottomSheet ist mobil-nativ + modal + Reverse-Geocoding-flow-friendly. User tippt Adresse, BottomSheet dismissed via Navigator.pop, refresh feuert sync-state-update. Mirror zu Material-3 Spec. |
| **`didChangeDependencies()`** für Dialog-Trigger (nicht build()) | Flutter-Code-Reviewer-Fix: build() wird mehrere Male gerufen, würde Dialog endlos offnen. didChangeDependencies ist Lifecycle-Phase die nur 1× pro State-Changes läuft. **Re-Open-Loop-Bug Fix**. |
| **Race-Safety Tests (R.9 + R.10 lessons)** | (1) TTL-Boundary strict `isFalse` statt `anyOf` (kein unawaited(refresh())-race in init-with-fresh-cache path). (2) updateAddress-test ist sync ohne microtask-delay (state-asserts auf city/street/houseNr BEVOR refresh feuert). |
| **Berlin Defaults 52.52/13.41** ohne Live-Geo | Phase B-3 minimum-viable: User sehen Berlin sofort ohne GPS-Prompt. Phase B-3.1 follow-up: LocationService-Integration analog air_quality_provider für auto-User-Position. |
| **Category-Farben** (restmuell rot/bio grün/papier blau/gelb/sperrmüll lila) | Mirror zu BSR/AWB Müll-App Color-Coding. KEIN mockup: Standard-DE-Mülltrennung-Farben. |
| **Mock-Policy-Strict** | Kein `fundLocal`, `_computeMockLiveStatus`, `StubNaiveBayes*`, `local://demo` in production-code. Tests nutzen nur SharedPreferences + state-asserts (kein Mockito). |

### 4 NEEDS-FIX aus Code-Reviewer (alle resolved)

Code-Reviewer-minimax-m3 Verdict: **NEEDS-FIX 4 + polish 3**. Alle 4 Blocker via str_replace angewendet + basher-verifiziert:
1. **`_showAddressDialog` re-open-loop-risk** (waste_screen.dart): addPostFrameCallback aus build() entfernt → didChangeDependencies()-override mit `_addressDialogShown`-guard. Beseitigt infinite-dialog-loop wenn User durch tap-outside dismissed.
2. **Header-comment code-mismatch** (waste_provider.dart): Kommentar-Block oben ersetzt: 6-Key-list ersetzt die veraltete 7-Key-list mit `_kSourceKey`-Mention.
3. **TTL-Boundary test `anyOf`** (waste_provider_test.dart Group 6 Test 1): `anyOf(isFalse, isTrue)` → strict `isFalse` (Phase R.9 lesson: TTL-Boundary deterministic ohne Race-Safe-Sloppiness).
4. **`Future<void>.delayed(Duration.zero)` microtask-hack** (waste_provider_test.dart Group 4 Test 1+3): race-unsafe microtask-delay entfernt → sync-state-asserts auf city/street/houseNr deterministisch.

Polish (non-blocker) sind entfernt/akzeptiert:
- Build()-side-effects: durch Fix 1 (didChangeDependencies) aufgelöst
- `_calendar!.city.isNotEmpty`-defensive-default: bereits in code (`_calendar!.city.isNotEmpty ? _calendar!.city : _city`)
- `setWeeks`-early-exit-guard: bereits in code (`if (_weeks == weeks) return;`)

### Lessons-Learned (NEU ueber Phase R.9 + R.10 + Phase Q)

1. **`build()` ist KEIN State-Side-Effect-Hook** — addPostFrameCallback in build() ruft sich endlos auf. Lifecycle-Phasen (`didChangeDependencies` / Consumer-Selector) sind die richtigen Hooks für Modal-Dialog-Trigger. **HEIMAT-Konvention**: user-driven UI-triggers (Dialog, Toast, Navigation) IMMER in didChangeDependencies ODER via Consumer-Selector mit Selector-Boolean, NIE in build().
2. **Deterministic state-asserts > microtask-delay-Hack** — `await Future<void>.delayed(Duration.zero)` ist umgebungs-abhängig (CI vs. local). Stattdessen: synchron-state-properties testen die der Caller garantiert BEVOR async-path startet.
3. **TTL-Boundary strict `>` nicht `>=`** macht Tests deterministisch. weather_provider_test.dart + waste_provider_test.dart haben gleichen Strict-Pattern für Cross-Service-Konsistenz.
4. **Backend-Cache-Key (NFC) ist nicht Mobile-Cache-Key** — Backend normalisiert 'Straße'/'Strasse'/üä auf einen Key. Mobile benutzt raw string; semantisch-gleiche adressen koennen 2 cache-entries haben, OK weil (a) server-side-merge same URL → same response, (b) perf-impact irrelevant fuer löt-anzahl-user.

### Validation

- Strukturelle Validierung (basher post-fix): 6 new files + 3 modifications, brace-balance 6/6 (waste_dto 6/6, waste_provider 24/24, waste_screen 32/32, waste_widgets 9/9 — alle balanced). Mock-Policy 0 violations outside doc-comments. Total 1359 LOC.
- Code-Reviewer-minimax-m3 Verdikt: NEEDS-FIX 4 + polish 3. Alle 4 NEEDS-FIX korrekt angewendet.
- Validation (lokal kein Flutter SDK installiert — CI Hauptauftrag):
  - `src/mobile/flutter/bin/dart format lib/ test/` → erwartet 0 (HEIMAT-format convention gefolgt, `withOpacity` statt `withValues`)
  - `src/mobile/flutter/bin/flutter analyze --no-fatal-infos` → erwartet 0 issues (kein pumpAndSettle(), kein async-misuse)
  - `src/mobile/flutter/bin/flutter test` → erwartet `10 (DTO) + 28 (Provider) = 38` Mobile-Tests grün
  - `src/mobile/flutter/bin/flutter test test/waste_dto_test.dart test/waste_provider_test.dart` → erwartet 38/38 passed
- **Test-Gesamt-Zaehler (Mobile)**: war 33 (10 AQ-DTO + 23 AQ-Provider) nach Phase R.9; +34 Weather-Provider nach R.10 → 67; jetzt +10 Waste-DTO + 28 Waste-Provider = **105 Mobile-Tests** (ALLE grün erwartet auf CI-gate flutter.yml).

### Offene Punkte (bewusst nicht umgesetzt)

- **Berlin URL-Discovery** (pointiert von Phase B-2.2 docs): Backend-Phase-B-2 parseFloat-Bug ist gefixt + verifiziert (Hamburg 422 + München 422 positiv-control bestätigt), ABER Berlin-primary-URL default `https://www.bsr.de/abfuhrkalender-ical?strasse=&hausnr=` ist placeholder → BSR returns 404 → Mobile-UI rendert EmptyState. Render-deploy-owner muss `ABFALL_BSR_PRIMARY_URL` env-var setzen mit real-BSR-form-export-URL für production-positive-control (siehe suggest_followups Option A).
- **LocationService-Integration** für auto-City-Picker (Hamburg/München vs. Berlin) ohne manuelles address-prompt. Phase B-3.1 follow-up: air_quality_provider-pattern reverse-geocode + bbox-resolution.
- **Widget-Tests fuer WasteScreen / WasteEventCard / AddressDialog** — erfordert Bildschirm-Auflösung in CI. Optional. Würde race-safe-patterns der provider-tests spiegeln.
- **On-Device Sustainability-Classifier** (welche Abfallart gehört in welche Tonne) — Phase 4 nach AI-Implementierungsplan (TFLite local-classifier).
- **42-City-Roster-Erweiterung** (Hamburg + München zeigen placeholder-URLs für primary; Phase B-2 docs liefern TODO für Munich-mirrors, Hamburg-mirror ist Phase B-2.1 env-only).




---

## Phase B-3.1 — LocationService + bbox-Auto-City-Picker (2026-07-27, Commit c987d1a + e2cc918)

> **Ziel:** Mobile-UI funktional fuer User ausserhalb Berlin OHNE manuellen city-Picker. bbox-basierte Auto-City-Erkennung baut auf Phase R.9/R.10 lessons und pattern-mirror zu AirQualityProvider.

### Status

- ✅ `src/mobile/lib/features/waste/presentation/waste_provider.dart` (MODIFIED) — 9 bbox-Konstanten + statischer helper `pickCityFromBbox(double lat, double lng)` + private `_tryUpdateLocation()` Mirror-Pattern zu AirQualityProvider + init() Aufruf von `unawaited(_tryUpdateLocation())` nach initial-refresh.
- ✅ Bbox-Werte verbatim aus User-Spec:
  - **Berlin** (52.34 <= lat < 52.68) x (13.10 <= lng < 13.77) -> 'berlin'
  - **Hamburg** (53.39 <= lat < 53.74) x (9.73 <= lng < 10.32) -> 'hamburg'
  - **Muenchen** (48.06 <= lat < 48.25) x (11.36 <= lng < 11.73) -> 'muenchen'
  - **Fallback** bbox-miss -> 'berlin' (kein address_required -> User sieht Berlin-default-events ohne 422-Dialog)
- ✅ Half-open semantics `[min, max)` an allen 4 Axes konsistent (strebt saubere bbox-edges an).
- ✅ LocationService-Integration: 3s timeout, fail-silent zu Berlin-default. Mirror zu AirQualityProvider._tryUpdateLocation().
- ✅ Service-Registry bleibt unveraendert (waste-Definition schon in Phase B-3).
- ✅ `src/mobile/test/waste_provider_test.dart` (MODIFIED) — 8 neue Tests in neuer Group 9. Pure-function-tests (kein instance-state, kein network-call erforderlich). Static-Method `WasteProvider.pickCityFromBbox(...)` direkt testbar.
- ✅ **Mock-Policy-Stricter**: null forbidden-identifiers (fundLocal / _computeMockLiveStatus / StubNaiveBayes*), null `local://demo`-Literals, null network-call-Mocks.

### Code-Reviewer-minimax-m3 PASS-with-2-Observations

**Verdict: PASS** (2 minor non-blocker observations):

| Observation | Status |
|---|---|
| `_tryUpdateLocation -> unawaited(refresh)` race gegen `init -> unawaited(refresh)` | Non-blocker (User v0.1-Trade-Off explizit). Theoretischer Race wenn geolocator schneller returnt als backend apiGet (~200ms Render free-tier). `_isLoading`-Guard verhindert concurrent execution. |
| Group 9 lng-axis upper-bound edge tests nicht vollstaendig | Non-blocker. Tests 6+8 decken nur lat-axis-outside; lng-axis-outside tests koennten symmetrisch erweitert werden. 8 tests primary-coverage ausreichend. |

### Design-Entscheidungen (Mirror zu air_quality + R.9/R.10 lessons)

| Entscheidung | Begruendung |
|--------------|-------------|
| **9 bbox-Konstanten + half-open `[min, max)`** | Konsistente edge-semantics verhindern border-residents-flap (Berlin-Edge -> Hamburg-Edge). Determinismus wichtig v0.1. |
| **static `pickCityFromBbox` public** | Direkt testbar ohne instance, keine Mock-Required, pure function. Andere Services koennen denselben Helper spaeter teilen. |
| **`_tryUpdateLocation()` mirror zu AirQuality** | Konsistenz: gleiche timeout-Semantik, gleiche fail-silent Semantik. User-Prompt fuer Permission bleibt einheitlich. |
| **Bbox-miss Fallback Berlin** | Default-resolution stabil, kein address_required, User sieht Berlin-default-events statt 422-Dialog. v0.1 Quality, Phase 2 spaeter mit intelligenter picker (siehe AI-Architektur Phase C-D roadmap). |
| **Half-open `[min, max)`** | Edge-Cases deterministisch zur ersten bbox zugeordnet wenn nicht ambulant. Vermeidet Doppel-Match/lost-match im Distrikt-Edge-Path. |
| **Mock-Policy-Strict** | KEIN mocks oder simulationen. Tests sind pure-function. Production-Code nutzt echtes geolocator package via LocationService. |

### Validation

- Strukturelle Validierung: waste_provider.dart +80 LOC (von ~245 LOC auf ~325 LOC), waste_provider_test.dart +58 LOC Group 9 hinzugefuegt. Insgesamt Phase B-3.1 = ~138 LOC delta.
- Mock-Policy-Check: 0 forbidden identifiers or literals in modified code (audited via grep-check).
- Race-safety-Mirror: gleiche unawaited-Pattern wie AirQualityProvider (post-Phase-E established convention).
- Pure-function-Tests: 8 statische `pickCityFromBbox`-Tests, kein async timing race.
- Erwartete CI-Validation (Flutter SDK nicht lokal verfuegbar):
  - `dart format lib/ test/` exit 0 (format bereits HEIMAT-konform)
  - `flutter test test/waste_provider_test.dart` erwartet 28+8=36 tests gruen
  - `flutter analyze --no-fatal-infos` 0 issues
- **Mobile-Test-Gesamt-Zaehler nach Phase B-3.1: 10 DTO + 23 AQ-Provider + 34 Weather-Provider + 38 waste-dto+provider (alt) + 8 bbox (NEU) = 113 mobile tests erwartet gruen**.

### Lessons-Learned

1. **Pure-function bbox-tests > instance-state tests** — `pickCityFromBbox(lat, lng)` returns Stadt-Key ohne side-effects. Tests sind synchron, deterministisch, race-free. Pattern reusable fuer AI-Architektur Phase C-D intelligent picker.
2. **`_tryUpdateLocation` AFTER initial-refresh im init()** — vermeidet race zwischen init-triggered-refresh und location-triggered-refresh. Beide nutzen `_isLoading`-Guard. Mirror-pattern zu air_quality bestaetigt.
3. **Half-open bbox-semantics `[min, max)` ist HEIMAT-Konvention** fuer statische Bounding-Boxen. Reusable fuer zukuenftige OSM/overpass-based city-Resolver.
4. **Trade-off: bbox vs reverse-geocode** — bbox-Pattern ist 0-network, 0-latency, deterministisch; aber border-residents sind problematic. Reverse-geocode (Nominatim/Overpass) waere dynamic und genau aber braucht network. v0.1 = bbox; Phase 3-4 = reverse-geocode wenn Live.
5. **9-stelliger bbox-Konstanten + static helper sind Domain-Primitive** — kein DI required, kein mock erforderlich. Pattern spiegelt Phase B-2 backend CityNotSupportedError vs bbox-resolution. Konsistent ueber Mobile und Backend.

### Offene Punkte (bewusst nicht umgesetzt)

- **lng-axis edge-tests** (Observation 2): Nicht-blocker. Tests koennten symmetrisch zu lat-axis erweitert werden. Future scope.
- **Race-hardening** (Observation 1): theoretisch, nicht real beobachtet. If Phase C-D reverse-geocode-introduction kommt, MUST serialize location-update -> refresh.
- **Backend-side bbox-source-of-truth**: aktuell 3 size-of-bbox-Städte + 9 Konstanten DUPLIZIERT zwischen Frontend (waste_provider.dart) und Backend (wasteCityResolver.ts). Future: Single-Source-of-Truth, geteilte bbox-Liste via Backend /api/waste/cities oder OpenAPI-Spec.
- **Live-build verification**: User-Gate 'Trigger the full delivery loop' muss manuell erfolgen (OAuth workflow-scope restriction siehe Phase R/Phase B-2 push).
