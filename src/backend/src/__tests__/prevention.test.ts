// prevention.test.ts — Health AI Agent Phase 2: Prävention Tests

import { pool } from '../config/database';
import { preventionService } from '../services/preventionService';

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

const TEST_USER_ID = `ci-test-prevention-${Date.now()}`;

async function cleanupTestData(): Promise<void> {
  try {
    await pool.query('DELETE FROM prevention_recommendations WHERE user_id LIKE $1', ['ci-test-prevention-%']);
    await pool.query('DELETE FROM user_health_profile WHERE user_id LIKE $1', ['ci-test-prevention-%']);
  } catch {
    // cleanup-Fehler sind nicht test-relevant
  }
}

async function createTestProfile(overrides: Partial<{
  birth_date: string;
  gender: string;
  is_smoker: boolean;
  risk_factors: string[];
}> = {}): Promise<void> {
  const defaults = {
    birth_date: '1970-01-01', // 56 Jahre alt
    gender: 'männlich',
    is_smoker: false,
    risk_factors: [] as string[],
  };
  const profile = { ...defaults, ...overrides };

  await pool.query(
    `INSERT INTO user_health_profile (user_id, birth_date, gender, is_smoker, risk_factors)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       birth_date = $2, gender = $3, is_smoker = $4, risk_factors = $5`,
    [TEST_USER_ID, profile.birth_date, profile.gender, profile.is_smoker, profile.risk_factors]
  );
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

describe('PreventionService', () => {

  describe('generateRecommendations', () => {
    it('sollte Empfehlungen für männlichen User ≥50 generieren', async () => {
      if (!HAS_DB) return;

      await createTestProfile({
        birth_date: '1970-01-01', // 56 Jahre
        gender: 'männlich',
      });

      const recommendations = await preventionService.generateRecommendations(TEST_USER_ID);

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThanOrEqual(1);

      // Prostatavorsorge sollte vorhanden sein
      const prostata = recommendations.find(r => r.title === 'Prostatavorsorge');
      expect(prostata).toBeDefined();
      expect(prostata!.category).toBe('Vorsorge');
      expect(prostata!.based_on).toContain('Geschlecht');
    });

    it('sollte Empfehlungen für weiblichen User ≥50 generieren', async () => {
      if (!HAS_DB) return;

      // Cleanup zuerst
      await pool.query('DELETE FROM prevention_recommendations WHERE user_id = $1', [TEST_USER_ID]);

      await createTestProfile({
        birth_date: '1970-01-01',
        gender: 'weiblich',
      });

      const recommendations = await preventionService.generateRecommendations(TEST_USER_ID);

      // Mammographie sollte vorhanden sein
      const mammographie = recommendations.find(r => r.title === 'Mammographie-Screening');
      expect(mammographie).toBeDefined();
    });

    it('sollte Lungenkrebs-Screening für Raucher ≥50 empfehlen', async () => {
      if (!HAS_DB) return;

      await pool.query('DELETE FROM prevention_recommendations WHERE user_id = $1', [TEST_USER_ID]);

      await createTestProfile({
        birth_date: '1970-01-01',
        is_smoker: true,
      });

      const recommendations = await preventionService.generateRecommendations(TEST_USER_ID);

      const lungenkrebs = recommendations.find(r => r.title === 'Lungenkrebs-Screening');
      expect(lungenkrebs).toBeDefined();
      expect(lungenkrebs!.priority).toBe('hoch');
    });

    it('sollte Rauchentwöhnung für Raucher empfehlen', async () => {
      if (!HAS_DB) return;

      await pool.query('DELETE FROM prevention_recommendations WHERE user_id = $1', [TEST_USER_ID]);

      await createTestProfile({
        is_smoker: true,
      });

      const recommendations = await preventionService.generateRecommendations(TEST_USER_ID);

      const rauchentwoehnung = recommendations.find(r => r.title === 'Rauchentwöhnung');
      expect(rauchentwoehnung).toBeDefined();
      expect(rauchentwoehnung!.priority).toBe('hoch');
    });

    it('sollte keine Empfehlungen für User ohne Profil zurückgeben', async () => {
      if (!HAS_DB) return;

      const recommendations = await preventionService.generateRecommendations('nonexistent-user');

      expect(recommendations).toEqual([]);
    });

    it('sollte keine Duplikate erstellen', async () => {
      if (!HAS_DB) return;

      await createTestProfile({
        birth_date: '1970-01-01',
        gender: 'männlich',
      });

      // Erste Generierung
      const first = await preventionService.generateRecommendations(TEST_USER_ID);
      const firstCount = first.length;

      // Zweite Generierung sollte keine neuen erstellen
      const second = await preventionService.generateRecommendations(TEST_USER_ID);

      expect(second.length).toBe(0); // Keine neuen Empfehlungen
    });
  });

  describe('getActiveRecommendations', () => {
    it('sollte aktive Empfehlungen laden', async () => {
      if (!HAS_DB) return;

      const recommendations = await preventionService.getActiveRecommendations(TEST_USER_ID);

      expect(Array.isArray(recommendations)).toBe(true);
      for (const rec of recommendations) {
        expect(rec.is_completed).toBe(false);
      }
    });

    it('sollte nach Priorität sortieren', async () => {
      if (!HAS_DB) return;

      const recommendations = await preventionService.getActiveRecommendations(TEST_USER_ID);

      if (recommendations.length >= 2) {
        const priorityOrder = { 'hoch': 0, 'mittel': 1, 'niedrig': 2 };
        for (let i = 1; i < recommendations.length; i++) {
          const prev = priorityOrder[recommendations[i-1].priority as keyof typeof priorityOrder] ?? 3;
          const curr = priorityOrder[recommendations[i].priority as keyof typeof priorityOrder] ?? 3;
          expect(prev).toBeLessThanOrEqual(curr);
        }
      }
    });
  });

  describe('completeRecommendation', () => {
    it('sollte eine Empfehlung als erledigt markieren', async () => {
      if (!HAS_DB) return;

      const active = await preventionService.getActiveRecommendations(TEST_USER_ID);
      if (active.length === 0) return;

      const completed = await preventionService.completeRecommendation(
        TEST_USER_ID,
        active[0].id
      );

      expect(completed).toBeDefined();
      expect(completed!.is_completed).toBe(true);
      expect(completed!.completed_at).toBeDefined();
    });

    it('sollte null für nicht gefundene Empfehlung zurückgeben', async () => {
      if (!HAS_DB) return;

      const result = await preventionService.completeRecommendation(
        TEST_USER_ID,
        '00000000-0000-0000-0000-000000000000'
      );

      expect(result).toBeNull();
    });
  });

  describe('getCompletedRecommendations', () => {
    it('sollte erledigte Empfehlungen laden', async () => {
      if (!HAS_DB) return;

      const history = await preventionService.getCompletedRecommendations(TEST_USER_ID);

      expect(Array.isArray(history)).toBe(true);
      for (const rec of history) {
        expect(rec.is_completed).toBe(true);
        expect(rec.completed_at).toBeDefined();
      }
    });
  });

  describe('getStats', () => {
    it('sollte Statistiken berechnen', async () => {
      if (!HAS_DB) return;

      const stats = await preventionService.getStats(TEST_USER_ID);

      expect(stats).toBeDefined();
      expect(stats.total_recommendations).toBeGreaterThanOrEqual(0);
      expect(stats.completed).toBeGreaterThanOrEqual(0);
      expect(stats.pending).toBeGreaterThanOrEqual(0);
      expect(stats.high_priority).toBeGreaterThanOrEqual(0);
      expect(stats.completed + stats.pending).toBe(stats.total_recommendations);
    });
  });
});
