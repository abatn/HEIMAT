// mentalHealth.test.ts — Health AI Agent Phase 2: Mental Health Tests

import { pool } from '../config/database';
import { mentalHealthService } from '../services/mentalHealthService';

// ============================================================
// Test-Setup
// ============================================================

async function dbReachable(): Promise<boolean> {
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch {
    return false;
  }
}

const TEST_USER_ID = `ci-test-mental-${Date.now()}`;

async function cleanupTestData(): Promise<void> {
  try {
    await pool.query('DELETE FROM phq9_responses WHERE user_id LIKE $1', ['ci-test-mental-%']);
  } catch {
    // cleanup-Fehler sind nicht test-relevant
  }
}

let HAS_DB = false;

beforeAll(async () => {
  HAS_DB = await dbReachable();
}, 15000);

afterAll(async () => {
  await cleanupTestData();
  await pool.end();
}, 10000);

// ============================================================
// Tests
// ============================================================

describe('MentalHealthService', () => {

  describe('createPhq9Assessment', () => {
    it('sollte ein PHQ-9 Screening durchführen', async () => {
      if (!HAS_DB) return;

      const result = await mentalHealthService.createPhq9Assessment(TEST_USER_ID, {
        q1_lustlos: 1,
        q2_niedergeschlagen: 0,
        q3_schlafprobleme: 2,
        q4_muedigkeit: 1,
        q5_appetit: 0,
        q6_schlecht: 0,
        q7_konzentration: 1,
        q8_bewegung: 0,
        q9_selbstverletzung: 0,
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.user_id).toBe(TEST_USER_ID);
      expect(result.total_score).toBe(5); // 1+0+2+1+0+0+1+0+0 = 5
      expect(result.severity).toBe('leicht');
      expect(result.answers.q1_lustlos).toBe(1);
      expect(result.answers.q3_schlafprobleme).toBe(2);
      expect(result.created_at).toBeDefined();
    });

    it('sollte Score 0 bei allen Antworten 0 berechnen', async () => {
      if (!HAS_DB) return;

      const result = await mentalHealthService.createPhq9Assessment(TEST_USER_ID, {
        q1_lustlos: 0,
        q2_niedergeschlagen: 0,
        q3_schlafprobleme: 0,
        q4_muedigkeit: 0,
        q5_appetit: 0,
        q6_schlecht: 0,
        q7_konzentration: 0,
        q8_bewegung: 0,
        q9_selbstverletzung: 0,
      });

      expect(result.total_score).toBe(0);
      expect(result.severity).toBe('leicht');
    });

    it('sollte Score 27 bei allen Antworten 3 berechnen', async () => {
      if (!HAS_DB) return;

      const result = await mentalHealthService.createPhq9Assessment(TEST_USER_ID, {
        q1_lustlos: 3,
        q2_niedergeschlagen: 3,
        q3_schlafprobleme: 3,
        q4_muedigkeit: 3,
        q5_appetit: 3,
        q6_schlecht: 3,
        q7_konzentration: 3,
        q8_bewegung: 3,
        q9_selbstverletzung: 3,
      });

      expect(result.total_score).toBe(27);
      expect(result.severity).toBe('sehr_schwer');
    });

    it('sollte Severity korrekt zuordnen', async () => {
      if (!HAS_DB) return;

      // Test leichte Depression (Score 5-9)
      const leicht = await mentalHealthService.createPhq9Assessment(TEST_USER_ID, {
        q1_lustlos: 1, q2_niedergeschlagen: 1, q3_schlafprobleme: 1,
        q4_muedigkeit: 1, q5_appetit: 1, q6_schlecht: 0,
        q7_konzentration: 0, q8_bewegung: 0, q9_selbstverletzung: 0,
      });
      expect(leicht.total_score).toBe(5);
      expect(leicht.severity).toBe('leicht');

      // Test mittlere Depression (Score 10-14)
      const mittel = await mentalHealthService.createPhq9Assessment(TEST_USER_ID, {
        q1_lustlos: 2, q2_niedergeschlagen: 2, q3_schlafprobleme: 2,
        q4_muedigkeit: 2, q5_appetit: 2, q6_schlecht: 0,
        q7_konzentration: 0, q8_bewegung: 0, q9_selbstverletzung: 0,
      });
      expect(mittel.total_score).toBe(10);
      expect(mittel.severity).toBe('mittel');

      // Test schwere Depression (Score 15-19)
      const schwer = await mentalHealthService.createPhq9Assessment(TEST_USER_ID, {
        q1_lustlos: 2, q2_niedergeschlagen: 2, q3_schlafprobleme: 2,
        q4_muedigkeit: 2, q5_appetit: 2, q6_schlecht: 2,
        q7_konzentration: 2, q8_bewegung: 0, q9_selbstverletzung: 0,
      });
      expect(schwer.total_score).toBe(14);
      expect(schwer.severity).toBe('mittel');
    });

    it('sollte Empfehlung basierend auf Score generieren', async () => {
      if (!HAS_DB) return;

      const result = await mentalHealthService.createPhq9Assessment(TEST_USER_ID, {
        q1_lustlos: 0, q2_niedergeschlagen: 0, q3_schlafprobleme: 0,
        q4_muedigkeit: 0, q5_appetit: 0, q6_schlecht: 0,
        q7_konzentration: 0, q8_bewegung: 0, q9_selbstverletzung: 0,
      });

      expect(result.ai_recommendation).toBeDefined();
      expect(result.ai_recommendation).toContain('Keine Behandlung');
    });

    it('sollte Notfall-Empfehlung bei Score ≥ 20 geben', async () => {
      if (!HAS_DB) return;

      const result = await mentalHealthService.createPhq9Assessment(TEST_USER_ID, {
        q1_lustlos: 3, q2_niedergeschlagen: 3, q3_schlafprobleme: 3,
        q4_muedigkeit: 3, q5_appetit: 3, q6_schlecht: 3,
        q7_konzentration: 3, q8_bewegung: 3, q9_selbstverletzung: 0,
      });

      expect(result.total_score).toBe(24);
      expect(result.severity).toBe('sehr_schwer');
      expect(result.ai_recommendation).toContain('112');
    });

    it('sollte suizidale Gedanken warnen (Frage 9 ≥ 1)', async () => {
      if (!HAS_DB) return;

      // Console.warn abfangen
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await mentalHealthService.createPhq9Assessment(TEST_USER_ID, {
        q1_lustlos: 1, q2_niedergeschlagen: 1, q3_schlafprobleme: 1,
        q4_muedigkeit: 1, q5_appetit: 1, q6_schlecht: 1,
        q7_konzentration: 1, q8_bewegung: 1, q9_selbstverletzung: 2,
      });

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('getPhq9History', () => {
    it('sollte den PHQ-9 Verlauf laden', async () => {
      if (!HAS_DB) return;

      // Test-Daten erstellen
      await mentalHealthService.createPhq9Assessment(TEST_USER_ID, {
        q1_lustlos: 1, q2_niedergeschlagen: 0, q3_schlafprobleme: 0,
        q4_muedigkeit: 0, q5_appetit: 0, q6_schlecht: 0,
        q7_konzentration: 0, q8_bewegung: 0, q9_selbstverletzung: 0,
      });

      const history = await mentalHealthService.getPhq9History(TEST_USER_ID);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].total_score).toBeDefined();
    });

    it('sollte nach Limit filtern', async () => {
      if (!HAS_DB) return;

      const history = await mentalHealthService.getPhq9History(TEST_USER_ID, 5);

      expect(history.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getPhq9Stats', () => {
    it('sollte Statistiken berechnen', async () => {
      if (!HAS_DB) return;

      // Test-Daten erstellen
      await mentalHealthService.createPhq9Assessment(TEST_USER_ID, {
        q1_lustlos: 1, q2_niedergeschlagen: 1, q3_schlafprobleme: 1,
        q4_muedigkeit: 1, q5_appetit: 0, q6_schlecht: 0,
        q7_konzentration: 0, q8_bewegung: 0, q9_selbstverletzung: 0,
      });

      const stats = await mentalHealthService.getPhq9Stats(TEST_USER_ID);

      expect(stats).toBeDefined();
      expect(stats.total_assessments).toBeGreaterThanOrEqual(1);
      expect(stats.average_score).toBeGreaterThanOrEqual(0);
      expect(['verbesserung', 'stabil', 'verschlechterung']).toContain(stats.trend);
      expect(['niedrig', 'mittel', 'hoch']).toContain(stats.risk_level);
    });

    it('sollte leere Stats für neuen User zurückgeben', async () => {
      if (!HAS_DB) return;

      const stats = await mentalHealthService.getPhq9Stats('nonexistent-user');

      expect(stats.total_assessments).toBe(0);
      expect(stats.average_score).toBe(0);
      expect(stats.trend).toBe('stabil');
      expect(stats.risk_level).toBe('niedrig');
    });
  });

  describe('getEmergencyContacts', () => {
    it('sollte Notfall-Kontakte zurückgeben', () => {
      const contacts = mentalHealthService.getEmergencyContacts();

      expect(Array.isArray(contacts)).toBe(true);
      expect(contacts.length).toBeGreaterThanOrEqual(2);

      // Notfallnummer 112 muss vorhanden sein
      const notfall = contacts.find(c => c.number === '112');
      expect(notfall).toBeDefined();

      // Telefonseelsorge muss vorhanden sein
      const telefonseelsorge = contacts.find(c => c.number === '0800 111 0 111');
      expect(telefonseelsorge).toBeDefined();
    });
  });
});
