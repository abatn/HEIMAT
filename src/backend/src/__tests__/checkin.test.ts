// ---------------------------------------------------------------------------
// CheckinService Tests — Phase AI-Health-2 "Lebenszeichen"
//
// Testet die Timer-Logik, Eskalationskette und DB-Operationen des Check-in
// Services. KEINE Mocks — echte DB-Operationen via Pool.
// Pattern: airQualityTest / wasteServiceTest mirror.
// ---------------------------------------------------------------------------

import { checkinService } from '../services/checkinService';
import { pool } from '../config/database';

const TEST_USER_PREFIX = 'test-checkin-user-';
const testUserId = `${TEST_USER_PREFIX}${Date.now()}`;

// Setup: Tabellen erstellen falls nicht vorhanden (self-contained Test)
beforeAll(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS checkin_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id VARCHAR(255) NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT false,
        interval_hours INTEGER DEFAULT 24,
        interval_health_hours INTEGER DEFAULT 6,
        emergency_contact_name VARCHAR(255),
        emergency_contact_phone VARCHAR(50),
        emergency_contact_email VARCHAR(255),
        auto_112_enabled BOOLEAN DEFAULT false,
        last_ping_at TIMESTAMP,
        health_context_symptoms TEXT,
        health_context_reported_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS checkin_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(30) NOT NULL,
        escalation_stage INTEGER DEFAULT 0,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) {
    // Table might already exist, ignore
  }
});

// Cleanup nach Tests
afterAll(async () => {
  await pool.query('DELETE FROM checkin_events WHERE user_id LIKE $1', [`${TEST_USER_PREFIX}%`]);
  await pool.query('DELETE FROM checkin_settings WHERE user_id LIKE $1', [`${TEST_USER_PREFIX}%`]);
  await pool.end();
});

// ==================================================================
// Group 1: activate — Check-in aktivieren
// ==================================================================

describe('activate() — Check-in aktivieren', () => {
  test('should activate with default settings', async () => {
    const settings = await checkinService.activate(testUserId);
    expect(settings).toBeDefined();
    expect(settings.isActive).toBe(true);
    expect(settings.userId).toBe(testUserId);
    expect(settings.intervalHours).toBe(24);
    expect(settings.intervalHealthHours).toBe(6);
    expect(settings.lastPingAt).not.toBeNull();
  });

  test('should activate with custom interval', async () => {
    const customUser = `${testUserId}-custom`;
    const settings = await checkinService.activate(customUser, {
      intervalHours: 12,
      intervalHealthHours: 3,
      emergencyContactName: 'Notfall-Kontakt Test',
      emergencyContactPhone: '+49123456789',
    });

    expect(settings.isActive).toBe(true);
    expect(settings.intervalHours).toBe(12);
    expect(settings.intervalHealthHours).toBe(3);
    expect(settings.emergencyContactName).toBe('Notfall-Kontakt Test');
    expect(settings.emergencyContactPhone).toBe('+49123456789');

    // Cleanup
    await checkinService.deactivate(customUser);
  });

  test('should be idempotent (reactivate with changed settings)', async () => {
    await checkinService.activate(testUserId, { intervalHours: 12 });
    const settings = await checkinService.getSettings(testUserId);
    expect(settings?.intervalHours).toBe(12);

    // Re-activate with different interval
    await checkinService.activate(testUserId, { intervalHours: 48 });
    const updated = await checkinService.getSettings(testUserId);
    expect(updated?.intervalHours).toBe(48);
    expect(updated?.isActive).toBe(true);
  });
});

// ==================================================================
// Group 2: deactivate — Check-in deaktivieren
// ==================================================================

describe('deactivate() — Check-in deaktivieren', () => {
  test('should deactivate active check-in', async () => {
    await checkinService.activate(`${testUserId}-deact`);
    await checkinService.deactivate(`${testUserId}-deact`);
    const status = await checkinService.getStatus(`${testUserId}-deact`);
    expect(status).toBeNull();
  });

  test('should handle deactivation of non-existent user gracefully', async () => {
    // Sollte keinen Fehler werfen wenn nicht aktiv
    await expect(checkinService.deactivate(`${testUserId}-nonexistent`)).resolves.not.toThrow();
  });
});

// ==================================================================
// Group 3: ping — "Mir geht's gut"
// ==================================================================

describe('ping() — Timer zurücksetzen', () => {
  const pingUser = `${testUserId}-ping`;

  beforeAll(async () => {
    await checkinService.activate(pingUser);
  });

  test('should reset timer and return status', async () => {
    const status = await checkinService.ping(pingUser);
    expect(status.isActive).toBe(true);
    expect(status.escalationStage).toBe(0); // Nach Ping: OK
    expect(status.timeSinceLastPingMinutes).toBeLessThan(1); // < 1 Minute
  });

  test('should reject ping for inactive user', async () => {
    await expect(checkinService.ping(`${testUserId}-inactive`)).rejects.toThrow('nicht aktiviert');
  });

  test('should accept health symptoms for adaptive timer', async () => {
    const status = await checkinService.ping(pingUser, 'Brustschmerzen');
    expect(status.healthContextActive).toBe(true);
    expect(status.currentIntervalHours).toBe(6); // Gesundheits-Intervall
  });
});

// ==================================================================
// Group 4: getStatus — Status abrufen
// ==================================================================

describe('getStatus() — Status abrufen', () => {
  const statusUser = `${testUserId}-status`;

  test('should return null for inactive user', async () => {
    const status = await checkinService.getStatus(`${testUserId}-no-settings`);
    expect(status).toBeNull();
  });

  test('should return correct status after activation', async () => {
    await checkinService.activate(statusUser);
    const status = await checkinService.getStatus(statusUser);
    expect(status).not.toBeNull();
    expect(status!.isActive).toBe(true);
    expect(status!.escalationStage).toBe(0); // Gerade aktiviert = OK
    expect(status!.currentIntervalHours).toBe(24);
    expect(status!.healthContextActive).toBe(false);
    expect(status!.nextPingDueAt).not.toBeNull();
  });

  test('should show escalation stage 1 after interval overdue', async () => {
    // Simuliere alten lastPingAt via DB-Manipulation
    const oldDate = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(); // 30h her
    await pool.query(
      'UPDATE checkin_settings SET last_ping_at = $1 WHERE user_id = $2',
      [oldDate, statusUser]
    );
    checkinService.clearCache(statusUser); // Cache invalidieren nach DB-Manipulation

    const status = await checkinService.getStatus(statusUser);
    expect(status).not.toBeNull();
    expect(status!.escalationStage).toBeGreaterThanOrEqual(1);
    expect(status!.timeSinceLastPingMinutes).toBeGreaterThan(24 * 60);
  });
});

// ==================================================================
// Group 5: getSettings — Einstellungen abrufen
// ==================================================================

describe('getSettings() — Einstellungen abrufen', () => {
  test('should return settings for active user', async () => {
    const settings = await checkinService.getSettings(testUserId);
    expect(settings).not.toBeNull();
    expect(settings!.userId).toBe(testUserId);
    expect(settings!.isActive).toBe(true);
  });

  test('should return null for non-existent user', async () => {
    const settings = await checkinService.getSettings(`${testUserId}-nonexistent`);
    expect(settings).toBeNull();
  });
});

// ==================================================================
// Group 6: updateSettings — Einstellungen aktualisieren
// ==================================================================

describe('updateSettings() — Einstellungen aktualisieren', () => {
  test('should update interval settings', async () => {
    const settings = await checkinService.updateSettings(testUserId, {
      intervalHours: 48,
      intervalHealthHours: 12,
    });
    expect(settings.intervalHours).toBe(48);
    expect(settings.intervalHealthHours).toBe(12);
  });

  test('should update emergency contact', async () => {
    const settings = await checkinService.updateSettings(testUserId, {
      emergencyContactName: 'Notfall-Test',
      emergencyContactPhone: '+49111111111',
    });
    expect(settings.emergencyContactName).toBe('Notfall-Test');
    expect(settings.emergencyContactPhone).toBe('+49111111111');
  });

  test('should throw for non-existent user', async () => {
    await expect(checkinService.updateSettings(`${testUserId}-nope`, { intervalHours: 12 }))
      .rejects.toThrow('nicht aktiviert');
  });
});

// ==================================================================
// Group 7: getEvents — Ereignis-Historie
// ==================================================================

describe('getEvents() — Ereignis-Historie', () => {
  const eventsUser = `${testUserId}-events`;

  beforeAll(async () => {
    await checkinService.activate(eventsUser);
    // Ping erzeugt ein 'ping'-Event
    await checkinService.ping(eventsUser);
    await checkinService.ping(eventsUser, 'Kopfschmerzen');
  });

  test('should return recent events for user', async () => {
    const events = await checkinService.getEvents(eventsUser);
    expect(Array.isArray(events)).toBe(true);
    // Mindestens: activate (wenn vorhanden) + 2x ping = 2 Events
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0].eventType).toBe('ping');
    expect(events[0].createdAt).toBeDefined();
  });

  test('should return empty array for non-existent user', async () => {
    const events = await checkinService.getEvents(`${testUserId}-no-events`);
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBe(0);
  });
});

// ==================================================================
// Group 8: computeStatus — Eskalationsstufen-Berechnung
// ==================================================================

describe('computeStatus() — Eskalationsstufen', () => {
  const escUser = `${testUserId}-esc`;

  beforeAll(async () => {
    await checkinService.activate(escUser, { intervalHours: 1, auto112Enabled: true }); // 1h Intervall, auto112 aktiv
  });

  test('should keep stage 0 with recent ping', async () => {
    const status = await checkinService.ping(escUser);
    expect(status.escalationStage).toBe(0);
    expect(status.timeSinceLastPingMinutes).toBeLessThan(1);
  });

  test('should show stage 1 when ping is 1h overdue (simulated)', async () => {
    // Simuliere: letzter Ping vor 3h
    const oldDate = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    await pool.query(
      'UPDATE checkin_settings SET last_ping_at = $1 WHERE user_id = $2',
      [oldDate, escUser]
    );
    checkinService.clearCache(escUser); // Cache invalidieren

    const status = await checkinService.getStatus(escUser);
    expect(status).not.toBeNull();
    // Bei 1h Intervall und 3h seit letztem Ping: Stufe 2 erreicht (1h + 2h)
    expect(status!.escalationStage).toBeGreaterThanOrEqual(2);
  });

  test('should show max stage (4) for very old ping', async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48h her
    await pool.query(
      'UPDATE checkin_settings SET last_ping_at = $1 WHERE user_id = $2',
      [oldDate, escUser]
    );
    checkinService.clearCache(escUser); // Cache invalidieren

    const status = await checkinService.getStatus(escUser);
    expect(status).not.toBeNull();
    expect(status!.escalationStage).toBe(4); // 48h > 1h + 12h
  });
});

// ==================================================================
// Group 9: reportHealthContext — adaptiver Timer bei Symptomen
// ==================================================================

describe('reportHealthContext() — Adaptiver Timer', () => {
  const sympUser = `${testUserId}-symp`;

  beforeAll(async () => {
    await checkinService.activate(sympUser);
  });

  test('should set health context', async () => {
    await checkinService.reportHealthContext(sympUser, 'Rückenschmerzen');
    const settings = await checkinService.getSettings(sympUser);
    expect(settings?.healthContextSymptoms).toBe('Rückenschmerzen');
  });

  test('should shorten interval when health context is active', async () => {
    await checkinService.ping(sympUser, 'Brustschmerzen');
    const status = await checkinService.getStatus(sympUser);
    expect(status?.healthContextActive).toBe(true);
    expect(status?.currentIntervalHours).toBe(6); // Gesundheits-Intervall (kürzer)
  });
});
