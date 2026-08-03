// healthMemoryService.ts — Health AI Agent: Gedächtnis (Symptom-Verlauf)
//
// Speichert Symptome über Tage/Wochen für Ollama-Gedächtnis.
// Ermöglicht Erkennung chronischer Muster und saisonaler Trends.

import { query, queryOne } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface HealthMemoryEntry {
  id: string;
  user_id: string;
  symptom_text: string;
  symptom_category: string | null;
  severity: number | null;
  duration: string | null;
  triage_level: string | null;
  triage_confidence: number | null;
  icd_codes: string[] | null;
  location_lat: number | null;
  location_lng: number | null;
  time_of_day: number | null;
  weather_condition: string | null;
  season: string | null;
  medications_used: string[] | null;
  is_resolved: boolean;
  resolved_at: string | null;
  doctor_visit: boolean;
  doctor_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMemoryInput {
  symptom_text: string;
  symptom_category?: string;
  severity?: number;
  duration?: string;
  triage_level?: string;
  triage_confidence?: number;
  icd_codes?: string[];
  location?: { lat: number; lng: number };
  weather_condition?: string;
  season?: string;
  medications_used?: string[];
}

export interface MemoryStats {
  total_entries: number;
  active_symptoms: number;
  resolved_symptoms: number;
  chronic_patterns: ChronicPattern[];
  category_frequency: { category: string; count: number }[];
}

export interface ChronicPattern {
  symptom_category: string;
  occurrences: number;
  avg_severity: number;
  first_seen: string;
  last_seen: string;
  is_chronic: boolean; // >14 Tage andauernd
}

export class HealthMemoryService {
  /**
   * Neuen Symptom-Eintrag erstellen
   */
  async createMemory(
    userId: string,
    input: CreateMemoryInput
  ): Promise<HealthMemoryEntry> {
    // Severity validieren
    if (input.severity !== undefined && (input.severity < 1 || input.severity > 10)) {
      throw new AppError('severity muss zwischen 1 und 10 liegen', 400);
    }

    const result = await queryOne<HealthMemoryEntry>(
      `INSERT INTO health_memory (
        user_id, symptom_text, symptom_category, severity, duration,
        triage_level, triage_confidence, icd_codes,
        location_lat, location_lng, time_of_day,
        weather_condition, season, medications_used
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        userId,
        input.symptom_text,
        input.symptom_category || null,
        input.severity || null,
        input.duration || null,
        input.triage_level || null,
        input.triage_confidence || null,
        input.icd_codes || null,
        input.location?.lat || null,
        input.location?.lng || null,
        new Date().getHours(),
        input.weather_condition || null,
        input.season || null,
        input.medications_used || null,
      ]
    );

    logger.info(`Health Memory erstellt: ${result!.id} für User ${userId}`);
    return result!;
  }

  /**
   * Symptom-Verlauf eines Users laden
   */
  async getMemory(
    userId: string,
    options: {
      limit?: number;
      symptom?: string;
      days?: number;
      resolved?: boolean;
    } = {}
  ): Promise<{ memories: HealthMemoryEntry[]; count: number; hasChronicPattern: boolean }> {
    const { limit = 20, symptom, days, resolved } = options;

    let sql = 'SELECT * FROM health_memory WHERE user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    if (symptom) {
      sql += ` AND symptom_category ILIKE $${paramIndex}`;
      params.push(`%${symptom}%`);
      paramIndex++;
    }

    if (days) {
      sql += ` AND created_at >= NOW() - INTERVAL '${days} days'`;
    }

    if (resolved !== undefined) {
      sql += ` AND is_resolved = $${paramIndex}`;
      params.push(resolved);
      paramIndex++;
    }

    sql += ' ORDER BY created_at DESC';
    sql += ` LIMIT $${paramIndex}`;
    params.push(limit);

    const memories = await query<HealthMemoryEntry>(sql, params);

    // Prüfen ob chronische Muster vorhanden sind
    const chronicCheck = await queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM health_memory 
       WHERE user_id = $1 AND is_resolved = false 
       AND created_at < NOW() - INTERVAL '14 days'`,
      [userId]
    );

    return {
      memories,
      count: memories.length,
      hasChronicPattern: (chronicCheck?.count ?? 0) > 0,
    };
  }

  /**
   * Einzelnen Eintrag laden
   */
  async getMemoryById(
    userId: string,
    memoryId: string
  ): Promise<HealthMemoryEntry> {
    const memory = await queryOne<HealthMemoryEntry>(
      'SELECT * FROM health_memory WHERE id = $1 AND user_id = $2',
      [memoryId, userId]
    );

    if (!memory) {
      throw new AppError('Symptom-Eintrag nicht gefunden', 404);
    }

    return memory;
  }

  /**
   * Symptom als gelöst markieren
   */
  async resolveMemory(
    userId: string,
    memoryId: string,
    options: {
      doctor_visit?: boolean;
      doctor_id?: string;
      notes?: string;
    } = {}
  ): Promise<HealthMemoryEntry> {
    // Prüfen ob Eintrag existiert
    await this.getMemoryById(userId, memoryId);

    const result = await queryOne<HealthMemoryEntry>(
      `UPDATE health_memory 
       SET is_resolved = true, 
           resolved_at = CURRENT_TIMESTAMP,
           doctor_visit = $3,
           doctor_id = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [memoryId, userId, options.doctor_visit || false, options.doctor_id || null]
    );

    logger.info(`Health Memory gelöst: ${memoryId}`);
    return result!;
  }

  /**
   * Eintrag löschen
   */
  async deleteMemory(userId: string, memoryId: string): Promise<void> {
    const result = await queryOne<{ id: string }>(
      'DELETE FROM health_memory WHERE id = $1 AND user_id = $2 RETURNING id',
      [memoryId, userId]
    );

    if (!result) {
      throw new AppError('Symptom-Eintrag nicht gefunden', 404);
    }

    logger.info(`Health Memory gelöscht: ${memoryId}`);
  }

  /**
   * Statistiken berechnen
   */
  async getStats(userId: string): Promise<MemoryStats> {
    // Gesamte Einträge
    const total = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM health_memory WHERE user_id = $1',
      [userId]
    );

    // Aktive Symptome
    const active = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM health_memory WHERE user_id = $1 AND is_resolved = false',
      [userId]
    );

    // Gelöste Symptome
    const resolved = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM health_memory WHERE user_id = $1 AND is_resolved = true',
      [userId]
    );

    // Chronische Muster (>14 Tage andauernd)
    const chronicPatterns = await query<ChronicPattern>(
      `SELECT 
        symptom_category,
        COUNT(*) as occurrences,
        ROUND(AVG(severity)::numeric, 1) as avg_severity,
        MIN(created_at) as first_seen,
        MAX(created_at) as last_seen,
        CASE WHEN MAX(created_at) - MIN(created_at) > INTERVAL '14 days' 
             THEN true ELSE false END as is_chronic
       FROM health_memory 
       WHERE user_id = $1 AND symptom_category IS NOT NULL
       GROUP BY symptom_category
       HAVING COUNT(*) >= 2
       ORDER BY occurrences DESC`,
      [userId]
    );

    // Häufigste Kategorien
    const categoryFrequencyRaw = await query<{ category: string; count: number }>(
      `SELECT symptom_category as category, COUNT(*) as count
       FROM health_memory 
       WHERE user_id = $1 AND symptom_category IS NOT NULL
       GROUP BY symptom_category
       ORDER BY count DESC
       LIMIT 5`,
      [userId]
    );
    const categoryFrequency = categoryFrequencyRaw.map(c => ({ ...c, count: Number(c.count) }));

    return {
      total_entries: Number(total?.count ?? 0),
      active_symptoms: Number(active?.count ?? 0),
      resolved_symptoms: Number(resolved?.count ?? 0),
      chronic_patterns: chronicPatterns,
      category_frequency: categoryFrequency,
    };
  }

  /**
   * Letzte Einträge für Ollama-Kontext laden
   */
  async getRecentForContext(
    userId: string,
    limit: number = 5
  ): Promise<string> {
    const memories = await query<HealthMemoryEntry>(
      `SELECT symptom_text, symptom_category, severity, triage_level, created_at
       FROM health_memory 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );

    if (memories.length === 0) {
      return '';
    }

    const lines = memories.map((m) => {
      const date = new Date(m.created_at).toLocaleDateString('de-DE');
      const severity = m.severity ? ` (${m.severity}/10)` : '';
      const triage = m.triage_level ? ` [${m.triage_level}]` : '';
      return `- ${date}: ${m.symptom_text}${severity}${triage}`;
    });

    return `Vorherige Symptome:\n${lines.join('\n')}`;
  }
}

export const healthMemoryService = new HealthMemoryService();
