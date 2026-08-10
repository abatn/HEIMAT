// skillMatchService.ts — Skill-Matching Service
//
// Features:
// 1. Skill-Extraktor: Nutzt Ollama um geforderte Skills aus Job-Beschreibungen zu extrahieren
// 2. Match-Score: Berechnet wie gut ein User zu einem Job passt
// 3. Fehlende Skills: Zeigt welche Skills dem User fehlen

import { ollamaService } from './ollamaService';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractedSkills {
  skills: string[];
  raw: string;
}

export interface MatchResult {
  score: number; // 0-100
  matchedSkills: string[];
  missingSkills: string[];
  totalRequired: number;
  totalMatched: number;
}

// ---------------------------------------------------------------------------
// Skill-Extraktor
// ---------------------------------------------------------------------------

const SKILL_EXTRACT_PROMPT = `Extrahiere ausfolgender Job-Beschreibung die geforderten Skills und Fähigkeiten.
Antworte NUR mit einer kommagetrennten Liste (z.B. "Python, React, Teamführung, Führerschein").
Keine Erklärungen, keine Überschriften, nur die Skills.`;

export class SkillMatchService {
  /**
   * Extrahiert Skills aus einer Job-Beschreibung via Ollama.
   *
   * @param jobDescription  Die Job-Beschreibung (Text)
   * @returns               Extrahierte Skills als Liste
   */
  async extractSkills(jobDescription: string): Promise<ExtractedSkills> {
    try {
      // Ollama mit kurzem Prompt für Speed
      const response = await ollamaService.chat(
        `Job-Beschreibung:\n${jobDescription.substring(0, 2000)}\n\nWelche Skills werden gefordert?`,
        { systemPrompt: SKILL_EXTRACT_PROMPT }
      );

      if (response.includes('nicht verfügbar') || response.includes('nicht installiert')) {
        // Ollama offline — Fallback mit Regex
        return this.extractSkillsFallback(jobDescription);
      }

      // Skills parsen (kommagetrennt)
      const skills = response
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0 && s.length < 100);

      return {
        skills,
        raw: response,
      };
    } catch (error: unknown) {
      logger.warn(`Skill-Extraktion fehlgeschlagen: ${error}`);
      return this.extractSkillsFallback(jobDescription);
    }
  }

  /**
   * Fallback-Skill-Extraktion mit Regex (wenn Ollama offline).
   * Erkennt常见 Tech-Skills direkt im Text.
   */
  private extractSkillsFallback(description: string): ExtractedSkills {
    const knownSkills = [
      // Tech
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Ruby', 'Go', 'Rust',
      'React', 'Vue', 'Angular', 'Node.js', 'Docker', 'Kubernetes', 'AWS', 'Azure',
      'SQL', 'NoSQL', 'Git', 'CI/CD', 'REST API', 'GraphQL',
      // Gesundheit
      'Pflegeerfahrung', 'Medizinische Grundkenntnisse', 'Erste Hilfe',
      'Patientenkontakt', 'Dokumentation', 'Hygiene',
      // Handwerk
      'Führerschein', 'Handwerkliche Erfahrung', 'Elektrik', 'Sanitär',
      // Soft Skills
      'Teamführung', 'Kommunikation', 'Organisation', 'Selbstständigkeit',
      'Problemlösung', 'Kreativität', 'Belastbarkeit',
    ];

    const found: string[] = [];
    for (const skill of knownSkills) {
      if (description.toLowerCase().includes(skill.toLowerCase())) {
        found.push(skill);
      }
    }

    return {
      skills: found,
      raw: `[Fallback: ${found.length} Skills erkannt]`,
    };
  }

  /**
   * Berechnet den Match-Score zwischen User-Skills und Job-Anforderungen.
   *
   * @param userSkills     Skills des Users (Liste)
   * @param jobSkills      Skills des Jobs (Liste)
   * @returns              MatchResult mit Score, matched und missing Skills
   */
  calculateMatch(userSkills: string[], jobSkills: string[]): MatchResult {
    if (jobSkills.length === 0) {
      return {
        score: 100,
        matchedSkills: userSkills,
        missingSkills: [],
        totalRequired: 0,
        totalMatched: userSkills.length,
      };
    }

    const normalizedUserSkills = userSkills.map(s => s.toLowerCase().trim());
    const normalizedJobSkills = jobSkills.map(s => s.toLowerCase().trim());

    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];

    for (const jobSkill of normalizedJobSkills) {
      const isMatch = normalizedUserSkills.some(
        userSkill =>
          userSkill.includes(jobSkill) ||
          jobSkill.includes(userSkill) ||
          this.skillSimilarity(userSkill, jobSkill) > 0.7
      );

      if (isMatch) {
        // Original-Name des Skills verwenden
        const original = jobSkills.find(
          s => s.toLowerCase().trim() === jobSkill
        );
        matchedSkills.push(original || jobSkill);
      } else {
        const original = jobSkills.find(
          s => s.toLowerCase().trim() === jobSkill
        );
        missingSkills.push(original || jobSkill);
      }
    }

    const score = Math.round((matchedSkills.length / jobSkills.length) * 100);

    return {
      score,
      matchedSkills,
      missingSkills,
      totalRequired: jobSkills.length,
      totalMatched: matchedSkills.length,
    };
  }

  /**
   * Einfache Skill-Ähnlichkeitsberechnung (Levenshtein-ähnlich).
   */
  private skillSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.8;

    // Einfache Jaccard-Ähnlichkeit basierend auf Zeichen
    const setA = new Set(a.split(''));
    const setB = new Set(b.split(''));
    const intersection = [...setA].filter(x => setB.has(x));
    const union = new Set([...setA, ...setB]);
    return intersection.length / union.size;
  }
}

export const skillMatchService = new SkillMatchService();
