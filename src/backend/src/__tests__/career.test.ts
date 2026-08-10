// career.test.ts — Tests für Karriere-Pfad Service
//
// Tests: Karriere-Advice, Lernpfade, Verfügbarkeit

import { careerService } from '../services/careerService';

describe('CareerService', () => {
  // ------------------------------------------------------------------
  // Karriere-Advice
  // ------------------------------------------------------------------

  describe('getCareerAdvice', () => {
    it('sollte Karriere-Pfad für Krankenpfleger liefern', async () => {
      const result = await careerService.getCareerAdvice('Krankenpfleger');
      
      expect(result.currentRole).toBe('Krankenpfleger');
      expect(result.nextRoles.length).toBeGreaterThan(0);
      expect(result.nextRoles[0].role).toBeDefined();
      expect(result.nextRoles[0].missingSkills.length).toBeGreaterThan(0);
      expect(result.nextRoles[0].learningPaths.length).toBeGreaterThan(0);
    });

    it('sollte Karriere-Pfad für Entwickler liefern', async () => {
      const result = await careerService.getCareerAdvice('Entwickler');
      
      expect(result.currentRole).toBe('Entwickler');
      expect(result.nextRoles.length).toBeGreaterThan(0);
    });

    it('sollte Karriere-Pfad für Koch liefern', async () => {
      const result = await careerService.getCareerAdvice('Koch');
      
      expect(result.currentRole).toBe('Koch');
      expect(result.nextRoles.length).toBeGreaterThan(0);
    });

    it('sollte teilweises Matching unterstützen', async () => {
      // "Senior Python Entwickler" sollte "entwickler" finden
      const result = await careerService.getCareerAdvice('Senior Python Entwickler');
      
      expect(result.currentRole).toBe('Entwickler');
      expect(result.nextRoles.length).toBeGreaterThan(0);
    });

    it('sollte leere Ergebnisse für unbekannte Berufe liefern', async () => {
      const result = await careerService.getCareerAdvice('Asteroid-Bergbauer');
      
      expect(result.currentRole).toBe('Asteroid-Bergbauer');
      expect(result.nextRoles).toHaveLength(0);
    });
  });

  // ------------------------------------------------------------------
  // Lernpfade
  // ------------------------------------------------------------------

  describe('Lernpfade', () => {
    it('sollte Lernpfade für Teamführung enthalten', async () => {
      const result = await careerService.getCareerAdvice('Krankenpfleger');
      
      // Stationsleiter braucht Teamführung
      const stationsleiter = result.nextRoles.find(
        r => r.role === 'Stationsleiter'
      );
      
      expect(stationsleiter).toBeDefined();
      expect(stationsleiter!.missingSkills).toContain('Teamführung');
      
      // Lernpfad sollte Kurse enthalten
      const teamführungPaths = stationsleiter!.learningPaths.filter(
        p => p.skill === 'Teamführung'
      );
      expect(teamführungPaths.length).toBeGreaterThan(0);
      expect(teamführungPaths[0].course).toBeDefined();
      expect(teamführungPaths[0].duration).toBeDefined();
    });
  });
});
