/**
 * security.test.ts — Regression-Locks für geschlossene Sicherheitslücken.
 *
 * Hintergrund: Commit 25ac7ab (Security-Fix Phase 1) hat den ungeschützten
 * POST /api/migrate Endpoint in src/backend/src/index.ts entfernt. Dieser
 * Endpoint führte `pool.query(schema.sql)` ohne Auth/Admin-Verifikation aus —
 * JEDER Internetbesucher konnte die DB-Schema mutieren (DROP TABLE etc.).
 *
 * Diese Tests verriegeln dass der Endpoint WIRKLICH weg ist:
 *
 *   1. POST /api/migrate → 404 UND Body ist NICHT mehr
 *      {"status":"ok","message":"Schema loaded successfully"}.
 *      (Strong-Lock: fängt sowohl Re-Add als auch subtile Refactors ab.)
 *   2. GET /api/migrate → 404 (Method-agnostic Defense-in-Depth, weil
 *      notFoundHandler keine Method-Distinction kennt.)
 *   3. Sanity: notFoundHandler bleibt global aktiv für alle unbekannten
 *      Routes (kein versehentliches Entfernen via app.use-Reihenfolge-Change).
 *
 * Regressionsschutz: falls jemand den Endpoint versehentlich wieder hinzufügt,
 * scheitert CI vor Render-Deploy. Pattern analog zum bestehenden
 * "should give 404 for unknown routes"-Test in e2e.test.ts.
 */

import request from 'supertest';
import app from '../index';

// Retry-Logik fuer CI: Postgres braucht evtl. Zeit zum Starten
async function waitForServer(retries = 3, delayMs = 2000): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await request(app).get('/api/config/status');
      if (res.status === 200) return true;
    } catch {
      // Server noch nicht bereit
    }
    if (i < retries - 1) await new Promise(r => setTimeout(r, delayMs));
  }
  return false;
}

describe('Security: geschlossene Sicherheitslücken (Regression Locks)', () => {
  let serverReady = false;

  beforeAll(async () => {
    serverReady = await waitForServer();
    if (!serverReady) {
      console.warn('SKIP: Security-Tests — Server nicht erreichbar (Postgres?)');
    }
  });

  describe('POST /api/migrate — Endpoint entfernt (Commit 25ac7ab)', () => {
    it('sollte 404 retournieren und NICHT den alten Schema-loaded-Body liefern', async () => {
      if (!serverReady) return;
      const res = await request(app)
        .post('/api/migrate')
        .set('Content-Type', 'application/json')
        .send({});

      // Status-Lock: notFoundHandler feuert (AppError 404 → res.status 404).
      expect(res.status).toBe(404);

      // Strong-Body-Lock: die ursprüngliche Sicherheitslücke war der Body
      // {"status":"ok","message":"Schema loaded successfully"}. Wenn jemand
      // den Endpoint versehentlich re-addet oder durch einen Subroute-Refactor
      // mapped, würde dieser Body wieder auftauchen.
      expect(res.body).not.toMatchObject({
        status: 'ok',
        message: expect.stringMatching(/Schema loaded successfully/i),
      });

      // notFoundHandler wirft AppError("Route not found: ...") → errorHandler
      // mapped das zur Message. Lock: das muss es auch wirklich sein.
      expect(res.body.message).toMatch(/Route not found/i);
    });
  });

  describe('GET /api/migrate — Method-Agnostic Defense', () => {
    it('sollte 404 retournieren (notFoundHandler kennt keine Method-Distinction)', async () => {
      if (!serverReady) return;
      const res = await request(app).get('/api/migrate');
      expect(res.status).toBe(404);
    });
  });

  describe('Sanity: notFoundHandler bleibt global aktiv', () => {
    it('sollte 404 für beliebige unbekannte Routes liefern', async () => {
      if (!serverReady) return;
      const res = await request(app).get('/api/totally-nonexistent-route-xyz');
      expect(res.status).toBe(404);
    });
  });
});
