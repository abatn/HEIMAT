// ---------------------------------------------------------------------------
// triageRulesService.ts — Deterministische Triage-Regeln (kein LLM!)
//
//ZWECK: Symptom-Text → Triage-Level (NOTFALL/BEREITSCHAFT/ROUTINE)
//       OHNE Halluzinationen, OHNE LLM, OHNE Cloud-AI.
//
//ARCHITEKTUR:
//   1. Keyword-basierte Erkennung (schnell, <1ms)
//   2. ICD-11 Code-Mapping (falls von WHO ICD-API geliefert)
//   3. Kombination aus beiden fuer bestes Ergebnis
//
//REGELN basierend auf DEGAM-Leitlinien und medizinischer Literatur:
//   - NOTFALL (112): Lebensbedrohliche Symptome
//   - BEREITSCHAFT (116117): Schwere Symptome, die aerztliche Behandlung brauchen
//   - ROUTINE (Hausarzt): Leichte bis maessige Symptome
//
//HAFTUNG: "Keine medizinische Diagnose. Bei Unsicherheit 112 waehlen."
// ---------------------------------------------------------------------------

import { logger } from '../utils/logger';

export type TriageLevel = 'NOTFALL' | 'BEREITSCHAFT' | 'ROUTINE';

export interface TriageResult {
  /** Triage-Stufe */
  level: TriageLevel;
  /** Notfall-Nummer (112, 116117, oder Telefonnummer des Hausarztes) */
  phoneNumber: string;
  /** Kurze Empfehlung */
  recommendation: string;
  /** Gefundene ICD-11 Codes (falls vorhanden) */
  icdCodes: string[];
  /** Verwendete Keywords fuer die Entscheidung */
  matchedKeywords: string[];
  /** Konfidenz (0-1, hoeher = sicherer) */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Keyword-Listen fuer Triage-Entscheidungen
//
// Reihenfolge: NOTFALL zuerst (höchste Prioritaet), dann BEREITSCHAFT,
// dann ROUTINE als Fallback.
// ---------------------------------------------------------------------------

/** NOTFALL-Keywords → sofort 112 anrufen */
const NOTFALL_KEYWORDS: Array<[string[], string]> = [
  // Brust/Kreislauf
  [['brustschmerz', 'brustschmerzen', 'brustenge', 'herzinfarkt', 'herzrhythmus', 'herzklopfen', 'blutdruck abgefallen', 'kreislauf zusammenbricht'], 'Herz-/Kreislauf-Notfall'],
  [['atemnot', 'atmung nicht moeglich', 'erstick', 'luftröhre verengt', 'pneumothorax'], 'Atemwegs-Notfall'],
  [['bewusstlos', 'bewusstsein verloren', 'ohnmacht', 'nicht ansprechbar', 'koma'], 'Bewusstseinsstoerung'],
  [['schlaganfall', 'gesicht laehmung', 'gesichtslähmung', 'arm laehmung', 'armlähmung', 'sprache stoerung', 'sprachstörung', 'halbseitig laehmung', 'halbseitige lähmung', 'halbseitig gelähmt'], 'Schlaganfall-Verdacht'],
  [['blutung', 'starke blutung', 'blut verliert', 'arterielle blutung', 'nach unfall blut'], 'Starke Blutung'],
  [['krampf', 'anfall', 'epilepsie', 'grand mal', 'tonisch-klonisch'], 'Krampfanfall'],
  [['anaphylaxie', 'anaphylaktisch', 'schwellung hals', 'schwellung gesicht', 'bienenstich allergie'], 'Anaphylaxie'],
  [['suizid', 'selbstmord', 'leben beenden', 'nicht mehr leben wollen'], 'Psychiatrischer Notfall'],
  [['vergiftung', 'tabletten ueberdosis', 'chemikalien', 'einatmen giftig'], 'Vergiftung'],
  [['unfall', 'sturz hoch', 'kopfverletzung', 'schadelbruch', 'wirbelsaeule'], 'Schwerer Unfall'],
];

/** BEREITSCHAFT-Keywords → 116117 (aerztlicher Bereitschaftsdienst) */
const BEREITSCHAFT_KEYWORDS: Array<[string[], string]> = [
  [['fieber', 'temperatur', '39', '40', 'hohe temperatur', 'schüttelfrost'], 'Fieber (hohe Temperatur)'],
  [['starker schmerz', 'schmerzen 7', 'schmerzen 8', 'schmerzen 9', 'schmerzen 10', 'uneraschlich'], 'Starke Schmerzen'],
  [['durchfall stark', 'durchfall blutig', 'blutiger durchfall', 'blut im stuhl', 'erbrechen blut', 'erbrechen stark', 'dehydriert'], 'Magen-Darm (schwer)'],
  [['infektion', 'eiter', 'wunde entzuendet', 'roter strich', 'limphgefaessentzuendung'], 'Infektion (entzuendet)'],
  [['kopfschmerz stark', 'migraene', 'kopfschmerz nicht weg', 'klafterkopfschmerz'], 'Starke Kopfschmerzen'],
  [['rueckenschmerz stark', 'wirbelsaeule schmerz', 'ischiasschmerz', 'hexenschuss'], 'Starke Rueckenschmerzen'],
  [['husten blut', 'bluthusten', 'husten seit wochen', 'nachtshusten'], 'Husten (auffaellig)'],
  [['ausschlag stark', 'quaddeln', 'nesselausschlag', 'pusteln'], 'Hautausschlag (schwer)'],
  [['schwindel stark', 'schwindel anhaltend', 'drehschwindel', 'unsicher gang'], 'Schwindel (schwer)'],
];

// ---------------------------------------------------------------------------
// ICD-11 Code → Triage-Level Mapping
//
// basierend auf DEGAM-Leitlinien und ICD-11 Kapitel:
//   - Kapitel 21: Symptome (R00-R99)
//   - Kapitel 11: Krankheiten des Kreislaufsystems
//   - Kapitel 12: Krankheiten des Atemwegssystems
// ---------------------------------------------------------------------------

const ICD11_TRIAGE_MAP: Record<string, TriageLevel> = {
  // === NOTFALL (112) ===
  'R07.9': 'NOTFALL',   // Brustschmerz, nicht naeher bezeichnet
  'R06.0': 'NOTFALL',   // Atemnot
  'R06.8': 'NOTFALL',   // Sonstige Atemstoerungen (schwer)
  'R40.2': 'NOTFALL',   // Bewusstlosigkeit, nicht naeher bezeichnet
  'I63.9': 'NOTFALL',   // Schlaganfall
  'I21.9': 'NOTFALL',   // Akuter Myokardinfarkt
  'I44.1': 'NOTFALL',   // AV-Block 2. oder 3. Grades
  'T78.2': 'NOTFALL',   // Anaphylaktischer Schock
  'T78.3': 'NOTFALL',   // Angioedem
  'R04.2': 'NOTFALL',   // Hustaussaat (Blut)
  'I26.9': 'NOTFALL',   // Lungenembolie
  'R09.0': 'NOTFALL',   // Erstickung
  'S06.0': 'NOTFALL',   // Schaedel-Hirn-Trauma

  // === BEREITSCHAFT (116117) ===
  'R50.9': 'BEREITSCHAFT',  // Fieber, nicht naeher bezeichnet
  'R51': 'BEREITSCHAFT',    // Kopfschmerzen
  'R51.9': 'BEREITSCHAFT',  // Kopfschmerzen, nicht naeher bezeichnet
  'M54.5': 'BEREITSCHAFT',  // Kreuzschmerzen
  'M54.4': 'BEREITSCHAFT',  // Lumbago mit Ischias
  'K52.9': 'BEREITSCHAFT',  // Nicht-infekioese Gastritis/Darmentzuendung
  'A09': 'BEREITSCHAFT',    // Infektioese Gastritis/Darmentzuendung
  'J06.9': 'BEREITSCHAFT',  // Akute Infektion der oberen Atemwege
  'L03.9': 'BEREITSCHAFT',  // Cellulitis (Hautinfektion)
  'H10.9': 'BEREITSCHAFT',  // Konjunktivitis
  'N39.0': 'BEREITSCHAFT',  // Harnwegsinfektion
  'M79.3': 'BEREITSCHAFT',  // Pannikulitis (schmerzhafte Entzuendung)

  // === ROUTINE (Hausarzt) ===
  'J00': 'ROUTINE',     // Akute Rhinopharyngitis (Erkaeltung)
  'J02.9': 'ROUTINE',   // Pharyngitis akut
  'J20.9': 'ROUTINE',   // Bronchitis akut
  'K21.0': 'ROUTINE',   // Gastro-oesophagealer Reflux
  'K58.9': 'ROUTINE',   // Reizdarmsyndrom
  'L30.9': 'ROUTINE',   // Ekzem, nicht naeher bezeichnet
  'L20.9': 'ROUTINE',   // Neurodermitis
  'M79.0': 'ROUTINE',   // Rheumatoide Myalgie
  'H65.9': 'ROUTINE',   // Otitis media
  'N20.0': 'ROUTINE',   // Nierenstein
  'M17.9': 'ROUTINE',   // Gonarthrose (Kniegelenkarthrose)
  'E11.9': 'ROUTINE',   // Diabetes mellitus Typ 2
};

/**
 * Bewertet einen Symptom-Text und liefert ein Triage-Ergebnis.
 *
 * Strategie:
 *   1. Keyword-basierte Suche (schnell, deterministisch)
 *   2. ICD-11 Code-Mapping (falls verfuegbar)
 *   3. Kombination: Keyword-Ergebnis hat Vorrang bei hohem Konfidenz-Score
 *
 * @param symptomText  Freitext-Symptom des Users
 * @param icdCodes     Optionale ICD-11 Codes von WHO ICD-API
 * @returns            TriageResult mit Level, Empfehlung und Konfidenz
 */
export function evaluateTriage(
  symptomText: string,
  icdCodes: string[] = [],
): TriageResult {
  const lowerText = symptomText.toLowerCase();
  const matchedKeywords: string[] = [];
  let bestLevel: TriageLevel = 'ROUTINE'; // Default: Hausarzt
  let bestConfidence = 0.3; // Niedrige Basis-Konfidenz
  let bestRecommendation = 'Ruhe bewahren und Hausarzt aufsuchen.';

  // --- Schritt 1: Keyword-basierte Triage ---
  for (const [keywords, description] of NOTFALL_KEYWORDS) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        matchedKeywords.push(keyword);
        if (bestLevel !== 'NOTFALL') {
          bestLevel = 'NOTFALL';
          bestConfidence = 0.9;
          bestRecommendation = `Sofort 112 anrufen! ${description}`;
        }
        break;
      }
    }
  }

  // Nur BEREITSCHAFT pruefen wenn noch kein NOTFALL gefunden
  if (bestLevel !== 'NOTFALL') {
    for (const [keywords, description] of BEREITSCHAFT_KEYWORDS) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          matchedKeywords.push(keyword);
          if (bestLevel !== 'BEREITSCHAFT') {
            bestLevel = 'BEREITSCHAFT';
            bestConfidence = 0.7;
            bestRecommendation = `Aerztlicher Bereitschaftsdienst: 116117. ${description}`;
          }
          break;
        }
      }
    }
  }

  // --- Schritt 2: ICD-11 Code-Mapping ---
  for (const code of icdCodes) {
    const triageLevel = ICD11_TRIAGE_MAP[code];
    if (triageLevel) {
      matchedKeywords.push(`ICD:${code}`);
      // ICD-Mapping hat hoehere Konfidenz als reine Keywords
      if (triageLevel === 'NOTFALL' || (triageLevel === 'BEREITSCHAFT' && bestLevel !== 'NOTFALL')) {
        bestLevel = triageLevel;
        bestConfidence = 0.85;
        bestRecommendation = triageLevel === 'NOTFALL'
          ? `Sofort 112 anrufen! (ICD-11: ${code})`
          : `Aerztlicher Bereitschaftsdienst: 116117 (ICD-11: ${code})`;
      }
    }
  }

  // --- Schritt 3: Phone-Number bestimmen ---
  const phoneNumber = bestLevel === 'NOTFALL' ? '112'
    : bestLevel === 'BEREITSCHAFT' ? '116117'
    : 'Hausarzt';

  logger.info(`Triage: "${symptomText.substring(0, 50)}..." → ${bestLevel} (Konfidenz: ${bestConfidence})`);

  return {
    level: bestLevel,
    phoneNumber,
    recommendation: bestRecommendation,
    icdCodes,
    matchedKeywords,
    confidence: bestConfidence,
  };
}

/**
 * Formatiert das Triage-Ergebnis als Text fuer den System-Prompt.
 * Wird von ollamaService genutzt um Ollama Kontext zu geben.
 */
export function formatTriageForPrompt(result: TriageResult): string {
  const emoji = result.level === 'NOTFALL' ? '🔴'
    : result.level === 'BEREITSCHAFT' ? '🟡'
    : '🟢';

  return [
    `\n## TRIAGE-ERGEBNIS (deterministisch, kein LLM)`,
    `${emoji} **Stufe: ${result.level}**`,
    `📞 **Tel: ${result.phoneNumber}**`,
    `💡 ${result.recommendation}`,
    result.icdCodes.length > 0 ? `🏥 ICD-11: ${result.icdCodes.join(', ')}` : '',
    `📊 Konfidenz: ${Math.round(result.confidence * 100)}%`,
  ].filter(Boolean).join('\n');
}

export const triageRulesService = {
  evaluateTriage,
  formatTriageForPrompt,
};
