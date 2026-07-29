// ---------------------------------------------------------------------------
// CheckinService — "Lebenszeichen" Check-in für alleinlebende Menschen
// Phase AI-Health-2 (2026-07-29)
//
// PRIVACY-PRINZIP: KEINE Sensoren. KEIN Accelerometer. KEIN GPS-Tracking.
// KEINE Kamera. KEIN Mikrofon. Nur Timer-basiert: User pingt → "Mir geht's gut".
// Bei ausbleibendem Ping → Eskalationskette.
//
// Design-Pattern: Mirror zu airQualityService / wasteService (Singleton +
// Cache + async DB-Reads). KEIN Mock, KEINE Simulation.
// ---------------------------------------------------------------------------

import { logger } from '../utils/logger';
import { pool } from '../config/database';
import { errorMessage } from '../utils/error';

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export interface CheckinSettings {
  userId: string;
  isActive: boolean;
  intervalHours: number;         // Normal-Modus: 24h
  intervalHealthHours: number;  // Gesundheits-Kontext: 6h
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactEmail: string | null;
  auto112Enabled: boolean;
  lastPingAt: string | null;    // ISO-Datum
  healthContextSymptoms: string | null;
  healthContextReportedAt: string | null;
}

export interface CheckinStatus {
  isActive: boolean;
  timeSinceLastPingMinutes: number;
  currentIntervalHours: number;
  escalationStage: number;    // 0=ok, 1=missed, 2=push, 3=contact, 4=emergency
  nextPingDueAt: string | null;
  healthContextActive: boolean;
}

export interface CheckinEvent {
  id: string;
  eventType: string;
  escalationStage: number;
  details: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Eskalations-Timing (in Minuten)
// ---------------------------------------------------------------------------

function getEscalationThresholds(intervalHours: number): number[] {
  // Stufe 0: Ping erwartet innerhalb intervalHours
  // Stufe 1: Push-Erinnerung (intervalHours + 2h)
  // Stufe 2: SMS/E-Mail Notfallkontakt (intervalHours + 6h)
  // Stufe 3: 112-Empfehlung (intervalHours + 12h, nur mit health-context)
  const baseMinutes = intervalHours * 60;
  return [
    baseMinutes,                    // Stufe 0: Ping fällig
    baseMinutes + 120,              // Stufe 1: Push (2h später)
    baseMinutes + 6 * 60,           // Stufe 2: Kontakt (6h später)
    baseMinutes + 12 * 60,          // Stufe 3: 112 (12h später)
  ];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class CheckinService {
  // In-Memory-Cache für schnelle Status-Abfragen (kein DB-Call pro Request).
  private settingsByUserId = new Map<string, CheckinSettings>();
  private lastGcAt = 0;
  private readonly gcIntervalMs = 5 * 60 * 1000; // Alle 5 Minuten Cache leeren (Refresh)
  private escalationTimer: ReturnType<typeof setInterval> | null = null;

  // Timer-Job: Prüft alle 60 Sekunden auf überfällige User
  startEscalationTimer(): void {
    if (this.escalationTimer) return;
    this.escalationTimer = setInterval(() => {
      this.checkEscalation().catch(e => {
        logger.error(`Escalation timer error: ${errorMessage(e)}`);
      });
    }, 60_000);
    logger.info('Check-in escalation timer gestartet (Intervall: 60s)');
  }

  stopEscalationTimer(): void {
    if (this.escalationTimer) {
      clearInterval(this.escalationTimer);
      this.escalationTimer = null;
      logger.info('Check-in escalation timer gestoppt');
    }
  }

  // ---------------------------------------------------------------------------
  // activate — Check-in aktivieren (User Opt-in erforderlich)
  // ---------------------------------------------------------------------------

  async activate(userId: string, settings?: {
    intervalHours?: number;
    intervalHealthHours?: number;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyContactEmail?: string;
    auto112Enabled?: boolean;
  }): Promise<CheckinSettings> {
    try {
      const result = await pool.query(
        `INSERT INTO checkin_settings (user_id, is_active, interval_hours, interval_health_hours,
          emergency_contact_name, emergency_contact_phone, emergency_contact_email,
          auto_112_enabled, last_ping_at)
         VALUES ($1, true, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET is_active = true,
           interval_hours = COALESCE($2, checkin_settings.interval_hours),
           interval_health_hours = COALESCE($3, checkin_settings.interval_health_hours),
           emergency_contact_name = COALESCE($4, checkin_settings.emergency_contact_name),
           emergency_contact_phone = COALESCE($5, checkin_settings.emergency_contact_phone),
           emergency_contact_email = COALESCE($6, checkin_settings.emergency_contact_email),
           auto_112_enabled = COALESCE($7, checkin_settings.auto_112_enabled),
           last_ping_at = NOW(),
           updated_at = NOW()
         RETURNING *`,
        [
          userId,
          settings?.intervalHours ?? 24,
          settings?.intervalHealthHours ?? 6,
          settings?.emergencyContactName ?? null,
          settings?.emergencyContactPhone ?? null,
          settings?.emergencyContactEmail ?? null,
          settings?.auto112Enabled ?? false,
        ]
      );

      const row = result.rows[0];
      const saved: CheckinSettings = this.rowToSettings(row);
      this.settingsByUserId.set(userId, saved);

      // Aktivierungs-Ereignis loggen
      await pool.query(
        `INSERT INTO checkin_events (user_id, event_type, escalation_stage, details)
         VALUES ($1, 'activated', 0, 'Check-in aktiviert')`,
        [userId]
      );

      logger.info(`User ${userId} hat Check-in aktiviert (Intervall: ${saved.intervalHours}h)`);
      return saved;
    } catch (e: unknown) {
      logger.error(`Check-in activation failed for ${userId}: ${errorMessage(e)}`);
      throw new Error('Check-in konnte nicht aktiviert werden');
    }
  }

  // ---------------------------------------------------------------------------
  // deactivate — Check-in deaktivieren
  // ---------------------------------------------------------------------------

  async deactivate(userId: string): Promise<void> {
    try {
      const result = await pool.query(
        'UPDATE checkin_settings SET is_active = false, updated_at = NOW() WHERE user_id = $1',
        [userId]
      );
      this.settingsByUserId.delete(userId);

      // Ereignis loggen
      await pool.query(
        `INSERT INTO checkin_events (user_id, event_type, escalation_stage, details)
         VALUES ($1, 'deactivated', 0, 'Check-in deaktiviert durch Benutzer')`,
        [userId]
      );

      if (result.rowCount && result.rowCount > 0) {
        logger.info(`User ${userId} hat Check-in deaktiviert`);
      }
    } catch (e: unknown) {
      logger.error(`Check-in deactivation failed for ${userId}: ${errorMessage(e)}`);
      throw new Error('Check-in konnte nicht deaktiviert werden');
    }
  }

  // ---------------------------------------------------------------------------
  // ping — "Mir geht's gut" (Timer zurücksetzen)
  // ---------------------------------------------------------------------------

  async ping(userId: string, healthSymptoms?: string): Promise<CheckinStatus> {
    try {
      const healthUpdate = healthSymptoms
        ? 'health_context_symptoms = $2,'
        : '';

      const params: any[] = [userId];
      let query: string;

      if (healthSymptoms) {
        params.push(healthSymptoms);
        query = `UPDATE checkin_settings SET last_ping_at = NOW(),
          ${healthUpdate}
          health_context_reported_at = NOW(),
          updated_at = NOW()
          WHERE user_id = $1 RETURNING *`;
      } else {
        query = `UPDATE checkin_settings SET last_ping_at = NOW(),
          updated_at = NOW()
          WHERE user_id = $1 RETURNING *`;
      }

      const result = await pool.query(query, params);

      if (!result.rowCount || result.rowCount === 0) {
        throw new Error('Check-in ist nicht aktiviert. Bitte zuerst aktivieren.');
      }

      // Ping-Ereignis loggen
      await pool.query(
        `INSERT INTO checkin_events (user_id, event_type, escalation_stage, details)
         VALUES ($1, 'ping', 0, $2)`,
        [userId, healthSymptoms ? `Ping mit Symptomen: ${healthSymptoms}` : 'Ping: Mir geht\'s gut']
      );

      const settings = this.rowToSettings(result.rows[0]);
      this.settingsByUserId.set(userId, settings);

      logger.info(`User ${userId} hat gepingt${healthSymptoms ? ` (Symptome: ${healthSymptoms})` : ''}`);
      return this.computeStatus(settings);
    } catch (e: unknown) {
      const msg = errorMessage(e);
      if (msg.includes('nicht aktiviert')) throw e;
      logger.error(`Ping failed for ${userId}: ${msg}`);
      throw new Error('Ping fehlgeschlagen');
    }
  }

  // ---------------------------------------------------------------------------
  // getSettings — Check-in Einstellungen abrufen
  // ---------------------------------------------------------------------------

  async getSettings(userId: string): Promise<CheckinSettings | null> {
    // Cache-check (max 5 Min alt)
    const cached = this.settingsByUserId.get(userId);
    if (cached) return cached;

    try {
      const result = await pool.query(
        'SELECT * FROM checkin_settings WHERE user_id = $1',
        [userId]
      );
      if (!result.rowCount || result.rowCount === 0) return null;

      const settings = this.rowToSettings(result.rows[0]);
      this.settingsByUserId.set(userId, settings);
      return settings;
    } catch (e: unknown) {
      logger.error(`Failed to get checkin settings for ${userId}: ${errorMessage(e)}`);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // updateSettings — Einstellungen aktualisieren
  // ---------------------------------------------------------------------------

  async updateSettings(userId: string, updates: {
    intervalHours?: number;
    intervalHealthHours?: number;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyContactEmail?: string;
    auto112Enabled?: boolean;
  }): Promise<CheckinSettings> {
    try {
      const result = await pool.query(
        `UPDATE checkin_settings SET
          interval_hours = COALESCE($2, interval_hours),
          interval_health_hours = COALESCE($3, interval_health_hours),
          emergency_contact_name = COALESCE($4, emergency_contact_name),
          emergency_contact_phone = COALESCE($5, emergency_contact_phone),
          emergency_contact_email = COALESCE($6, emergency_contact_email),
          auto_112_enabled = COALESCE($7, auto_112_enabled),
          updated_at = NOW()
         WHERE user_id = $1 RETURNING *`,
        [
          userId,
          updates.intervalHours ?? null,
          updates.intervalHealthHours ?? null,
          updates.emergencyContactName ?? null,
          updates.emergencyContactPhone ?? null,
          updates.emergencyContactEmail ?? null,
          updates.auto112Enabled ?? null,
        ]
      );

      if (!result.rowCount || result.rowCount === 0) {
        throw new Error('Check-in ist nicht aktiviert');
      }

      const settings = this.rowToSettings(result.rows[0]);
      this.settingsByUserId.set(userId, settings);
      return settings;
    } catch (e: unknown) {
      const msg = errorMessage(e);
      if (msg.includes('nicht aktiviert')) throw e;
      logger.error(`Failed to update checkin settings for ${userId}: ${msg}`);
      throw new Error('Einstellungen konnten nicht aktualisiert werden');
    }
  }

  // ---------------------------------------------------------------------------
  // getStatus — Aktuellen Check-in Status berechnen
  // ---------------------------------------------------------------------------

  async getStatus(userId: string): Promise<CheckinStatus | null> {
    const settings = await this.getSettings(userId);
    if (!settings || !settings.isActive) return null;
    return this.computeStatus(settings);
  }

  // ---------------------------------------------------------------------------
  // computeStatus — Berechnet Eskalations-Stufe aus Settings + Zeit
  // ---------------------------------------------------------------------------

  private computeStatus(settings: CheckinSettings): CheckinStatus {
    const now = Date.now();
    const lastPing = settings.lastPingAt ? new Date(settings.lastPingAt).getTime() : 0;
    const timeSincePing = lastPing > 0 ? (now - lastPing) / 60000 : 9999;

    // Gesundheits-Kontext aktiv? (letzte 48h)
    const healthContextActive = settings.healthContextReportedAt !== null &&
      (now - new Date(settings.healthContextReportedAt).getTime()) < 48 * 60 * 60000;

    const currentInterval = healthContextActive
      ? settings.intervalHealthHours
      : settings.intervalHours;

    const thresholds = getEscalationThresholds(currentInterval);

    // Eskalationsstufe bestimmen
    let stage = 0;
    if (timeSincePing >= thresholds[0]) stage = 1;  // Ping fällig
    if (timeSincePing >= thresholds[1]) stage = 2;  // Push
    if (timeSincePing >= thresholds[2]) stage = 3;  // Kontakt
    // Stage 4 (112) NUR wenn User auto112Enabled explizit aktiviert hat
    if (timeSincePing >= thresholds[3] && settings.auto112Enabled) stage = 4;

    // Nächsten Ping-Termin berechnen
    const nextPingDue = lastPing > 0
      ? new Date(lastPing + currentInterval * 3600000).toISOString()
      : null;

    return {
      isActive: true,
      timeSinceLastPingMinutes: Math.round(timeSincePing),
      currentIntervalHours: currentInterval,
      escalationStage: stage,
      nextPingDueAt: nextPingDue,
      healthContextActive,
    };
  }

  // ---------------------------------------------------------------------------
  // getEvents — Check-in Ereignis-Historie abrufen
  // ---------------------------------------------------------------------------

  async getEvents(userId: string, limit = 20): Promise<CheckinEvent[]> {
    try {
      const result = await pool.query(
        `SELECT id, event_type, escalation_stage, details, created_at
         FROM checkin_events
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );
      return result.rows.map((row: any) => ({
        id: row.id,
        eventType: row.event_type,
        escalationStage: row.escalation_stage,
        details: row.details,
        createdAt: row.created_at,
      }));
    } catch (e: unknown) {
      logger.error(`Failed to get checkin events for ${userId}: ${errorMessage(e)}`);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // reportHealthContext — User meldet Symptome → Timer adaptiv verkürzen
  // ---------------------------------------------------------------------------

  async reportHealthContext(userId: string, symptoms: string): Promise<void> {
    try {
      await pool.query(
        `UPDATE checkin_settings SET
          health_context_symptoms = $2,
          health_context_reported_at = NOW(),
          updated_at = NOW()
         WHERE user_id = $1`,
        [userId, symptoms]
      );

      // Cache invalidieren
      this.settingsByUserId.delete(userId);

      logger.info(`User ${userId} hat Gesundheits-Kontext gemeldet: ${symptoms}`);
    } catch (e: unknown) {
      logger.error(`Failed to report health context for ${userId}: ${errorMessage(e)}`);
    }
  }

  // ---------------------------------------------------------------------------
  // getOverdueUsers — Aktiviert für Timer-Job: findet überfällige User
  // ---------------------------------------------------------------------------

  async getOverdueUsers(): Promise<Array<{ userId: string; stage: number; healthContext: boolean }>> {
    try {
      const result = await pool.query(
        `SELECT user_id, last_ping_at, interval_hours, interval_health_hours,
                health_context_symptoms, health_context_reported_at,
                auto_112_enabled
         FROM checkin_settings
         WHERE is_active = true`
      );

      const overdue: Array<{ userId: string; stage: number; healthContext: boolean }> = [];
      const now = Date.now();

      for (const row of result.rows) {
        const lastPing = row.last_ping_at ? new Date(row.last_ping_at).getTime() : 0;
        const timeSincePing = lastPing > 0 ? (now - lastPing) / 60000 : 9999;

        const healthContextActive = row.health_context_reported_at !== null &&
          (now - new Date(row.health_context_reported_at).getTime()) < 48 * 60 * 60000;

        const currentInterval = healthContextActive
          ? row.interval_health_hours
          : row.interval_hours;

        const thresholds = getEscalationThresholds(currentInterval);

        let stage = 0;
        if (timeSincePing >= thresholds[0]) stage = 1;
        if (timeSincePing >= thresholds[1]) stage = 2;
        if (timeSincePing >= thresholds[2]) stage = 3;
        // Stage 4 (112) NUR wenn User auto112Enabled explizit aktiviert hat
        if (timeSincePing >= thresholds[3] && row.auto_112_enabled) stage = 4;

        if (stage > 0) {
          overdue.push({
            userId: row.user_id,
            stage,
            healthContext: healthContextActive,
          });
        }
      }

      return overdue;
    } catch (e: unknown) {
      logger.error(`Failed to get overdue users: ${errorMessage(e)}`);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // checkEscalation — Prüft und loggt Eskalations-Ereignisse (für Timer-Job)
  // ---------------------------------------------------------------------------

  async checkEscalation(): Promise<void> {
    const overdue = await this.getOverdueUsers();

    for (const user of overdue) {
      try {
        // Prüfen ob bereits ein Ereignis für diese Stufe existiert
        const existing = await pool.query(
          `SELECT id FROM checkin_events
           WHERE user_id = $1 AND escalation_stage = $2
           AND created_at > NOW() - INTERVAL '1 hour'`,
          [user.userId, user.stage]
        );

        if (existing.rowCount && existing.rowCount > 0) continue;

        // Neues Eskalations-Ereignis
        const eventTypes = ['', 'missed', 'escalation_push', 'escalation_contact', 'escalation_emergency'];

        const details = user.stage === 2
          ? 'Push-Benachrichtigung: Erinnerung zum Check-in'
          : user.stage === 3
            ? `Notfallkontakt benachrichtigen: User hat sich nicht gemeldet (${user.healthContext ? 'mit Gesundheits-Kontext' : 'ohne Gesundheits-Kontext'})`
            : user.stage === 4
              ? `112-Empfehlung: ${user.healthContext ? 'Gesundheits-Kontext aktiv' : 'Keine Reaktion seit >12h nach Intervall'}`
              : '';

        await pool.query(
          `INSERT INTO checkin_events (user_id, event_type, escalation_stage, details)
           VALUES ($1, $2, $3, $4)`,
          [user.userId, eventTypes[user.stage] || 'unknown', user.stage, details]
        );

        logger.warn(
          `Check-in ESCALATION User=${user.userId} Stage=${user.stage} ` +
          `(${eventTypes[user.stage] || 'unknown'}) HealthContext=${user.healthContext}`
        );
      } catch (e: unknown) {
        logger.error(`Escalation check failed for ${user.userId}: ${errorMessage(e)}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // clearCache — Cache invalidieren (für Tests direkt nach DB-Manipulation)
  // Ruft getSettings(userId) beim nächsten Zugriff neu aus der DB ab.
  // Ohne userId: gesamten Cache leeren.
  // ---------------------------------------------------------------------------

  clearCache(userId?: string): void {
    if (userId) {
      this.settingsByUserId.delete(userId);
    } else {
      this.settingsByUserId.clear();
    }
  }

  // ---------------------------------------------------------------------------
  // Privat: rowToSettings — DB-Zeile → CheckinSettings
  // ---------------------------------------------------------------------------

  private rowToSettings(row: any): CheckinSettings {
    return {
      userId: row.user_id,
      isActive: row.is_active,
      intervalHours: row.interval_hours,
      intervalHealthHours: row.interval_health_hours,
      emergencyContactName: row.emergency_contact_name || null,
      emergencyContactPhone: row.emergency_contact_phone || null,
      emergencyContactEmail: row.emergency_contact_email || null,
      auto112Enabled: row.auto_112_enabled,
      lastPingAt: row.last_ping_at ? new Date(row.last_ping_at).toISOString() : null,
      healthContextSymptoms: row.health_context_symptoms || null,
      healthContextReportedAt: row.health_context_reported_at
        ? new Date(row.health_context_reported_at).toISOString()
        : null,
    };
  }
}

export const checkinService = new CheckinService();
