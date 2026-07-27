// ---------------------------------------------------------------------------
// weatherAlerts.test.ts — Jest Tests für die Rule-Engine
//
// 11 Tests decken alle Regeln + Span-Kollabierung + Sortierung.
// Tests sind an die Greedy-Contiguous-Run DAUERREGEN-Logik angepasst
// (vorher: 5 sliding-window alerts für 7 wet days, jetzt: 1 alert mit endDayIndex).
//
// Pure-function Tests: kein Mocking noetig, wir bauen WeatherData-Dummys direkt.
// ---------------------------------------------------------------------------

import {
  generateAlerts,
  WeatherAlert,
  AlertCode,
  AlertSeverity,
} from '../services/weatherAlertsService';
import type { WeatherData } from '../services/weatherService';

const noAlertsExpected: WeatherAlert[] = [];

// Helper: baue einen Minimal-Forecast mit defaults.
// Test fixture: partial mocks — runtime Felder werden via spread bereitgestellt.
// `as`-Cast umgeht TS-Type-Check absichtlich fuer kompakte Fixtures;
// Production-Daten kommen voll typisiert aus weatherService.
function makeForecast(
  daily: Partial<WeatherData['daily'][number]>[],
  current: Partial<WeatherData['current']> = {}
): WeatherData {
  return {
    location: { lat: 52.52, lng: 13.41, name: 'Berlin' },
    current: {
      temperature: 15,
      feelsLike: 14,
      humidity: 60,
      pressure: 1013,
      windSpeed: 10,
      windDirection: 180,
      weatherCode: 0,
      weatherText: 'Klarer Himmel',
      precipitation: 0,
      cloudCover: 0,
      uvIndex: 3,
      ...current,
    } as WeatherData['current'], // Test fixture cast, siehe oben
    hourly: [],
    daily: daily.map((d, i) => ({
      date: `2026-08-${(i + 1).toString().padStart(2, '0')}`,
      temperatureMax: d.temperatureMax ?? 20,
      temperatureMin: d.temperatureMin ?? 10,
      precipitationSum: d.precipitationSum ?? 0,
      precipitationProbability: d.precipitationProbability ?? 0,
      weatherCode: d.weatherCode ?? 0,
      weatherText: d.weatherText ?? 'Klarer Himmel',
      windSpeedMax: d.windSpeedMax ?? 10,
      sunrise: d.sunrise ?? '06:00',
      sunset: d.sunset ?? '20:00',
    })),
    source: 'Deutscher Wetterdienst (DWD) via Open-Meteo',
  };
}

// ---------------------------------------------------------------------------
// 1) STURM — Wind > 50 km/h
// ---------------------------------------------------------------------------
describe('weatherAlertsService - STURM', () => {
  it('erzeugt DANGER-sturm alert wenn windSpeedMax > 50', () => {
    const f = makeForecast([
      { windSpeedMax: 55 },
      { windSpeedMax: 30 },
      { windSpeedMax: 20 },
      { windSpeedMax: 20 },
      { windSpeedMax: 20 },
      { windSpeedMax: 20 },
      { windSpeedMax: 20 },
    ]);
    const alerts = generateAlerts(f);
    const sturm = alerts.filter((a) => a.code === 'sturm');
    expect(sturm).toHaveLength(1);
    expect(sturm[0].severity).toBe<AlertSeverity>('danger');
    expect(sturm[0].dayIndex).toBe(0);
    expect(sturm[0].metric).toBeDefined();
    expect(sturm[0].metric!.value).toBe('55');
  });

  it('mehrere Sturm-Tage produzieren mehrere Alerts', () => {
    const f = makeForecast([
      { windSpeedMax: 60 },
      { windSpeedMax: 55 },
      { windSpeedMax: 20 },
      { windSpeedMax: 65 },
      { windSpeedMax: 20 },
      { windSpeedMax: 20 },
      { windSpeedMax: 20 },
    ]);
    const alerts = generateAlerts(f);
    const sturm = alerts.filter((a) => a.code === 'sturm');
    expect(sturm).toHaveLength(3);
    expect(sturm.map((a) => a.dayIndex)).toEqual([0, 1, 3]);
  });
});

// ---------------------------------------------------------------------------
// 2) EXTREMREGEN — prob > 80% UND mm > 5
// ---------------------------------------------------------------------------
describe('weatherAlertsService - EXTREMREGEN', () => {
  it('erzeugt WARNUNG wenn prob > 80% UND sum > 5mm', () => {
    const f = makeForecast([
      { precipitationProbability: 90, precipitationSum: 12 },
    ]);
    const alerts = generateAlerts(f);
    const extrem = alerts.filter((a) => a.code === 'extremregen');
    expect(extrem).toHaveLength(1);
    expect(extrem[0].severity).toBe<AlertSeverity>('warning');
    expect(extrem[0].metric?.value).toBe('12.0');
  });

  it('KEIN alarm wenn prob hoch aber mm niedrig', () => {
    const f = makeForecast([
      { precipitationProbability: 95, precipitationSum: 2 },
    ]);
    const alerts = generateAlerts(f);
    expect(alerts.filter((a) => a.code === 'extremregen')).toHaveLength(0);
  });

  it('KEIN alarm wenn mm hoch aber prob niedrig', () => {
    const f = makeForecast([
      { precipitationProbability: 60, precipitationSum: 20 },
    ]);
    const alerts = generateAlerts(f);
    expect(alerts.filter((a) => a.code === 'extremregen')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3) DAUERREGEN — Greedy Contiguous-Span Detection
// ---------------------------------------------------------------------------
describe('weatherAlertsService - DAUERREGEN', () => {
  it('erzeugt INFO-alert wenn 3 Tage in Folge > 5mm (mit endDayIndex=2)', () => {
    const f = makeForecast([
      { precipitationSum: 6 },
      { precipitationSum: 8 },
      { precipitationSum: 7 },
      { precipitationSum: 2 },
      { precipitationSum: 0 },
      { precipitationSum: 0 },
      { precipitationSum: 0 },
    ]);
    const alerts = generateAlerts(f);
    const dauer = alerts.filter((a) => a.code === 'dauerregen');
    expect(dauer).toHaveLength(1);
    expect(dauer[0].severity).toBe<AlertSeverity>('info');
    expect(dauer[0].dayIndex).toBe(0);
    expect(dauer[0].endDayIndex).toBe(2);
    expect(dauer[0].metric?.value).toBe('21.0'); // 6+8+7 = 21
  });

  it('KEIN dauerregen-alarm wenn nur 2 Tage in Folge nass', () => {
    const f = makeForecast([
      { precipitationSum: 6 },
      { precipitationSum: 8 },
      { precipitationSum: 2 },
      { precipitationSum: 2 },
      { precipitationSum: 0 },
      { precipitationSum: 0 },
      { precipitationSum: 0 },
    ]);
    const alerts = generateAlerts(f);
    expect(alerts.filter((a) => a.code === 'dauerregen')).toHaveLength(0);
  });

  it('Greedy-Span: 7 nasse Tage produzieren 1 Alert mit endDayIndex=6', () => {
    // Vorher (sliding-window): 5 alerts overlapping.
    // Jetzt (greedy contiguous run): 1 alert fuer die ganze Sequenz.
    const f = makeForecast([
      { precipitationSum: 6 },
      { precipitationSum: 6 },
      { precipitationSum: 6 },
      { precipitationSum: 6 },
      { precipitationSum: 6 },
      { precipitationSum: 6 },
      { precipitationSum: 6 },
    ]);
    const alerts = generateAlerts(f);
    const dauer = alerts.filter((a) => a.code === 'dauerregen');
    expect(dauer).toHaveLength(1);
    expect(dauer[0].dayIndex).toBe(0);
    expect(dauer[0].endDayIndex).toBe(6);
    expect(dauer[0].metric?.value).toBe('42.0'); // 6 * 7 = 42
  });

  it('zwei separate nasse Sequenzen erzeugen zwei separate Alerts', () => {
    const f = makeForecast([
      { precipitationSum: 6 }, // Run 1 start
      { precipitationSum: 6 },
      { precipitationSum: 6 },
      { precipitationSum: 6 }, // Run 1 end (4 Tage)
      { precipitationSum: 0 }, // Gap
      { precipitationSum: 7 }, // Run 2 start
      { precipitationSum: 7 },
      { precipitationSum: 7 }, // Run 2 end (3 Tage)
    ]);
    const alerts = generateAlerts(f);
    const dauer = alerts.filter((a) => a.code === 'dauerregen');
    expect(dauer).toHaveLength(2);
    expect(dauer[0].dayIndex).toBe(0);
    expect(dauer[0].endDayIndex).toBe(3);
    expect(dauer[1].dayIndex).toBe(5);
    expect(dauer[1].endDayIndex).toBe(7);
  });

  it('Tail-Handling: 3 nasse Tage am Ende des 7-Tage-Arrays', () => {
    const f = makeForecast([
      { precipitationSum: 0 },
      { precipitationSum: 0 },
      { precipitationSum: 0 },
      { precipitationSum: 0 },
      { precipitationSum: 6 }, // Tail-Run start
      { precipitationSum: 6 },
      { precipitationSum: 6 }, // Tail-Run end
    ]);
    const alerts = generateAlerts(f);
    const dauer = alerts.filter((a) => a.code === 'dauerregen');
    expect(dauer).toHaveLength(1);
    expect(dauer[0].dayIndex).toBe(4);
    expect(dauer[0].endDayIndex).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// 4) NO ALERT — normales Wetter
// ---------------------------------------------------------------------------
describe('weatherAlertsService - NO ALERT', () => {
  it('normales Sommer-Wetter produziert 0 alerts', () => {
    const f = makeForecast([
      { windSpeedMax: 15, precipitationProbability: 10, precipitationSum: 0 },
      { windSpeedMax: 12, precipitationProbability: 20, precipitationSum: 0.5 },
      { windSpeedMax: 18, precipitationProbability: 30, precipitationSum: 1 },
      { windSpeedMax: 20, precipitationProbability: 25, precipitationSum: 0.2 },
      { windSpeedMax: 22, precipitationProbability: 15, precipitationSum: 0 },
      { windSpeedMax: 16, precipitationProbability: 40, precipitationSum: 2 },
      { windSpeedMax: 14, precipitationProbability: 20, precipitationSum: 0 },
    ]);
    const alerts = generateAlerts(f);
    expect(alerts).toEqual(noAlertsExpected);
  });

  it('leeres daily-Array produziert 0 alerts', () => {
    const f = makeForecast([]);
    expect(generateAlerts(f)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5) SORTIERUNG — DayIndex zuerst, dann Severity
// ---------------------------------------------------------------------------
describe('weatherAlertsService - SORTIERUNG', () => {
  it('alerts werden nach dayIndex dann severity sortiert', () => {
    const f = makeForecast([
      // Tag 0: nur extremregen (warning)
      { precipitationProbability: 90, precipitationSum: 10 },
      // Tag 1: sturm (danger) — sollte VOR extremregen-warning kommen, aber NACH tag0
      { windSpeedMax: 60 },
      // Tag 2: nichts
      {},
      // Tag 3: extremregen + sturm (danger+warning) zusammen
      { precipitationProbability: 95, precipitationSum: 15, windSpeedMax: 70 },
      {},
      {},
      {},
    ]);
    const alerts = generateAlerts(f);
    // Erwartete Reihenfolge: tag0-extremregen(warning), tag1-sturm(danger), tag3-sturm(danger), tag3-extremregen(warning)
    expect(alerts.map((a) => `${a.code}@${a.dayIndex}`)).toEqual([
      'extremregen@0',
      'sturm@1',
      'sturm@3',
      'extremregen@3',
    ]);
  });
});

// ---------------------------------------------------------------------------
// 6) SAME DAY — STURM + EXTREMREGEN gleichzeitig möglich
// ---------------------------------------------------------------------------
describe('weatherAlertsService - Multiple Alerts Same Day', () => {
  it('gleicher Tag kann mehrere Alerts haben wenn mehrere Regeln feuern', () => {
    const f = makeForecast([
      {
        windSpeedMax: 60,
        precipitationProbability: 90,
        precipitationSum: 12,
      },
    ]);
    const alerts = generateAlerts(f);
    const codes = alerts.map((a) => a.code).sort();
    expect(codes).toEqual<AlertCode[]>(['extremregen', 'sturm']);
  });
});
