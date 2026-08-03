// followUp.test.ts — Health AI Agent Phase 2: Nachsorge Tests

import { pool } from '../config/database';
import { followUpService } from '../services/followUpService';

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

const TEST_USER_ID = `ci-test-followup-${Date.now()}`;
const TEST_APPOINTMENT_ID = '00000000-0000-0000-0000-000000000001';
const TEST_DOCTOR_ID = '00000000-0000-0000-0000-000000000002';

async function cleanupTestData(): Promise<void> {
  try {
    await pool.query('DELETE FROM post_appointment_followups WHERE user_id LIKE $1', ['ci-test-followup-%']);
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

describe('FollowUpService', () => {

  describe('createFollowUp', () => {
    it('sollte ein Follow-up nach Termin erstellen', async () => {
      if (!HAS_DB) return;

      const result = await followUpService.createFollowUp(
        TEST_USER_ID,
        TEST_APPOINTMENT_ID,
        TEST_DOCTOR_ID,
        'check_in'
      );

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.user_id).toBe(TEST_USER_ID);
      expect(result.appointment_id).toBe(TEST_APPOINTMENT_ID);
      expect(result.doctor_id).toBe(TEST_DOCTOR_ID);
      expect(result.followup_type).toBe('check_in');
      expect(result.status).toBe('pending');
      expect(result.responded).toBe(false);
      expect(result.followup_date).toBeDefined();
    });

    it('sollte Follow-up-Typ korrekt setzen', async () => {
      if (!HAS_DB) return;

      const medication = await followUpService.createFollowUp(
        TEST_USER_ID,
        TEST_APPOINTMENT_ID,
        TEST_DOCTOR_ID,
        'medication'
      );

      expect(medication.followup_type).toBe('medication');

      const symptom = await followUpService.createFollowUp(
        TEST_USER_ID,
        TEST_APPOINTMENT_ID,
        TEST_DOCTOR_ID,
        'symptom'
      );

      expect(symptom.followup_type).toBe('symptom');
    });
  });

  describe('getPendingFollowUps', () => {
    it('sollte offene Follow-ups laden', async () => {
      if (!HAS_DB) return;

      // Test-Follow-up erstellen
      await followUpService.createFollowUp(
        TEST_USER_ID,
        TEST_APPOINTMENT_ID,
        TEST_DOCTOR_ID
      );

      const pending = await followUpService.getPendingFollowUps(TEST_USER_ID);

      expect(Array.isArray(pending)).toBe(true);
      expect(pending.length).toBeGreaterThanOrEqual(1);
      for (const fu of pending) {
        expect(['pending', 'sent']).toContain(fu.status);
      }
    });
  });

  describe('respondToFollowUp', () => {
    it('sollte User-Antwort speichern', async () => {
      if (!HAS_DB) return;

      // Follow-up erstellen
      const followUp = await followUpService.createFollowUp(
        TEST_USER_ID,
        TEST_APPOINTMENT_ID,
        TEST_DOCTOR_ID
      );

      // Antworte
      const updated = await followUpService.respondToFollowUp(
        followUp.id,
        TEST_USER_ID,
        { text: 'Mir geht es besser', severity: 3 }
      );

      expect(updated).toBeDefined();
      expect(updated!.responded).toBe(true);
      expect(updated!.response_text).toBe('Mir geht es besser');
      expect(updated!.response_severity).toBe(3);
      expect(updated!.status).toBe('responded');
      expect(updated!.responded_at).toBeDefined();
    });

    it('sollte bei Verschlechterung (severity ≥ 5) weiteres Follow-up erstellen', async () => {
      if (!HAS_DB) return;

      // Follow-up erstellen
      const followUp = await followUpService.createFollowUp(
        TEST_USER_ID,
        TEST_APPOINTMENT_ID,
        TEST_DOCTOR_ID
      );

      // Mit schlechter Antwort antworten
      const updated = await followUpService.respondToFollowUp(
        followUp.id,
        TEST_USER_ID,
        { text: 'Es ist schlimmer geworden', severity: 8 }
      );

      expect(updated).toBeDefined();
      expect(updated!.needs_followup).toBe(true);

      // Neues Follow-up sollte erstellt worden sein
      const newPending = await followUpService.getPendingFollowUps(TEST_USER_ID);
      expect(newPending.length).toBeGreaterThanOrEqual(1);
    });

    it('sollte null für nicht gefundenes Follow-up zurückgeben', async () => {
      if (!HAS_DB) return;

      const result = await followUpService.respondToFollowUp(
        '00000000-0000-0000-0000-000000000000',
        TEST_USER_ID,
        { text: 'Test', severity: 1 }
      );

      expect(result).toBeNull();
    });
  });

  describe('getFollowUpHistory', () => {
    it('sollte Follow-up Verlauf laden', async () => {
      if (!HAS_DB) return;

      const history = await followUpService.getFollowUpHistory(TEST_USER_ID);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThanOrEqual(1);
    });

    it('sollte nach Limit filtern', async () => {
      if (!HAS_DB) return;

      const history = await followUpService.getFollowUpHistory(TEST_USER_ID, 5);

      expect(history.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getStats', () => {
    it('sollte Statistiken berechnen', async () => {
      if (!HAS_DB) return;

      const stats = await followUpService.getStats(TEST_USER_ID);

      expect(stats).toBeDefined();
      expect(stats.total_followups).toBeGreaterThanOrEqual(0);
      expect(stats.pending).toBeGreaterThanOrEqual(0);
      expect(stats.responded).toBeGreaterThanOrEqual(0);
      expect(stats.needs_followup).toBeGreaterThanOrEqual(0);
    });
  });

  describe('checkPendingFollowUps', () => {
    it('sollte offene Follow-ups als gesendet markieren', async () => {
      if (!HAS_DB) return;

      const result = await followUpService.checkPendingFollowUps();

      expect(result).toBeDefined();
      expect(typeof result.sent).toBe('number');
      expect(typeof result.skipped).toBe('number');
    });
  });
});
