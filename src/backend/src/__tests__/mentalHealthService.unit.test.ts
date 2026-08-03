// mentalHealthService.unit.test.ts — Unit Tests für MentalHealthService
//
// Testet die puren Funktionen und Service-Logik ohne Datenbank-Abhängigkeit.

import {
  calculateSeverity,
  getSeverityLabel,
  getRecommendation,
  PHQ9_QUESTIONS,
  PHQ9_SCALE,
} from '../services/mentalHealthService';

// ============================================================
// Tests für pure Funktionen
// ============================================================

describe('MentalHealthService — Pure Functions', () => {

  describe('calculateSeverity', () => {
    it('sollte "leicht" für Score 0-4 zurückgeben', () => {
      expect(calculateSeverity(0)).toBe('leicht');
      expect(calculateSeverity(2)).toBe('leicht');
      expect(calculateSeverity(4)).toBe('leicht');
    });

    it('sollte "leicht" für Score 5-9 zurückgeben', () => {
      expect(calculateSeverity(5)).toBe('leicht');
      expect(calculateSeverity(7)).toBe('leicht');
      expect(calculateSeverity(9)).toBe('leicht');
    });

    it('sollte "mittel" für Score 10-14 zurückgeben', () => {
      expect(calculateSeverity(10)).toBe('mittel');
      expect(calculateSeverity(12)).toBe('mittel');
      expect(calculateSeverity(14)).toBe('mittel');
    });

    it('sollte "schwer" für Score 15-19 zurückgeben', () => {
      expect(calculateSeverity(15)).toBe('schwer');
      expect(calculateSeverity(17)).toBe('schwer');
      expect(calculateSeverity(19)).toBe('schwer');
    });

    it('sollte "sehr_schwer" für Score 20-27 zurückgeben', () => {
      expect(calculateSeverity(20)).toBe('sehr_schwer');
      expect(calculateSeverity(24)).toBe('sehr_schwer');
      expect(calculateSeverity(27)).toBe('sehr_schwer');
    });
  });

  describe('getSeverityLabel', () => {
    it('sollte korrekte Labels zurückgeben', () => {
      expect(getSeverityLabel('leicht')).toContain('Minimal');
      expect(getSeverityLabel('mittel')).toContain('Leichte');
      expect(getSeverityLabel('schwer')).toContain('Mittel');
      expect(getSeverityLabel('sehr_schwer')).toContain('Schwere');
      expect(getSeverityLabel('unbekannt')).toBe('Unbekannt');
    });
  });

  describe('getRecommendation', () => {
    it('sollte "Keine Behandlung" für Score 0-4 empfehlen', () => {
      const rec = getRecommendation(0, 'leicht');
      expect(rec).toContain('Keine Behandlung');
    });

    it('sollte "Beobachten" für Score 5-9 empfehlen', () => {
      const rec = getRecommendation(7, 'leicht');
      expect(rec).toContain('Beobachten');
    });

    it('sollte "Behandlung empfohlen" für Score 10-14 empfehlen', () => {
      const rec = getRecommendation(12, 'mittel');
      expect(rec).toContain('Behandlung');
      expect(rec).toContain('Psychotherapie');
    });

    it('sollte "Intensierte Behandlung" für Score 15-19 empfehlen', () => {
      const rec = getRecommendation(17, 'schwer');
      expect(rec).toContain('Intensivierte');
      expect(rec).toContain('Arzt');
    });

    it('sollte Notfall-Empfehlung für Score 20-27 geben', () => {
      const rec = getRecommendation(22, 'sehr_schwer');
      expect(rec).toContain('112');
      expect(rec).toContain('Telefonseelsorge');
    });
  });

  describe('PHQ9_QUESTIONS', () => {
    it('sollte genau 9 Fragen enthalten', () => {
      expect(PHQ9_QUESTIONS).toHaveLength(9);
    });

    it('sollte für jede Frage eine ID haben', () => {
      for (const q of PHQ9_QUESTIONS) {
        expect(q.id).toBeDefined();
        expect(q.id.length).toBeGreaterThan(0);
      }
    });

    it('sollte für jede Frage eine Frage haben', () => {
      for (const q of PHQ9_QUESTIONS) {
        expect(q.question).toBeDefined();
        expect(q.question.length).toBeGreaterThan(10);
      }
    });

    it('sollte für jede Frage ein Feld haben', () => {
      for (const q of PHQ9_QUESTIONS) {
        expect(q.field).toBeDefined();
        expect(q.field.startsWith('q')).toBe(true);
      }
    });
  });

  describe('PHQ9_SCALE', () => {
    it('sollte 4 Antwortoptionen haben', () => {
      expect(PHQ9_SCALE).toHaveLength(4);
    });

    it('sollte Werte 0-3 haben', () => {
      expect(PHQ9_SCALE[0].value).toBe(0);
      expect(PHQ9_SCALE[1].value).toBe(1);
      expect(PHQ9_SCALE[2].value).toBe(2);
      expect(PHQ9_SCALE[3].value).toBe(3);
    });

    it('sollte deutsche Labels haben', () => {
      expect(PHQ9_SCALE[0].label).toContain('Überhaupt');
      expect(PHQ9_SCALE[3].label).toContain('Fast jeden');
    });
  });
});
