// mentalHealthService.ts — Mental Health Agent (PHQ-9 + Ollama Hybrid)
//
// ZWECK: Depressions-Screening mit standardisiertem PHQ-9 Instrument
//        + Ollama-gestützter vertiefte Analyse
//
// ARCHITEKTUR:
//   1. PHQ-9 Screening (9 Fragen, Score 0-27)
//   2. Deterministische Score-Bewertung
//   3. Optional: Ollama für vertiefte Analyse (bei Score >9)

import { query, queryOne } from '../config/database';
import { ollamaService } from './ollamaService';

// ============================================================================
// Types
// ============================================================================

export interface Phq9Answers {
  q1_lustlos: number;          // Wenig Interesse oder Freude
  q2_niedergeschlagen: number; // Niedergeschlagen/hoffnungslos
  q3_schlafprobleme: number;   // Schlafprobleme
  q4_muedigkeit: number;       // Müdigkeit/keine Energie
  q5_appetit: number;          // Schlechter Appetit/Überessen
  q6_schlecht: number;         // Schlecht über sich selbst
  q7_konzentration: number;    // Schwer sich zu konzentrieren
  q8_bewegung: number;         // Langsam/unruhig bewegt
  q9_selbstverletzung: number; // Gedanken sich etwas anzutun
}

export interface Phq9Result {
  id: string;
  user_id: string;
  answers: Phq9Answers;
  total_score: number;
  severity: 'leicht' | 'mittel' | 'schwer' | 'sehr_schwer';
  ai_analysis?: string;
  ai_recommendation?: string;
  created_at: string;
}

export interface Phq9Stats {
  total_assessments: number;
  average_score: number;
  last_assessment?: Phq9Result;
  trend: 'verbesserung' | 'stabil' | 'verschlechterung';
  risk_level: 'niedrig' | 'mittel' | 'hoch';
}

// ============================================================================
// PHQ-9 Fragen (standardisiert)
// ============================================================================

export const PHQ9_QUESTIONS = [
  {
    id: 'q1',
    question: 'Wenig Interesse oder Freude an Dingen, die Sie normalerweise gerne machen',
    field: 'q1_lustlos' as keyof Phq9Answers,
  },
  {
    id: 'q2',
    question: 'Niedergeschlagen, hoffnungslos oder verzweifelt',
    field: 'q2_niedergeschlagen' as keyof Phq9Answers,
  },
  {
    id: 'q3',
    question: 'Schwierigkeiten, ein- oder durchzuschlafen',
    field: 'q3_schlafprobleme' as keyof Phq9Answers,
  },
  {
    id: 'q4',
    question: 'Müde oder kaum Energie',
    field: 'q4_muedigkeit' as keyof Phq9Answers,
  },
  {
    id: 'q5',
    question: 'Schlechter Appetit oder Überessen',
    field: 'q5_appetit' as keyof Phq9Answers,
  },
  {
    id: 'q6',
    question: 'Schlecht über sich selbst — oder das Gefühl, ein Versager zu sein',
    field: 'q6_schlecht' as keyof Phq9Answers,
  },
  {
    id: 'q7',
    question: 'Schwer, sich auf Dinge zu konzentrieren, z.B. beim Lesen oder Fernsehen',
    field: 'q7_konzentration' as keyof Phq9Answers,
  },
  {
    id: 'q8',
    question: 'So langsam oder unruhig, dass es anderen aufgefallen ist — oder das Gegenteil',
    field: 'q8_bewegung' as keyof Phq9Answers,
  },
  {
    id: 'q9',
    question: 'Daran gedacht, sich selbst weh zu tun oder sich etwas anzutun',
    field: 'q9_selbstverletzung' as keyof Phq9Answers,
  },
];

export const PHQ9_SCALE = [
  { value: 0, label: 'Überhaupt nicht' },
  { value: 1, label: 'An einzelnen Tagen' },
  { value: 2, label: 'Mehr als die Hälfte der Tage' },
  { value: 3, label: 'Fast jeden Tag' },
];

// ============================================================================
// Score-Bewertung
// ============================================================================

export function calculateSeverity(score: number): Phq9Result['severity'] {
  if (score <= 4) return 'leicht';
  if (score <= 9) return 'leicht';
  if (score <= 14) return 'mittel';
  if (score <= 19) return 'schwer';
  return 'sehr_schwer';
}

export function getSeverityLabel(severity: string): string {
  switch (severity) {
    case 'leicht': return 'Keine/Minimal Depression';
    case 'mittel': return 'Leichte Depression';
    case 'schwer': return 'Mittelschwere Depression';
    case 'sehr_schwer': return 'Schwere Depression';
    default: return 'Unbekannt';
  }
}

export function getRecommendation(score: number, severity: string): string {
  if (score <= 4) {
    return 'Keine Behandlung nötig. Bei Bedarf erneutes Screening in 2-4 Wochen.';
  }
  if (score <= 9) {
    return 'Leichtes Syndrom. Beobachten Sie sich. Bei Verschlechterung → Hausarzt.';
  }
  if (score <= 14) {
    return 'Depressive Störung empfiehlt Behandlung: Psychotherapie und/oder Medikamentöse Therapie.';
  }
  if (score <= 19) {
    return 'Mittelschwere depressive Störung. Intensivierte Behandlung empfohlen. Bitte suchen Sie einen Arzt/Psychotherapeuten auf.';
  }
  // Score 20-27
  return 'Schwere depressive Störung. Sofortige psychiatrische Behandlung empfohlen. Bei suizidalen Gedanken: Notfallnummer 112 oder Telefonseelsorge 0800 111 0 111.';
}

// ============================================================================
// Service
// ============================================================================

export class MentalHealthService {

  // -------------------------------------------------------------------------
  // PHQ-9 Screening durchführen
  // -------------------------------------------------------------------------
  async createPhq9Assessment(
    userId: string,
    answers: Phq9Answers,
    additionalNotes?: string,
    location?: { lat: number; lng: number }
  ): Promise<Phq9Result> {
    // Validierung
    const values = Object.values(answers);
    if (values.length !== 9) {
      throw new Error('PHQ-9 erfordert genau 9 Antworten');
    }
    if (values.some(v => v < 0 || v > 3 || !Number.isInteger(v))) {
      throw new Error('Jede Antwort muss zwischen 0 und 3 liegen');
    }

    // Warnung bei suizidalen Gedanken (Frage 9)
    if (answers.q9_selbstverletzung >= 1) {
      console.warn(`[MENTAL-HEALTH] ACHTUNG: User ${userId} hat Frage 9 (Selbstverletzung) >= 1`);
    }

    const totalScore = values.reduce((sum, v) => sum + v, 0);
    const severity = calculateSeverity(totalScore);
    const recommendation = getRecommendation(totalScore, severity);

    // Optional: Ollama-Analyse bei Score > 9
    let aiAnalysis: string | undefined;
    if (totalScore > 9) {
      aiAnalysis = await this.generateOllamaAnalysis(userId, answers, totalScore, severity);
    }

    // In DB speichern
    const rows = await query(
      `INSERT INTO phq9_responses 
        (user_id, q1_lustlos, q2_niedergeschlagen, q3_schlafprobleme, q4_muedigkeit,
         q5_appetit, q6_schlecht, q7_konzentration, q8_bewegung, q9_selbstverletzung,
         total_score, severity, ai_analysis, ai_recommendation, additional_notes,
         location_lat, location_lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        userId,
        answers.q1_lustlos, answers.q2_niedergeschlagen, answers.q3_schlafprobleme,
        answers.q4_muedigkeit, answers.q5_appetit, answers.q6_schlecht,
        answers.q7_konzentration, answers.q8_bewegung, answers.q9_selbstverletzung,
        totalScore, severity, aiAnalysis || null, recommendation,
        additionalNotes || null,
        location?.lat || null, location?.lng || null,
      ]
    );

    return this.mapRowToPhq9Result(rows[0]);
  }

  // -------------------------------------------------------------------------
  // PHQ-9 Verlauf laden
  // -------------------------------------------------------------------------
  async getPhq9History(userId: string, limit: number = 20): Promise<Phq9Result[]> {
    const rows = await query(
      `SELECT * FROM phq9_responses 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );
    return rows.map(r => this.mapRowToPhq9Result(r));
  }

  // -------------------------------------------------------------------------
  // Statistiken
  // -------------------------------------------------------------------------
  async getPhq9Stats(userId: string): Promise<Phq9Stats> {
    const rows = await query(
      `SELECT 
        COUNT(*) as total_assessments,
        AVG(total_score) as average_score
       FROM phq9_responses 
       WHERE user_id = $1`,
      [userId]
    );
    if (rows.length === 0) {
      return {
        total_assessments: 0,
        average_score: 0,
        trend: 'stabil',
        risk_level: 'niedrig',
      };
    }

    const totalAssessments = parseInt(rows[0].total_assessments || '0');
    const averageScore = parseFloat(rows[0].average_score || '0');

    // Last assessment for risk/trend calculation
    const lastRows = await query(
      `SELECT * FROM phq9_responses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    const lastAssessment = lastRows.length > 0 ? this.mapRowToPhq9Result(lastRows[0]) : undefined;

    // Trend berechnen (letzte 3 Assessments)
    let trend: Phq9Stats['trend'] = 'stabil';
    if (totalAssessments >= 2) {
      const recentRows = await query(
        `SELECT total_score FROM phq9_responses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 3`,
        [userId]
      );
      const scores = recentRows.map((r: any) => parseInt(r.total_score));
      if (scores.length >= 2) {
        const diff = scores[0] - scores[scores.length - 1];
        if (diff < -3) trend = 'verbesserung';
        else if (diff > 3) trend = 'verschlechterung';
      }
    }

    // Risk Level
    let risk_level: Phq9Stats['risk_level'] = 'niedrig';
    if (lastAssessment && lastAssessment.answers.q9_selbstverletzung >= 1) {
      risk_level = 'hoch';
    } else if (lastAssessment && lastAssessment.total_score >= 15) {
      risk_level = 'hoch';
    } else if (lastAssessment && lastAssessment.total_score >= 10) {
      risk_level = 'mittel';
    }

    return {
      total_assessments: totalAssessments,
      average_score: averageScore,
      last_assessment: lastAssessment,
      trend,
      risk_level,
    };
  }

  // -------------------------------------------------------------------------
  // Notfall-Kontakte
  // -------------------------------------------------------------------------
  getEmergencyContacts(): { name: string; number: string; description: string }[] {
    return [
      {
        name: 'Notfall',
        number: '112',
        description: 'Rettungsdienst bei Lebensgefahr',
      },
      {
        name: 'Telefonseelsorge',
        number: '0800 111 0 111',
        description: 'Kostenlos, 24/7, anonym',
      },
      {
        name: 'Telefonseelsorge (Mobil)',
        number: '0800 111 0 222',
        description: 'Kostenlos, 24/7, anonym',
      },
      {
        name: 'Krisenchat',
        number: 'krisenchat.de',
        description: 'Online-Beratung für junge Menschen',
      },
    ];
  }

  // -------------------------------------------------------------------------
  // Ollama-Analyse generieren
  // -------------------------------------------------------------------------
  private async generateOllamaAnalysis(
    userId: string,
    answers: Phq9Answers,
    totalScore: number,
    severity: string
  ): Promise<string | undefined> {
    try {
      const severityLabel = getSeverityLabel(severity);
      const activeSymptoms: string[] = [];
      
      if (answers.q1_lustlos >= 2) activeSymptoms.push('Interesselosigkeit');
      if (answers.q2_niedergeschlagen >= 2) activeSymptoms.push('Niedergeschlagenheit');
      if (answers.q3_schlafprobleme >= 2) activeSymptoms.push('Schlafprobleme');
      if (answers.q4_muedigkeit >= 2) activeSymptoms.push('Müdigkeit');
      if (answers.q5_appetit >= 2) activeSymptoms.push('Appetitstörung');
      if (answers.q6_schlecht >= 2) activeSymptoms.push('Minderwertigkeitsgefühle');
      if (answers.q7_konzentration >= 2) activeSymptoms.push('Konzentrationsprobleme');
      if (answers.q8_bewegung >= 2) activeSymptoms.push('Psychomotorische Veränderung');
      if (answers.q9_selbstverletzung >= 1) activeSymptoms.push('Selbstverletzungsgedanken');

      const prompt = `Du bist HEIMAT Mental Health Assistent. Erstelle eine einfühlsame Analyse des PHQ-9 Screenings.

PHQ-9 Score: ${totalScore}/27
Schweregrad: ${severityLabel}
Aktive Symptome: ${activeSymptoms.join(', ') || 'Keine'}

Antworte kurz (max 150 Wörter):
1. Empathische Einordnung des Ergebnisses
2. Konkrete nächste Schritte
3. Bei schwerem Ergebnis: Notfall-Kontakte anbieten
4. KEINE medizinische Diagnose stellen

Antworte auf Deutsch, einfühlsam und professionell.`;

      const response = await ollamaService.chat(prompt);
      return response;
    } catch (error) {
      console.error('[MENTAL-HEALTH] Ollama-Analyse fehlgeschlagen:', error);
      return undefined;
    }
  }

  // -------------------------------------------------------------------------
  // Mapping Helper
  // -------------------------------------------------------------------------
  private mapRowToPhq9Result(row: any): Phq9Result {
    return {
      id: row.id,
      user_id: row.user_id,
      answers: {
        q1_lustlos: row.q1_lustlos,
        q2_niedergeschlagen: row.q2_niedergeschlagen,
        q3_schlafprobleme: row.q3_schlafprobleme,
        q4_muedigkeit: row.q4_muedigkeit,
        q5_appetit: row.q5_appetit,
        q6_schlecht: row.q6_schlecht,
        q7_konzentration: row.q7_konzentration,
        q8_bewegung: row.q8_bewegung,
        q9_selbstverletzung: row.q9_selbstverletzung,
      },
      total_score: row.total_score,
      severity: row.severity,
      ai_analysis: row.ai_analysis,
      ai_recommendation: row.ai_recommendation,
      created_at: row.created_at,
    };
  }
}

export const mentalHealthService = new MentalHealthService();
