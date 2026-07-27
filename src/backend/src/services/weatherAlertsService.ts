// ---------------------------------------------------------------------------
// weatherAlertsService — Rule-Engine fuer Unwetter-Früherkennung
//
// Phase E Forecast-Schicht (UEBER weatherService Anzeigen):
//   - Nimmt WeatherData-Input entgegen (kein doppelter Open-Meteo-Fetch,
//     erbt 5-Min Cache aus weatherService).
//   - Reine Rule-Engine: STURM + EXTREMREGEN + DAUERREGEN.
//   - On-device-tauglich im Geist (Rule-Engine statt Cloud-AI).
//   - Severity-Mapping: STURM=DANGER, EXTREMREGEN=WARNING, DAUERREGEN=INFO.
//
// Pure Function: keine Seiteneffekte, kein State, kein Logging.
// ---------------------------------------------------------------------------

import type { WeatherData } from './weatherService';

export type AlertCode = 'sturm' | 'extremregen' | 'dauerregen';
export type AlertSeverity = 'info' | 'warning' | 'danger';

export interface WeatherAlert {
  /** Eindeutiger Code, identifiziert die Regel die ihn ausgeloest hat */
  code: AlertCode;
  /** Visuelle Severity — UI mappt auf Farbe (info=blau, warning=orange, danger=rot) */
  severity: AlertSeverity;
  /** Kurze Schlagzeile (max 60 Zeichen) */
  title: string;
  /** Erklaerender Text mit konkretem Wert (z.B. "Wind-Spitzen bis 65 km/h erwartet") */
  message: string;
  /** Start-Tag im 7-Tage-Forecast (0=heute, 6=in einer Woche) */
  dayIndex: number;
  /**
   * Optionaler End-Tag fuer Range-Spans (z.B. Dauerregen Tag 1-4).
   * Wenn undefined, gilt dayIndex als Single-Day-Alert.
   * Inclusive-Bounds: endDayIndex >= dayIndex.
   */
  endDayIndex?: number;
  /** Optionaler Messwert zur Anzeige im Banner (z.B. "65 km/h Wind-Spitze") */
  metric?: { label: string; value: string; unit: string };
}

// ---------------------------------------------------------------------------
// Schwellenwerte: hand-tuned, NICHT ML-gelernt.
//
// WICHTIG — Preview-Level, NICHT offizielle DWD-Warnschwellen!
//   - STURM 50 km/h   → offiziell Sturmwarnung erst 62–74 km/h (Bft 8).
//     Wir warnen FRUEHER als DWD, weil user-side Preview besser ist als
//     nichts und der Sturm-Wert als CONVENIENCE-Feature, nicht als
//     Notfall-Disclaimer kommuniziert wird.
//   - EXTREMREGEN 80% + 5mm  → underhalb DWD-Markante-Regen-Warnung (25 mm).
//     Ab dieser Kombi ist mit typischerweise unguenstigen Bedingungen
//     zu rechnen (Niederschlagsmenge + Wahrscheinlichkeit).
//   - DAUERREGEN 3 Tage * 5mm  → in etwa DWD's Dauerregen-Warnstufe.
// AI-Architektur.md §Phase 1 ersetzt diese Werte spaeter durch ein
// trainiertes Modell (LightGBM auf historischen DWD-Daten). Pattern
// bleibt: hand-tuned thresholds werden zu ML-Output-Score-Mapping.
// ---------------------------------------------------------------------------
const WIND_STURM_KMH = 50;
const EXTREMREGEN_PROB_PROZENT = 80;
const EXTREMREGEN_MM = 5;
const DAUERREGEN_TAGE = 3;
const DAUERREGEN_MM_THRESHOLD = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formatiert Datum fuer Alert-Message. Verwendet toLocaleDateString mit
 * de-DE-Locale (TZ-aware, korrekt fuer alle Browser-Zeitzonen Out-of-the-box).
 *
 * Output-Format: "Mo, 28.07." (Wochentag kurz + Tag.Monat inkl. Punkt)
 */
function formatDayLabel(dateIso: string): string {
  try {
    const parts = dateIso.split('-');
    if (parts.length < 3) return dateIso;
    const dt = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10)
    );
    return dt.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return dateIso;
  }
}

/**
 * Formatiert eine Range von zusammenhängenden Tagen.
 * Beispiel: gleicher Tag -> "Mo, 28.07.", mehrere Tage -> "Mo, 28.–Mi, 30.07."
 */
function formatDayRange(startIso: string, endIso: string): string {
  const start = formatDayLabel(startIso);
  const end = formatDayLabel(endIso);
  if (startIso === endIso) return start;
  // "Mo, 28.07." -> "Mo, 28" + ",07."
  const startShort = start.split(',')[0] + ', ' + start.split(',')[1].trim().split('.')[0];
  return `${startShort}\u2013${end}`;
}

// ---------------------------------------------------------------------------
// DAUERREGEN — Greedy Contiguous-Run Detection
//
// Single-Source-of-Truth: Wenn 7 Tage in Folge nass sind, produzieren wir 1
// Alert mit endDayIndex=6 statt 5 sliding-window Alerts. UI zeigt dann nur
// EIN Banner: "Dauerregen Mo–So: X mm" statt 5 gestapelter Banner.
// ---------------------------------------------------------------------------

interface DauerregenSpan {
  startIdx: number;
  endIdx: number;
  totalMm: number;
}

function detectDauerregenSpans(
  daily: WeatherData['daily']
): DauerregenSpan[] {
  const spans: DauerregenSpan[] = [];
  let runStart = -1;
  let runTotal = 0;

  for (let i = 0; i < daily.length; i++) {
    if (daily[i].precipitationSum > DAUERREGEN_MM_THRESHOLD) {
      if (runStart === -1) {
        runStart = i;
        runTotal = 0;
      }
      runTotal += daily[i].precipitationSum;
    } else {
      // Run ended. Emit SPAN if long enough.
      if (runStart !== -1 && i - runStart >= DAUERREGEN_TAGE) {
        spans.push({
          startIdx: runStart,
          endIdx: i - 1,
          totalMm: runTotal,
        });
      }
      runStart = -1;
      runTotal = 0;
    }
  }
  // Tail handling: Run bis zum Ende des Arrays.
  if (runStart !== -1 && daily.length - runStart >= DAUERREGEN_TAGE) {
    spans.push({
      startIdx: runStart,
      endIdx: daily.length - 1,
      totalMm: runTotal,
    });
  }

  return spans;
}

// ---------------------------------------------------------------------------
// generateAlerts — Premium Public API
// ---------------------------------------------------------------------------

/**
 * Erzeugt eine sortierte Liste von Alerts aus einem 7-Tage-Forecast.
 *
 * Sortierung: erst nach DayIndex (heute zuerst), dann nach Severity (DANGER > WARNING > INFO).
 *
 * Wichtig: KEIN doppelter Open-Meteo-Fetch. Der Aufrufer (Express-Route)
 * hat bereits weatherService.getWeather() aufgerufen (mit 5-Min Cache)
 * und reicht das Ergebnis hier durch.
 */
export function generateAlerts(forecast: WeatherData): WeatherAlert[] {
  if (!forecast || !forecast.daily || forecast.daily.length === 0) {
    return [];
  }

  const alerts: WeatherAlert[] = [];

  // ---------------------------------------------------------------------
  // Regel 1: STURM — Wind-Spitzen ueberschreiten Schwelle
  // Pro Tag eigener Alert (mehrere Sturm-Tage = mehrere Alerts).
  // ---------------------------------------------------------------------
  forecast.daily.forEach((d, idx) => {
    if (d.windSpeedMax > WIND_STURM_KMH) {
      alerts.push({
        code: 'sturm',
        severity: 'danger',
        title: 'Sturm erwartet',
        message: `${formatDayLabel(d.date)}: Wind-Spitzen bis ${d.windSpeedMax.toFixed(0)} km/h. Lose Gegenstände sichern, Aufenthalt im Freien meiden.`,
        dayIndex: idx,
        metric: {
          label: 'Wind-Spitze',
          value: d.windSpeedMax.toFixed(0),
          unit: 'km/h',
        },
      });
    }
  });

  // ---------------------------------------------------------------------
  // Regel 2: EXTREMREGEN — Kombination aus Probability UND Menge
  //
  // WICHTIG: AND-Kombi (Begründung):
  //   - Probability > 80% allein wuerde auch bei Nieselregen feuern.
  //   - Nieselregen mit hoher Regenwahrscheinlichkeit ist aber kein
  //     user-relevantes Unwetter-Event.
  //   - Beides zusammen = "signifikanter Regen wahrscheinlich" ist die
  //     sinnvolle Definition fuer EXTREMREGEN.
  //   - Falls diese Logik spaeter zu OR geaendert wird: das ist eine
  //     bewusste Entscheidung und sollte kommentiert werden.
  // ---------------------------------------------------------------------
  forecast.daily.forEach((d, idx) => {
    if (
      d.precipitationProbability > EXTREMREGEN_PROB_PROZENT &&
      d.precipitationSum > EXTREMREGEN_MM
    ) {
      alerts.push({
        code: 'extremregen',
        severity: 'warning',
        title: 'Starkregen wahrscheinlich',
        message: `${formatDayLabel(d.date)}: ${d.precipitationProbability.toFixed(0)}% Regen-Wahrscheinlichkeit, ${d.precipitationSum.toFixed(1)} mm erwartet. Überflutungen in tiefer gelegenen Strassen möglich.`,
        dayIndex: idx,
        metric: {
          label: 'Niederschlag',
          value: d.precipitationSum.toFixed(1),
          unit: 'mm',
        },
      });
    }
  });

  // ---------------------------------------------------------------------
  // Regel 3: DAUERREGEN — Greedy Contiguous-Run Detection
  //
  // NICHT Sliding-Window: 7 nasse Tage produzieren EINEN Alert mit
  // endDayIndex=start+6, NICHT 5 überlappende Alerts. UI rendert
  // dann ein einziges Banner ("Dauerregen Mo-So").
  // ---------------------------------------------------------------------
  for (const span of detectDauerregenSpans(forecast.daily)) {
    alerts.push({
      code: 'dauerregen',
      severity: 'info',
      title: 'Anhaltender Regen',
      message: `${formatDayRange(forecast.daily[span.startIdx].date, forecast.daily[span.endIdx].date)}: ${span.endIdx - span.startIdx + 1} Tage in Folge mit jeweils über ${DAUERREGEN_MM_THRESHOLD} mm. Gesamt ${span.totalMm.toFixed(1)} mm. Boden könnte aufgeweicht sein.`,
      dayIndex: span.startIdx,
      endDayIndex: span.endIdx,
      metric: {
        label: `Summe (${span.endIdx - span.startIdx + 1} Tage)`,
        value: span.totalMm.toFixed(1),
        unit: 'mm',
      },
    });
  }

  // ---------------------------------------------------------------------
  // Sortierung: DayIndex (heute zuerst) > Severity (DANGER > WARNING > INFO)
  // ---------------------------------------------------------------------
  const severityRank: Record<AlertSeverity, number> = {
    danger: 0,
    warning: 1,
    info: 2,
  };
  alerts.sort((a, b) => {
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
    return severityRank[a.severity] - severityRank[b.severity];
  });

  return alerts;
}
