// userMedicationsService.ts — Health AI Agent: Medikamentenverwaltung
//
// User speichert seine Medikamente für Interaktions-Checks.

import { query, queryOne } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface UserMedication {
  id: string;
  user_id: string;
  name: string;
  active_ingredient: string | null;
  dosage: string | null;
  frequency: string | null;
  category: string | null;
  is_prescription: boolean;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MedicationInteraction {
  drug_a: string;
  drug_b: string;
  severity: 'schwerwiegend' | 'mittel' | 'leicht';
  description: string;
  recommendation: string;
  source: string | null;
}

export interface CreateMedicationInput {
  name: string;
  active_ingredient?: string;
  dosage?: string;
  frequency?: string;
  category?: string;
  is_prescription?: boolean;
  start_date?: string;
  notes?: string;
}

export interface MedicationInteractionsResult {
  interactions: MedicationInteraction[];
  hasSevereInteraction: boolean;
}

export class UserMedicationsService {
  /**
   * Neues Medikament hinzufügen
   */
  async addMedication(
    userId: string,
    input: CreateMedicationInput
  ): Promise<{ medication: UserMedication; interactions: MedicationInteractionsResult }> {
    const result = await queryOne<UserMedication>(
      `INSERT INTO user_medications (
        user_id, name, active_ingredient, dosage, frequency,
        category, is_prescription, start_date, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        userId,
        input.name,
        input.active_ingredient || null,
        input.dosage || null,
        input.frequency || null,
        input.category || null,
        input.is_prescription || false,
        input.start_date || null,
        input.notes || null,
      ]
    );

    // Sofort Interaktions-Check mit anderen aktiven Medikamenten
    // active_ingredient优先 (ASS matcht in medication_interactions), sonst name
    const checkName = input.active_ingredient || input.name;
    const existingMeds = await this.getMedications(userId, { active_only: true });
    const existingNames = existingMeds.medications
      .map(m => m.active_ingredient || m.name)
      .filter(n => n !== checkName);
    const allDrugs = [...new Set([checkName, ...existingNames])];
    const interactions = await this.checkInteractions(userId, allDrugs);

    logger.info(`Medikament hinzugefügt: ${input.name} für User ${userId}`);
    return { medication: result!, interactions };
  }

  /**
   * Alle Medikamente eines Users laden
   */
  async getMedications(
    userId: string,
    options: { active_only?: boolean } = {}
  ): Promise<{ medications: UserMedication[]; activeCount: number }> {
    let sql = 'SELECT * FROM user_medications WHERE user_id = $1';
    const params: any[] = [userId];

    if (options.active_only) {
      sql += ' AND is_active = true';
    }

    sql += ' ORDER BY created_at DESC';

    const medications = await query<UserMedication>(sql, params);

    const activeCount = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM user_medications WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    return {
      medications,
      activeCount: Number(activeCount?.count ?? 0),
    };
  }

  /**
   * Einzelnes Medikament laden
   */
  async getMedicationById(
    userId: string,
    medicationId: string
  ): Promise<UserMedication> {
    const medication = await queryOne<UserMedication>(
      'SELECT * FROM user_medications WHERE id = $1 AND user_id = $2',
      [medicationId, userId]
    );

    if (!medication) {
      throw new AppError('Medikament nicht gefunden', 404);
    }

    return medication;
  }

  /**
   * Medikament aktualisieren
   */
  async updateMedication(
    userId: string,
    medicationId: string,
    input: Partial<CreateMedicationInput & { is_active: boolean; end_date: string }>
  ): Promise<UserMedication> {
    // Prüfen ob Medikament existiert
    await this.getMedicationById(userId, medicationId);

    // Dynamisches Update
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(input.name);
    }
    if (input.active_ingredient !== undefined) {
      updates.push(`active_ingredient = $${paramIndex++}`);
      params.push(input.active_ingredient);
    }
    if (input.dosage !== undefined) {
      updates.push(`dosage = $${paramIndex++}`);
      params.push(input.dosage);
    }
    if (input.frequency !== undefined) {
      updates.push(`frequency = $${paramIndex++}`);
      params.push(input.frequency);
    }
    if (input.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      params.push(input.category);
    }
    if (input.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(input.is_active);
    }
    if (input.end_date !== undefined) {
      updates.push(`end_date = $${paramIndex++}`);
      params.push(input.end_date);
    }
    if (input.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      params.push(input.notes);
    }

    if (updates.length === 0) {
      throw new AppError('Keine Aktualisierungen angegeben', 400);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const result = await queryOne<UserMedication>(
      `UPDATE user_medications 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
       RETURNING *`,
      [...params, medicationId, userId]
    );

    logger.info(`Medikament aktualisiert: ${medicationId}`);
    return result!;
  }

  /**
   * Medikament entfernen (soft delete via is_active = false)
   */
  async removeMedication(
    userId: string,
    medicationId: string
  ): Promise<void> {
    const result = await queryOne<{ id: string }>(
      `UPDATE user_medications 
       SET is_active = false, end_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [medicationId, userId]
    );

    if (!result) {
      throw new AppError('Medikament nicht gefunden', 404);
    }

    logger.info(`Medikament deaktiviert: ${medicationId}`);
  }

  /**
   * Interaktions-Check für eine Liste von Medikamenten
   */
  async checkInteractions(
    userId: string,
    drugNames: string[]
  ): Promise<MedicationInteractionsResult> {
    if (drugNames.length < 2) {
      return { interactions: [], hasSevereInteraction: false };
    }

    // Alle Kombinationen prüfen
    const interactions: MedicationInteraction[] = [];

    for (let i = 0; i < drugNames.length; i++) {
      for (let j = i + 1; j < drugNames.length; j++) {
        const drugA = drugNames[i];
        const drugB = drugNames[j];

        // Suche in beide Richtungen (ASS ↔ Ibuprofen)
        const interaction = await queryOne<MedicationInteraction>(
          `SELECT * FROM medication_interactions 
           WHERE (drug_a ILIKE $1 AND drug_b ILIKE $2)
              OR (drug_a ILIKE $2 AND drug_b ILIKE $1)
           LIMIT 1`,
          [drugA, drugB]
        );

        if (interaction) {
          interactions.push(interaction);
        }
      }
    }

    // Nach Schweregrad sortieren
    const severityOrder = { schwerwiegend: 0, mittel: 1, leicht: 2 };
    interactions.sort(
      (a, b) =>
        severityOrder[a.severity] - severityOrder[b.severity]
    );

    return {
      interactions,
      hasSevereInteraction: interactions.some(
        (i) => i.severity === 'schwerwiegend'
      ),
    };
  }

  /**
   * Interaktions-Check für User-Medikamente
   */
  async checkUserInteractions(
    userId: string
  ): Promise<MedicationInteractionsResult> {
    const { medications } = await this.getMedications(userId, {
      active_only: true,
    });

    const drugNames = medications.map((m) => m.name);

    // Auch Wirkstoffe einbeziehen
    const activeIngredients = medications
      .filter((m) => m.active_ingredient)
      .map((m) => m.active_ingredient!);

    const allDrugs = [...new Set([...drugNames, ...activeIngredients])];

    return this.checkInteractions(userId, allDrugs);
  }

  /**
   * Medikamentenliste für Ollama-Kontext laden
   */
  async getMedicationsForContext(userId: string): Promise<string> {
    const { medications } = await this.getMedications(userId, {
      active_only: true,
    });

    if (medications.length === 0) {
      return '';
    }

    const lines = medications.map((m) => {
      const dosage = m.dosage ? ` ${m.dosage}` : '';
      const frequency = m.frequency ? ` (${m.frequency})` : '';
      return `- ${m.name}${dosage}${frequency}`;
    });

    return `Aktuelle Medikamente:\n${lines.join('\n')}`;
  }
}

export const userMedicationsService = new UserMedicationsService();
