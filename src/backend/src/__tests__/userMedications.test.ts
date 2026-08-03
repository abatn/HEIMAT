// userMedications.test.ts — Health AI Agent: Medikamente Tests

import { pool } from '../config/database';
import { userMedicationsService } from '../services/userMedicationsService';

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

const TEST_USER_ID = `ci-test-meds-${Date.now()}`;

async function cleanupTestData(): Promise<void> {
  try {
    await pool.query('DELETE FROM user_medications WHERE user_id LIKE $1', ['ci-test-meds-%']);
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

describe('UserMedicationsService', () => {
  
  describe('addMedication', () => {
    it('sollte ein neues Medikament hinzufügen', async () => {
      if (!HAS_DB) return;

      const result = await userMedicationsService.addMedication(TEST_USER_ID, {
        name: 'Aspirin',
        active_ingredient: 'ASS',
        dosage: '500mg',
        frequency: 'täglich',
        category: 'Schmerzmittel',
        is_prescription: false,
        start_date: '2026-01-15',
        notes: 'Nur nach dem Essen',
      });

      expect(result).toBeDefined();
      expect(result.medication).toBeDefined();
      expect(result.medication.id).toBeDefined();
      expect(result.medication.user_id).toBe(TEST_USER_ID);
      expect(result.medication.name).toBe('Aspirin');
      expect(result.medication.active_ingredient).toBe('ASS');
      expect(result.medication.dosage).toBe('500mg');
      expect(result.medication.is_active).toBe(true);
      expect(result.interactions).toBeDefined();
      expect(Array.isArray(result.interactions.interactions)).toBe(true);
    });

    it('sollte Interaktionen mit bestehenden Medikamenten prüfen', async () => {
      if (!HAS_DB) return;

      // Erst Ibuprofen hinzufügen
      await userMedicationsService.addMedication(TEST_USER_ID, {
        name: 'Ibuprofen',
        active_ingredient: 'Ibuprofen',
        dosage: '400mg',
      });

      // Dann ASS hinzufügen → sollte Interaktion finden
      const result = await userMedicationsService.addMedication(TEST_USER_ID, {
        name: 'Aspirin',
        active_ingredient: 'ASS',
      });

      expect(result.interactions.interactions.length).toBeGreaterThanOrEqual(1);
      expect(result.interactions.interactions[0].severity).toBe('schwerwiegend');
    });
  });

  describe('getMedications', () => {
    it('sollte alle Medikamente eines Users laden', async () => {
      if (!HAS_DB) return;

      // Test-Medikament erstellen
      await userMedicationsService.addMedication(TEST_USER_ID, {
        name: 'Test-Medikament',
      });

      const result = await userMedicationsService.getMedications(TEST_USER_ID);

      expect(result.medications).toBeDefined();
      expect(Array.isArray(result.medications)).toBe(true);
      expect(result.activeCount).toBeGreaterThanOrEqual(1);
    });

    it('sollte nur aktive Medikamente laden wenn active_only=true', async () => {
      if (!HAS_DB) return;

      const result = await userMedicationsService.getMedications(TEST_USER_ID, {
        active_only: true,
      });

      expect(result.medications).toBeDefined();
      for (const med of result.medications) {
        expect(med.is_active).toBe(true);
      }
    });
  });

  describe('getMedicationById', () => {
    it('sollte ein einzelnes Medikament laden', async () => {
      if (!HAS_DB) return;

      const created = await userMedicationsService.addMedication(TEST_USER_ID, {
        name: 'Einzelnes Test-Medikament',
      });

      const loaded = await userMedicationsService.getMedicationById(
        TEST_USER_ID,
        created.medication.id
      );

      expect(loaded.id).toBe(created.medication.id);
      expect(loaded.name).toBe('Einzelnes Test-Medikament');
    });

    it('sollte 404 werfen wenn Medikament nicht existiert', async () => {
      if (!HAS_DB) return;

      await expect(
        userMedicationsService.getMedicationById(
          TEST_USER_ID,
          '00000000-0000-0000-0000-000000000000'
        )
      ).rejects.toThrow('Medikament nicht gefunden');
    });
  });

  describe('updateMedication', () => {
    it('sollte ein Medikament aktualisieren', async () => {
      if (!HAS_DB) return;

      const created = await userMedicationsService.addMedication(TEST_USER_ID, {
        name: 'Zu aktualisierendes Medikament',
        dosage: '100mg',
      });

      const updated = await userMedicationsService.updateMedication(
        TEST_USER_ID,
        created.medication.id,
        {
          dosage: '200mg',
          notes: 'Neue Dosierung',
        }
      );

      expect(updated.dosage).toBe('200mg');
      expect(updated.notes).toBe('Neue Dosierung');
    });

    it('sollte 400 werfen bei leeren Aktualisierungen', async () => {
      if (!HAS_DB) return;

      const created = await userMedicationsService.addMedication(TEST_USER_ID, {
        name: 'Test',
      });

      await expect(
        userMedicationsService.updateMedication(TEST_USER_ID, created.medication.id, {})
      ).rejects.toThrow('Keine Aktualisierungen angegeben');
    });
  });

  describe('removeMedication', () => {
    it('sollte ein Medikament deaktivieren', async () => {
      if (!HAS_DB) return;

      const created = await userMedicationsService.addMedication(TEST_USER_ID, {
        name: 'Zu entfernendes Medikament',
      });

      await userMedicationsService.removeMedication(TEST_USER_ID, created.medication.id);

      const loaded = await userMedicationsService.getMedicationById(
        TEST_USER_ID,
        created.medication.id
      );

      expect(loaded.is_active).toBe(false);
      expect(loaded.end_date).toBeDefined();
    });
  });

  describe('checkInteractions', () => {
    it('sollte Interaktionen zwischen zwei Medikamenten finden', async () => {
      if (!HAS_DB) return;

      const result = await userMedicationsService.checkInteractions(TEST_USER_ID, [
        'Aspirin',
        'Ibuprofen',
      ]);

      expect(result).toBeDefined();
      expect(result.hasSevereInteraction).toBe(true);
      expect(result.interactions).toBeDefined();
      expect(Array.isArray(result.interactions)).toBe(true);
      expect(result.interactions.length).toBeGreaterThanOrEqual(1);
      expect(result.interactions[0].severity).toBe('schwerwiegend');
    });

    it('sollte leere Liste zurückgeben bei weniger als 2 Medikamenten', async () => {
      if (!HAS_DB) return;

      const result = await userMedicationsService.checkInteractions(TEST_USER_ID, [
        'Aspirin',
      ]);

      expect(result.interactions).toEqual([]);
      expect(result.hasSevereInteraction).toBe(false);
    });

    it('sollte keine Interaktionen finden bei unbekannten Medikamenten', async () => {
      if (!HAS_DB) return;

      const result = await userMedicationsService.checkInteractions(TEST_USER_ID, [
        'VitaminC',
        'Magnesium',
      ]);

      expect(result.interactions).toEqual([]);
      expect(result.hasSevereInteraction).toBe(false);
    });
  });

  describe('checkUserInteractions', () => {
    it('sollte Interaktionen für User-Medikamente prüfen', async () => {
      if (!HAS_DB) return;

      // Test-Medikamente erstellen
      await userMedicationsService.addMedication(TEST_USER_ID, {
        name: 'Aspirin',
      });
      await userMedicationsService.addMedication(TEST_USER_ID, {
        name: 'Ibuprofen',
      });

      const result = await userMedicationsService.checkUserInteractions(TEST_USER_ID);

      expect(result).toBeDefined();
      expect(result.hasSevereInteraction).toBe(true);
    });
  });

  describe('getMedicationsForContext', () => {
    it('sollte Medikamentenliste für Ollama-Kontext laden', async () => {
      if (!HAS_DB) return;

      // Test-Medikament erstellen
      await userMedicationsService.addMedication(TEST_USER_ID, {
        name: 'Kontext-Test-Med',
        dosage: '50mg',
        frequency: 'täglich',
      });

      const context = await userMedicationsService.getMedicationsForContext(TEST_USER_ID);

      expect(typeof context).toBe('string');
      if (context) {
        expect(context).toContain('Kontext-Test-Med');
      }
    });

    it('sollte leeren String zurückgeben wenn keine Medikamente', async () => {
      if (!HAS_DB) return;

      const context = await userMedicationsService.getMedicationsForContext('nonexistent-user');

      expect(context).toBe('');
    });
  });
});
