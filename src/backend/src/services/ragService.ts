// ---------------------------------------------------------------------------
// ragService.ts — RAG (Retrieval Augmented Generation) für DEGAM-Leitlinien
//
// Sucht in der degam_guidelines-Tabelle nach medizinisch relevanten Chunks
// basierend auf User-Symptomen. Nutzt PostgreSQL tsvector mit deutschem
// Stemming ('german' config) — kein pgvector, kein Embedding-Modell nötig.
//
// Integration: wird von ollamaService.chatWithContext() aufgerufen wenn
// der health-Context ein Symptom enthält. Die gefundenen DEGAM-Chunks
// werden in den System-Prompt injiziert, damit Ollama faktenbasiert
// antwortet statt zu halluzinieren.
//
// Privacy: Nur Symptom-Keywords werden an die DB gesendet (keine PII).
// ---------------------------------------------------------------------------

import { query } from '../config/database';
import { logger } from '../utils/logger';

export interface GuidelineChunk {
  id: string;
  guideline_id: string;
  topic: string;
  red_flags: string;
  routine_advice: string;
  bereitschaft_advice: string;
}

/**
 * Sucht DEGAM-Leitlinien basierend auf User-Symptomen.
 *
 * Strategie: Symptom-Text wird in einzelne Wörter zerlegt, die als
 * OR-verknüpfter tsquery an PostgreSQL gesendet. Deutsche Stemming
 * ('german' config) sorgt dafür dass "hustet" → "husten" matcht.
 *
 * @param symptoms  Freitext-Symptom des Users (z.B. "Rückenschmerzen seit 3 Tagen")
 * @param limit     Maximale Anzahl Ergebnisse (Default: 3)
 * @returns         Array von GuidelineChunk-Objekten
 */
export async function searchGuidelines(
  symptoms: string,
  limit: number = 2,
): Promise<GuidelineChunk[]> {
  if (!symptoms || symptoms.trim().length === 0) return [];

  try {
    // Symptom-Text in saubere Keywords zerlegen
    const keywords = symptoms
      .toLowerCase()
      .replace(/[^a-zäöüß0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2) // Min 3 Zeichen
      .filter(w => !STOPWORDS.has(w)); // Stoppwörter entfernen

    if (keywords.length === 0) return [];

    // OR-verknüpfter tsquery: "husten | fieber | schmerz"
    const tsQueryStr = keywords.join(' | ');

    const rows = await query<GuidelineChunk>(
      `SELECT id, guideline_id, topic, red_flags, routine_advice, bereitschaft_advice
       FROM degam_guidelines
       WHERE search_vector @@ to_tsquery('german', $1)
       ORDER BY ts_rank(search_vector, to_tsquery('german', $1)) DESC
       LIMIT $2`,
      [tsQueryStr, limit],
    );

    return rows;
  } catch (error: unknown) {
    // Fail-safe: bei DB-Fehler leeres Array zurückgeben (kein Crash)
    logger.warn(`RAG-Suche fehlgeschlagen: ${error}`);
    return [];
  }
}

/**
 * Formatiert gefundene DEGAM-Chunks als Text-Block für den System-Prompt.
 * Jeder Chunk enthält Red Flags (NOTFALL) + Routine + BEREITSCHAFT.
 */
export function formatGuidelinesForPrompt(chunks: GuidelineChunk[]): string {
  if (chunks.length === 0) return '';

  const header = '\n## LEITLINIEN (DEGAM)';
  const disclaimer = '\n⚠️ Orientierung, keine Diagnose.';

  // Max 600 Zeichen pro Chunk — kürzere Prompts = schnellere LLM-Antwort
  const MAX_CHUNK_LEN = 600;

  const formatted = chunks
    .map(c => {
      const parts = [
        `\n### ${c.topic}`,
        c.red_flags ? `\n🔴 ${c.red_flags}` : '',
        c.bereitschaft_advice ? `\n🟡 ${c.bereitschaft_advice}` : '',
        c.routine_advice ? `\n🟢 ${c.routine_advice}` : '',
      ].filter(Boolean);
      const chunk = parts.join('');
      // Truncate to MAX_CHUNK_LEN to keep prompt small for qwen2.5:3b
      return chunk.length > MAX_CHUNK_LEN
        ? chunk.substring(0, MAX_CHUNK_LEN) + '…'
        : chunk;
    })
    .join('\n');

  return header + disclaimer + formatted;
}

// Deutsche Stoppwörter die nicht als tsquery genutzt werden sollen
const STOPWORDS = new Set([
  'ich', 'mich', 'mir', 'mein', 'meine', 'meinem',
  'du', 'dich', 'dir', 'dein', 'deine',
  'er', 'sie', 'es', 'sein', 'ihre', 'ihr',
  'wir', 'uns', 'unser', 'euer',
  'der', 'die', 'das', 'den', 'dem', 'des',
  'ein', 'eine', 'einem', 'einer', 'eines',
  'und', 'oder', 'aber',
  'hab', 'habe', 'hast', 'hat', 'haben',
  'bin', 'ist', 'sind', 'war', 'waren',
  'werde', 'wirst', 'wird', 'werden',
  'seit', 'seitdem', 'bei', 'mit', 'von', 'aus',
  'für', 'auf', 'in', 'an', 'um', 'zu',
  'wie', 'was', 'wer', 'wo', 'wann', 'warum',
  'auch', 'noch', 'schon', 'nur', 'sehr', 'mehr',
  'heute', 'gestern', 'morgen', 'jetzt', 'immer',
  'tage', 'tag', 'woche', 'wochen', 'monat',
]);

export const ragService = { searchGuidelines, formatGuidelinesForPrompt };
