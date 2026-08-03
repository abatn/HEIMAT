// followUpService.ts — Post-Termin Follow-up (Nachsorge)
//
// ZWECK: Automatische Nachsorge nach Arztbesuchen
//        - Tag 1: "Wie geht es nach dem Termin?"
//        - Tag 3: "Check-in: Symptome verbessert?"
//        - Tag 7: "Bei anhaltenden Beschwerden → Kontrolltermin"
//
// ARCHITEKTUR:
//   1. Nach Termin: Follow-up erstellen
//   2. Cron-Job: Offene Follow-ups prüfen
//   3. User antwortet → Ollama-Analyse
//   4. Bei Bedarf: Weiteres Follow-up erstellen

import { query, queryOne } from '../config/database';
import { ollamaService } from './ollamaService';

// ============================================================================
// Types
// ============================================================================

export interface FollowUp {
  id: string;
  user_id: string;
  appointment_id?: string;
  doctor_id?: string;
  followup_date: string;
  followup_type: 'check_in' | 'medication' | 'symptom';
  responded: boolean;
  response_text?: string;
  response_severity?: number;
  ai_analysis?: string;
  needs_followup: boolean;
  next_followup_date?: string;
  status: 'pending' | 'sent' | 'responded' | 'closed';
  created_at: string;
  responded_at?: string;
}

export interface FollowUpResponse {
  text: string;
  severity: number; // 1-10
}

export interface FollowUpStats {
  total_followups: number;
  pending: number;
  responded: number;
  needs_followup: number;
}

// ============================================================================
// Service
// ============================================================================

export class FollowUpService {

  // -------------------------------------------------------------------------
  // Follow-up nach Termin erstellen
  // -------------------------------------------------------------------------
  async createFollowUp(
    userId: string,
    appointmentId: string,
    doctorId: string,
    followupType: FollowUp['followup_type'] = 'check_in'
  ): Promise<FollowUp> {
    // Follow-up-Tage definieren
    const followupDays = this.getFollowupDays(followupType);
    
    // Erstes Follow-up: Tag 1
    const followupDate = new Date();
    followupDate.setDate(followupDate.getDate() + followupDays[0]);

    const rows = await query(
      `INSERT INTO post_appointment_followups 
        (user_id, appointment_id, doctor_id, followup_date, followup_type, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [userId, appointmentId, doctorId, followupDate.toISOString().split('T')[0], followupType]
    );

    return this.mapRowToFollowUp(rows[0]);
  }

  // -------------------------------------------------------------------------
  // Offene Follow-ups laden
  // -------------------------------------------------------------------------
  async getPendingFollowUps(userId: string): Promise<FollowUp[]> {
    const rows = await query(
      `SELECT * FROM post_appointment_followups 
       WHERE user_id = $1 AND status IN ('pending', 'sent')
       ORDER BY followup_date ASC`,
      [userId]
    );
    return rows.map(r => this.mapRowToFollowUp(r));
  }

  // -------------------------------------------------------------------------
  // User antwortet
  // -------------------------------------------------------------------------
  async respondToFollowUp(
    followUpId: string,
    userId: string,
    userResponse: FollowUpResponse
  ): Promise<FollowUp | null> {
    // Ollama-Analyse generieren
    const aiAnalysis = await this.generateOllamaAnalysis(userResponse);

    // Follow-up aktualisieren
    const rows = await query(
      `UPDATE post_appointment_followups 
       SET responded = true, 
           response_text = $3, 
           response_severity = $4,
           ai_analysis = $5,
           status = 'responded',
           responded_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [followUpId, userId, userResponse.text, userResponse.severity, aiAnalysis]
    );

    if (rows.length === 0) {
      return null;
    }

    const followUp = this.mapRowToFollowUp(rows[0]);

    // Bei Bedarf: Weiteres Follow-up erstellen
    if (userResponse.severity >= 5) {
      await this.createFollowUp(
        userId,
        followUp.appointment_id || '',
        followUp.doctor_id || '',
        'symptom'
      );
      followUp.needs_followup = true;
    }

    return followUp;
  }

  // -------------------------------------------------------------------------
  // Verlauf
  // -------------------------------------------------------------------------
  async getFollowUpHistory(userId: string, limit: number = 20): Promise<FollowUp[]> {
    const rows = await query(
      `SELECT * FROM post_appointment_followups 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );
    return rows.map(r => this.mapRowToFollowUp(r));
  }

  // -------------------------------------------------------------------------
  // Cron-Job: Offene Follow-ups prüfen
  // -------------------------------------------------------------------------
  async checkPendingFollowUps(): Promise<{ sent: number; skipped: number }> {
    const today = new Date().toISOString().split('T')[0];

    // Follow-ups die heute fällig sind
    const rows = await query(
      `UPDATE post_appointment_followups 
       SET status = 'sent'
       WHERE status = 'pending' AND followup_date <= $1
       RETURNING id`,
      [today]
    );

    return {
      sent: rows.length,
      skipped: 0,
    };
  }

  // -------------------------------------------------------------------------
  // Statistiken
  // -------------------------------------------------------------------------
  async getStats(userId: string): Promise<FollowUpStats> {
    const rows = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status IN ('pending', 'sent')) as pending,
        COUNT(*) FILTER (WHERE status = 'responded') as responded,
        COUNT(*) FILTER (WHERE needs_followup = true AND status = 'responded') as needs_followup
       FROM post_appointment_followups 
       WHERE user_id = $1`,
      [userId]
    );

    const row = rows[0];
    return {
      total_followups: parseInt(row.total || '0'),
      pending: parseInt(row.pending || '0'),
      responded: parseInt(row.responded || '0'),
      needs_followup: parseInt(row.needs_followup || '0'),
    };
  }

  // -------------------------------------------------------------------------
  // Follow-up-Tage nach Typ
  // -------------------------------------------------------------------------
  private getFollowupDays(type: FollowUp['followup_type']): number[] {
    switch (type) {
      case 'check_in':
        return [1, 3, 7]; // Tag 1, 3, 7
      case 'medication':
        return [1, 3]; // Tag 1, 3
      case 'symptom':
        return [3, 7]; // Tag 3, 7
      default:
        return [1, 3, 7];
    }
  }

  // -------------------------------------------------------------------------
  // Ollama-Analyse generieren
  // -------------------------------------------------------------------------
  private async generateOllamaAnalysis(response: FollowUpResponse): Promise<string> {
    try {
      const prompt = `Du bist HEIMAT Nachsorge-Assistent. Analysiere die User-Antwort nach einem Arztbesuch.

User-Antwort: "${response.text}"
Symptom-Schwere: ${response.severity}/10

Antworte kurz (max 100 Wörter):
1. Einordnung der Antwort
2. Empfehlung (bei Bedarf Kontrolltermin)
3. Bei Verschlechterung: Arzt kontaktieren

Antworte auf Deutsch, einfühlsam.`;

      const analysis = await ollamaService.chat(prompt);

      return analysis;
    } catch (error) {
      console.error('[FOLLOW-UP] Ollama-Analyse fehlgeschlagen:', error);
      return 'Analyse konnte nicht erstellt werden.';
    }
  }

  // -------------------------------------------------------------------------
  // Mapping Helper
  // -------------------------------------------------------------------------
  private mapRowToFollowUp(row: any): FollowUp {
    return {
      id: row.id,
      user_id: row.user_id,
      appointment_id: row.appointment_id,
      doctor_id: row.doctor_id,
      followup_date: row.followup_date,
      followup_type: row.followup_type,
      responded: row.responded,
      response_text: row.response_text,
      response_severity: row.response_severity,
      ai_analysis: row.ai_analysis,
      needs_followup: row.needs_followup,
      next_followup_date: row.next_followup_date,
      status: row.status,
      created_at: row.created_at,
      responded_at: row.responded_at,
    };
  }
}

export const followUpService = new FollowUpService();
