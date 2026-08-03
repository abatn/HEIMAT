// healthMemory.test.ts — Health AI Agent: Gedächtnis (Symptom-Verlauf) Tests

import { pool } from '../config/database';
import { healthMemoryService, HealthMemoryEntry } from '../services/healthMemoryService';

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

const TEST_USER_ID = `ci-test-memory-${Date.now()}`;

async function cleanupTestData(): Promise<void> {
  try {
    await pool.query('DELETE FROM health_memory WHERE user_id LIKE $1', ['ci-test-memory-%']);
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

describe('HealthMemoryService', () => {
  
  describe('createMemory', () => {
    it('sollte einen neuen Symptom-Eintrag erstellen', async () => {
      if (!HAS_DB) return;

      const result = await healthMemoryService.createMemory(TEST_USER_ID, {
        symptom_text: 'Kopfschmerzen seit 3 Tagen',
        symptom_category: 'Kopfschmerz',
        severity: 6,
        duration: 'seit 3 Tagen',
        triage_level: 'ROUTINE',
        triage_confidence: 0.8,
        icd_codes: ['R51'],
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.user_id).toBe(TEST_USER_ID);
      expect(result.symptom_text).toBe('Kopfschmerzen seit 3 Tagen');
      expect(result.symptom_category).toBe('Kopfschmerz');
      expect(result.severity).toBe(6);
      expect(result.triage_level).toBe('ROUTINE');
      expect(result.icd_codes).toEqual(['R51']);
      expect(result.is_resolved).toBe(false);
    });

    it('sollte Severity validieren (1-10)', async () => {
      if (!HAS_DB) return;

      await expect(
        healthMemoryService.createMemory(TEST_USER_ID, {
          symptom_text: 'Test',
          severity: 15, // Ungültig
        })
      ).rejects.toThrow('severity muss zwischen 1 und 10 liegen');
    });

    it('sollte optionalen Feldern korrekt handhaben', async () => {
      if (!HAS_DB) return;

      const result = await healthMemoryService.createMemory(TEST_USER_ID, {
        symptom_text: 'Rückenschmerzen',
        location: { lat: 52.52, lng: 13.41 },
        weather_condition: 'Regnerisch',
        season: 'herbst',
        medications_used: ['Ibuprofen'],
      });

      expect(Number(result.location_lat)).toBe(52.52);
      expect(Number(result.location_lng)).toBe(13.41);
      expect(result.weather_condition).toBe('Regnerisch');
      expect(result.season).toBe('herbst');
      expect(result.medications_used).toEqual(['Ibuprofen']);
    });
  });

  describe('getMemory', () => {
    it('sollte den Symptom-Verlauf eines Users laden', async () => {
      if (!HAS_DB) return;

      // Test-Daten erstellen
      await healthMemoryService.createMemory(TEST_USER_ID, {
        symptom_text: 'Test-Symptom 1',
        symptom_category: 'Test',
      });

      const result = await healthMemoryService.getMemory(TEST_USER_ID);

      expect(result.memories).toBeDefined();
      expect(Array.isArray(result.memories)).toBe(true);
      expect(result.count).toBeGreaterThanOrEqual(1);
    });

    it('sollte nach Symptom-Kategorie filtern', async () => {
      if (!HAS_DB) return;

      await healthMemoryService.createMemory(TEST_USER_ID, {
        symptom_text: 'Kopfschmerzen',
        symptom_category: 'Kopfschmerz',
      });

      const result = await healthMemoryService.getMemory(TEST_USER_ID, {
        symptom: 'Kopfschmerz',
      });

      expect(result.memories.length).toBeGreaterThanOrEqual(1);
      expect(result.memories[0].symptom_category).toContain('Kopfschmerz');
    });

    it('sollte nach Tagen filtern', async () => {
      if (!HAS_DB) return;

      const result = await healthMemoryService.getMemory(TEST_USER_ID, {
        days: 7,
      });

      expect(result.memories).toBeDefined();
    });

    it('sollte nach resolved Status filtern', async () => {
      if (!HAS_DB) return;

      const result = await healthMemoryService.getMemory(TEST_USER_ID, {
        resolved: false,
      });

      expect(result.memories).toBeDefined();
      for (const memory of result.memories) {
        expect(memory.is_resolved).toBe(false);
      }
    });
  });

  describe('getMemoryById', () => {
    it('sollte einen einzelnen Eintrag laden', async () => {
      if (!HAS_DB) return;

      const created = await healthMemoryService.createMemory(TEST_USER_ID, {
        symptom_text: 'Einzelner Test',
      });

      const loaded = await healthMemoryService.getMemoryById(TEST_USER_ID, created.id);

      expect(loaded.id).toBe(created.id);
      expect(loaded.symptom_text).toBe('Einzelner Test');
    });

    it('sollte 404 werfen wenn Eintrag nicht existiert', async () => {
      if (!HAS_DB) return;

      await expect(
        healthMemoryService.getMemoryById(TEST_USER_ID, '00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow('Symptom-Eintrag nicht gefunden');
    });
  });

  describe('resolveMemory', () => {
    it('sollte ein Symptom als gelöst markieren', async () => {
      if (!HAS_DB) return;

      const created = await healthMemoryService.createMemory(TEST_USER_ID, {
        symptom_text: 'Zu lösendes Symptom',
      });

      const resolved = await healthMemoryService.resolveMemory(TEST_USER_ID, created.id, {
        doctor_visit: true,
        notes: 'Arzt besucht',
      });

      expect(resolved.is_resolved).toBe(true);
      expect(resolved.resolved_at).toBeDefined();
      expect(resolved.doctor_visit).toBe(true);
    });
  });

  describe('deleteMemory', () => {
    it('sollte einen Eintrag löschen', async () => {
      if (!HAS_DB) return;

      const created = await healthMemoryService.createMemory(TEST_USER_ID, {
        symptom_text: 'Zu löschendes Symptom',
      });

      await healthMemoryService.deleteMemory(TEST_USER_ID, created.id);

      await expect(
        healthMemoryService.getMemoryById(TEST_USER_ID, created.id)
      ).rejects.toThrow('Symptom-Eintrag nicht gefunden');
    });
  });

  describe('getStats', () => {
    it('sollte Statistiken berechnen', async () => {
      if (!HAS_DB) return;

      // Test-Daten erstellen
      await healthMemoryService.createMemory(TEST_USER_ID, {
        symptom_text: 'Statistik-Test 1',
        symptom_category: 'Kopfschmerz',
        severity: 5,
      });

      const stats = await healthMemoryService.getStats(TEST_USER_ID);

      expect(stats).toBeDefined();
      expect(stats.total_entries).toBeGreaterThanOrEqual(1);
      expect(stats.active_symptoms).toBeGreaterThanOrEqual(0);
      expect(stats.resolved_symptoms).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(stats.chronic_patterns)).toBe(true);
      expect(Array.isArray(stats.category_frequency)).toBe(true);
    });
  });

  describe('getRecentForContext', () => {
    it('sollte letze Einträge für Ollama-Kontext laden', async () => {
      if (!HAS_DB) return;

      // Test-Daten erstellen
      await healthMemoryService.createMemory(TEST_USER_ID, {
        symptom_text: 'Kontext-Test',
        severity: 4,
        triage_level: 'ROUTINE',
      });

      const context = await healthMemoryService.getRecentForContext(TEST_USER_ID, 5);

      expect(typeof context).toBe('string');
      if (context) {
        expect(context).toContain('Kontext-Test');
      }
    });

    it('sollte leeren String zurückgeben wenn keine Einträge', async () => {
      if (!HAS_DB) return;

      const context = await healthMemoryService.getRecentForContext('nonexistent-user', 5);

      expect(context).toBe('');
    });
  });
});
