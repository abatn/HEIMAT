// skillMatch.test.ts — Tests für Skill-Matching Service
//
// Kein Mock für Ollama — echte API-Calls (wenn Ollama verfügbar)
// Tests: Skill-Extraktion, Match-Score Berechnung

import { skillMatchService } from '../services/skillMatchService';

// Timeout für Ollama-Calls
jest.setTimeout(30_000);

describe('SkillMatchService', () => {
  // ------------------------------------------------------------------
  // Match-Score Berechnung (rein deterministisch, kein Ollama)
  // ------------------------------------------------------------------

  describe('calculateMatch', () => {
    it('sollte 100% bei perfektem Match berechnen', () => {
      const result = skillMatchService.calculateMatch(
        ['Python', 'React', 'Docker'],
        ['Python', 'React', 'Docker']
      );
      expect(result.score).toBe(100);
      expect(result.missingSkills).toHaveLength(0);
      expect(result.matchedSkills).toHaveLength(3);
    });

    it('sollte 0% bei keinem Match berechnen', () => {
      const result = skillMatchService.calculateMatch(
        ['Kochen', 'Gärtnern'],
        ['Python', 'React', 'Docker']
      );
      expect(result.score).toBe(0);
      expect(result.missingSkills).toHaveLength(3);
      expect(result.matchedSkills).toHaveLength(0);
    });

    it('sollte 67% bei 2 von 3 Skills berechnen', () => {
      const result = skillMatchService.calculateMatch(
        ['Python', 'Docker'],
        ['Python', 'React', 'Docker']
      );
      expect(result.score).toBe(67);
      expect(result.missingSkills).toHaveLength(1);
      expect(result.matchedSkills).toHaveLength(2);
    });

    it('sollte Teil-Matches erkennen (inklusive Strings)', () => {
      const result = skillMatchService.calculateMatch(
        ['javascript', 'react'],
        ['JavaScript', 'React', 'TypeScript']
      );
      expect(result.score).toBe(67);
    });

    it('sollte 100% zurückgeben wenn keine Job-Skills angegeben', () => {
      const result = skillMatchService.calculateMatch(
        ['Python', 'React'],
        []
      );
      expect(result.score).toBe(100);
    });
  });

  // ------------------------------------------------------------------
  // Skill-Extraktion (Ollama oder Fallback)
  // ------------------------------------------------------------------

  describe('extractSkills', () => {
    it('sollte Skills aus einer Tech-Job-Beschreibung extrahieren', async () => {
      const description = `
        Wir suchen einen Senior Python Entwickler mit Erfahrung in:
        - Python, Django, FastAPI
        - PostgreSQL, Redis
        - Docker, Kubernetes
        - CI/CD Pipelines
        - Teamführung (3+ Jahre)
      `;

      const result = await skillMatchService.extractSkills(description);
      
      expect(result.skills).toBeDefined();
      expect(Array.isArray(result.skills)).toBe(true);
      expect(result.skills.length).toBeGreaterThan(0);
      
      // Mindestens Python sollte erkannt werden (auch im Fallback)
      const hasPython = result.skills.some(s => 
        s.toLowerCase().includes('python')
      );
      expect(hasPython).toBe(true);
    });

    it('sollte Skills aus einer Pflege-Job-Beschreibung extrahieren', async () => {
      const description = `
        Gesucht: Pflegefachkraft (m/w/d)
        - Pflegeerfahrung mindestens 1 Jahr
        - Medizinische Grundkenntnisse
        - Patientenkontakt
        - Führerschein Klasse B
        - Teamfähig
      `;

      const result = await skillMatchService.extractSkills(description);
      
      expect(result.skills).toBeDefined();
      expect(result.skills.length).toBeGreaterThan(0);
    });
  });
});
