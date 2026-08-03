// preventionService.ts — Präventions-Assistent (Profil-basiert)
//
// ZWECK: Personalisierte Vorsorge-Empfehlungen basierend auf Alter, Geschlecht, Risikofaktoren
//
// REGELN (evidenzbasiert):
//   - Prostatavorsorge: Männlich, ≥50
//   - Mammographie: Weiblich, ≥50
//   - Darmkrebsvorsorge: ≥50
//   - Lungenkrebs-Screening: Raucher, ≥50
//   - Herz-Kreislauf-Check: Risikofaktoren
//   - Impfstatus: Auffrischungen

import { query, queryOne } from '../config/database';

// ============================================================================
// Types
// ============================================================================

export interface PreventionRecommendation {
  id: string;
  user_id: string;
  category: 'Vorsorge' | 'Screening' | 'Impfung' | 'Lebensstil';
  title: string;
  description: string;
  priority: 'hoch' | 'mittel' | 'niedrig';
  based_on: string;
  relevant_until?: string;
  is_completed: boolean;
  completed_at?: string;
  created_at: string;
}

export interface UserProfile {
  user_id: string;
  birth_date?: string;
  gender?: string;
  is_smoker?: boolean;
  risk_factors?: string[];
  family_history?: string[];
  last_checkup_date?: string;
}

export interface PreventionStats {
  total_recommendations: number;
  completed: number;
  pending: number;
  high_priority: number;
}

// ============================================================================
// Präventions-Regeln
// ============================================================================

interface PreventionRule {
  category: PreventionRecommendation['category'];
  title: string;
  description: string;
  priority: PreventionRecommendation['priority'];
  condition: (profile: UserProfile) => boolean;
  based_on: string;
}

const PREVENTION_RULES: PreventionRule[] = [
  // Männer ≥50: Prostatavorsorge
  {
    category: 'Vorsorge',
    title: 'Prostatavorsorge',
    description: 'Ab 50 Jahren wird eine jährliche Tastuntersuchung der Prostata empfohlen. Bei familiärischer Vorbelastung bereits ab 45.',
    priority: 'mittel',
    condition: (p) => p.gender === 'männlich' && getAge(p.birth_date) >= 50,
    based_on: 'Alter + Geschlecht',
  },
  // Frauen ≥50: Mammographie
  {
    category: 'Screening',
    title: 'Mammographie-Screening',
    description: 'Alle 2 Jahre Mammographie zur Früherkennung von Brustkrebs.',
    priority: 'mittel',
    condition: (p) => p.gender === 'weiblich' && getAge(p.birth_date) >= 50,
    based_on: 'Alter + Geschlecht',
  },
  // Alle ≥50: Darmkrebsvorsorge
  {
    category: 'Screening',
    title: 'Darmkrebsvorsorge',
    description: 'Ab 50 Jahren empfohlen: Koloskopie alle 10 Jahre oder jährlicher Stuhltest.',
    priority: 'hoch',
    condition: (p) => getAge(p.birth_date) >= 50,
    based_on: 'Alter',
  },
  // Raucher ≥50: Lungenkrebs-Screening
  {
    category: 'Screening',
    title: 'Lungenkrebs-Screening',
    description: 'Niedrig-Dosis-CT für Raucher und Ex-Raucher ab 50 mit mindestens 20 Packyears.',
    priority: 'hoch',
    condition: (p) => p.is_smoker === true && getAge(p.birth_date) >= 50,
    based_on: 'Alter + Raucher-Status',
  },
  // Herz-Kreislauf-Check: Bei Risikofaktoren
  {
    category: 'Vorsorge',
    title: 'Herz-Kreislauf-Check',
    description: 'Jährliche Kontrolle von Blutdruck, Blutfettwerten und Blutzucker bei Risikofaktoren.',
    priority: 'hoch',
    condition: (p) => (p.risk_factors?.length ?? 0) > 0,
    based_on: 'Risikofaktoren',
  },
  // Blutdruck-Messung: Ab 40
  {
    category: 'Vorsorge',
    title: 'Blutdruck-Messung',
    description: 'Ab 40 Jahren mindestens jährliche Blutdruckmessung. Bei Risikofaktoren häufiger.',
    priority: 'mittel',
    condition: (p) => getAge(p.birth_date) >= 40,
    based_on: 'Alter',
  },
  // Augenarzt: Ab 40
  {
    category: 'Vorsorge',
    title: 'Augenarzt-Untersuchung',
    description: 'Ab 40 Jahren empfohlen: Glaukom-Vorsorge (Grüner Star).',
    priority: 'niedrig',
    condition: (p) => getAge(p.birth_date) >= 40,
    based_on: 'Alter',
  },
  // Hautarzt: Ab 30
  {
    category: 'Screening',
    title: 'Hautkrebsscreening',
    description: 'Jährliche Hautkrebsvorsorge ab 30. Bei viele Muttermale oder Familienvorbelastung: häufiger.',
    priority: 'niedrig',
    condition: (p) => getAge(p.birth_date) >= 30,
    based_on: 'Alter',
  },
  // Raucher: Rauchentwöhnung
  {
    category: 'Lebensstil',
    title: 'Rauchentwöhnung',
    description: 'Mit dem Rauchen aufhören reduziert das Risiko für Herz-Kreislauf-Erkrankungen, Krebs und COPD erheblich.',
    priority: 'hoch',
    condition: (p) => p.is_smoker === true,
    based_on: 'Lebensstil',
  },
  // Impfstatus: Auffrischungen
  {
    category: 'Impfung',
    title: 'Impfstatus prüfen',
    description: 'Tetanus/Diphtherie (alle 10 Jahre), Grippe (jährlich), COVID-19 (Auffrischung).',
    priority: 'mittel',
    condition: () => true, // Immer relevant
    based_on: 'Allgemein',
  },
];

// ============================================================================
// Helper
// ============================================================================

function getAge(birthDate?: string): number {
  if (!birthDate) return 0;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// ============================================================================
// Service
// ============================================================================

export class PreventionService {

  // -------------------------------------------------------------------------
  // Empfehlungen generieren (basierend auf Profil)
  // -------------------------------------------------------------------------
  async generateRecommendations(userId: string): Promise<PreventionRecommendation[]> {
    // Profil laden
    const profile = await this.getUserProfile(userId);
    if (!profile) {
      return [];
    }

    // Regeln anwenden
    const applicableRules = PREVENTION_RULES.filter(rule => rule.condition(profile));

    // Bestehende (aktive) Empfehlungen laden
    const existingRows = await query(
      `SELECT title FROM prevention_recommendations 
       WHERE user_id = $1 AND is_completed = false`,
      [userId]
    );
    const existingTitles = new Set(existingRows.map((r: any) => r.title));

    // Nur neue Empfehlungen erstellen
    const newRecommendations: PreventionRecommendation[] = [];

    for (const rule of applicableRules) {
      if (!existingTitles.has(rule.title)) {
        const rows = await query(
          `INSERT INTO prevention_recommendations 
            (user_id, category, title, description, priority, based_on)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [userId, rule.category, rule.title, rule.description, rule.priority, rule.based_on]
        );
        newRecommendations.push(this.mapRowToRecommendation(rows[0]));
      }
    }

    return newRecommendations;
  }

  // -------------------------------------------------------------------------
  // Aktive Empfehlungen laden
  // -------------------------------------------------------------------------
  async getActiveRecommendations(userId: string): Promise<PreventionRecommendation[]> {
    const rows = await query(
      `SELECT * FROM prevention_recommendations 
       WHERE user_id = $1 AND is_completed = false
       ORDER BY 
         CASE priority 
           WHEN 'hoch' THEN 1 
           WHEN 'mittel' THEN 2 
           WHEN 'niedrig' THEN 3 
         END, created_at DESC`,
      [userId]
    );
    return rows.map(r => this.mapRowToRecommendation(r));
  }

  // -------------------------------------------------------------------------
  // Empfehlung als erledigt markieren
  // -------------------------------------------------------------------------
  async completeRecommendation(
    userId: string,
    recommendationId: string,
    doctorId?: string
  ): Promise<PreventionRecommendation | null> {
    const rows = await query(
      `UPDATE prevention_recommendations 
       SET is_completed = true, completed_at = CURRENT_TIMESTAMP, doctor_id = $3
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [recommendationId, userId, doctorId || null]
    );

    if (rows.length === 0) {
      return null;
    }
    return this.mapRowToRecommendation(rows[0]);
  }

  // -------------------------------------------------------------------------
  // Verlauf (was wurde erledigt)
  // -------------------------------------------------------------------------
  async getCompletedRecommendations(userId: string): Promise<PreventionRecommendation[]> {
    const rows = await query(
      `SELECT * FROM prevention_recommendations 
       WHERE user_id = $1 AND is_completed = true
       ORDER BY completed_at DESC`,
      [userId]
    );
    return rows.map(r => this.mapRowToRecommendation(r));
  }

  // -------------------------------------------------------------------------
  // Statistiken
  // -------------------------------------------------------------------------
  async getStats(userId: string): Promise<PreventionStats> {
    const rows = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_completed = true) as completed,
        COUNT(*) FILTER (WHERE is_completed = false) as pending,
        COUNT(*) FILTER (WHERE is_completed = false AND priority = 'hoch') as high_priority
       FROM prevention_recommendations 
       WHERE user_id = $1`,
      [userId]
    );

    const row = rows[0];
    return {
      total_recommendations: parseInt(row.total || '0'),
      completed: parseInt(row.completed || '0'),
      pending: parseInt(row.pending || '0'),
      high_priority: parseInt(row.high_priority || '0'),
    };
  }

  // -------------------------------------------------------------------------
  // Profil laden
  // -------------------------------------------------------------------------
  private async getUserProfile(userId: string): Promise<UserProfile | null> {
    const rows = await query(
      `SELECT * FROM user_health_profile WHERE user_id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      user_id: row.user_id,
      birth_date: row.birth_date,
      gender: row.gender,
      is_smoker: row.is_smoker,
      risk_factors: row.risk_factors,
      family_history: row.family_history,
      last_checkup_date: row.last_checkup_date,
    };
  }

  // -------------------------------------------------------------------------
  // Mapping Helper
  // -------------------------------------------------------------------------
  private mapRowToRecommendation(row: any): PreventionRecommendation {
    return {
      id: row.id,
      user_id: row.user_id,
      category: row.category,
      title: row.title,
      description: row.description,
      priority: row.priority,
      based_on: row.based_on,
      relevant_until: row.relevant_until,
      is_completed: row.is_completed,
      completed_at: row.completed_at,
      created_at: row.created_at,
    };
  }
}

export const preventionService = new PreventionService();
