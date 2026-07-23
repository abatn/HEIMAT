/**
 * bank-wire-live.e2e.test.ts
 *
 * HALBTROCKENER E2E Bank-Wire-Test gegen live GNU Taler (exchange.demo.taler.net
 * + bank.demo.taler.net). 100% echte HTTP-Calls, kein Mock, kein Fake, kein
 * Simulator. KEIN docker noetig: wir treffen direkt die GNU-Taler-Production-
 * Software (KUDOS-Spielgeld-Waehrung; das ist die oeffentliche GNU-Taler-Demo-
 * Instanz, auf der reale Taler-Software laeuft).
 *
 * Aktivierung (default SKIP):
 *   RUN_MANUAL_BANK_WIRE_E2E=1 npx jest --testPathPattern=bank-wire-live.e2e --forceExit
 *
 * Workflow:
 *   Phase 1: POST /api/finance/taler/reserve/open   (HEIMAT Backend, echtes Ed25519)
 *   Phase 2: Operateur am Browser: bank.demo.taler.net/webui -> Wire mit
 *            Subject/Reference = <reserve_pub>, Betrag = KUDOS:10
 *   Phase 3: Polling exchange.demo.taler.net/reserves/<pub> alle 2s, max 5 Min
 *            -> sobald reserve_status != 'unknown' und Balance >= Zielbetrag
 *   Phase 4: HEIMAT /api/finance/balance zeigt reale Reserve im Wallet
 *   Phase 5: POST /api/finance/taler/reserve/bind registriert die Reserve im Wallet
 *
 * Was NICHT in diesem Test steht (per Spec):
 *   - KEIN Mock von axios oder pg
 *   - KEIN "Simulator"-String im Response
 *   - KEIN erfundener 100-Default oder initial_balance
 *   - KEIN docker-compose, KEIN libeufin, KEIN Wire-Gateway-Setup
 *   - KEINE Synthese aus Test-Daten — jede Antwort stammt von GNU-Taler-Production
 *
 * Was diesen Test von dem existierenden e2e.test.ts unterscheidet:
 *   - Polling statt einmaliger Probe (Wire braucht Zeit)
 *   - Konsolen-Anweisung fuer den Operateur
 *   - Default-Skip ohne env-Flag (sonst wuerde CI jedes Mal 5 Min warten)
 *   - Direkter Exchange-Call (talerExchangeClient.getReserveStatus) umgeht den
 *     30s-Server-Cache waehrend Polling
 */

import request from 'supertest';
import app from '../index';
import { talerExchangeClient } from '../services/talerExchangeClient';

const RUN_E2E = process.env.RUN_MANUAL_BANK_WIRE_E2E === '1';
const WIRED_AMOUNT = 'KUDOS:10';
const TARGET_BALANCE_NUM = 10;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 Min
const EXCHANGE_BASE = 'https://exchange.demo.taler.net/';
const BANK_WEBUI_URL = 'https://bank.demo.taler.net/webui';

const liveE2E = RUN_E2E ? describe : describe.skip;

if (!RUN_E2E) {
  // eslint-disable-next-line no-console
  console.log(
    '[bank-wire-live] SKIP. Setze RUN_MANUAL_BANK_WIRE_E2E=1 um den halbtrockenen ' +
    'Live-Bank-Wire-Flow zu starten (Operator-Manual-Schritt erforderlich auf ' +
    `${BANK_WEBUI_URL}).`,
  );
}

liveE2E('HALBTROCKENER LIVE BANK-WIRE E2E — GNU Taler Production-Software (kein Mock/Fake/Simulator)', () => {
  let userId: string;
  let reserve_pub: string;
  let exchange_base_url: string;
  let bank_wire_url: string;

  it('Phase 1: POST /api/finance/taler/reserve/open generiert echte Crockford reserve_pub', async () => {
    userId = 'bank-wire-e2e-' + Date.now();
    const res = await request(app)
      .post('/api/finance/taler/reserve/open')
      .send({ userId, initial_balance: WIRED_AMOUNT });
    if (res.status !== 200) {
      throw new Error(`/taler/reserve/open lieferte ${res.status}, body=${JSON.stringify(res.body)}`);
    }
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending_bank_wire');
    expect(res.body.bank_wire_url).toContain('bank.demo.taler.net');
    expect(res.body.reserve_pub).toMatch(/^[0-9a-z]{52}$/);
    expect(res.body.exchange_base_url).toBe(EXCHANGE_BASE);
    // KEIN 'Simulator', KEIN 'registered_at_exchange' (wire-spec-konform)
    expect(JSON.stringify(res.body)).not.toMatch(/Simulator/i);
    expect(res.body.status).not.toBe('registered_at_exchange');

    reserve_pub = res.body.reserve_pub;
    exchange_base_url = res.body.exchange_base_url;
    bank_wire_url = res.body.bank_wire_url;
  }, 30000);

  it('Phase 2: Operator fuehrt Bank-Wire manuell aus (Konsolen-Anweisung)', async () => {
    // eslint-disable-next-line no-console
    console.log('\n');
    // eslint-disable-next-line no-console
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    // eslint-disable-next-line no-console
    console.log('🪙  MANUELLE BANK-WIRE-AKTION ERFORDERLICH');
    // eslint-disable-next-line no-console
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    // eslint-disable-next-line no-console
    console.log(`Schritt 1: Browser oeffnen           ->  ${bank_wire_url}`);
    // eslint-disable-next-line no-console
    console.log(`Schritt 2: Login / Account erstellen (GNU Taler Demo Bank)`);
    // eslint-disable-next-line no-console
    console.log(`Schritt 3: Wire-Transfer initiieren`);
    // eslint-disable-next-line no-console
    console.log(`Schritt 4: Betrag                    ->  ${WIRED_AMOUNT}`);
    // eslint-disable-next-line no-console
    console.log(`Schritt 5: Subject/Reference (WICHTIG):`);
    // eslint-disable-next-line no-console
    console.log(`            ${reserve_pub}`);
    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log(`Hintergrund: bank.demo.taler.net meldet den Wire an`);
    // eslint-disable-next-line no-console
    console.log(`exchange.demo.taler.net. Dort wird die reserve_pub (Subject)`);
    // eslint-disable-next-line no-console
    console.log(`aus dem Wire-Subject erkannt und die Reserve auf 'partial'/'full' gesetzt.`);
    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log(`Test pollt jetzt exchange.demo.taler.net/reserves/<pub> alle ${POLL_INTERVAL_MS / 1000}s,`);
    // eslint-disable-next-line no-console
    console.log(`max ${POLL_TIMEOUT_MS / 60_000} Minuten. Status wechselt von 'unknown' auf 'partial'/'full'.`);
    // eslint-disable-next-line no-console
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    expect(reserve_pub).toBeDefined();
    expect(reserve_pub.length).toBe(52);
  });

  it('Phase 3: Polling — exchange.demo.taler.net zeigt real finanzierte Reserve', async () => {
    const t0 = Date.now();
    let attempts = 0;
    let lastStatus = 'unknown';
    let lastBalance = 'KUDOS:0';

    while (Date.now() - t0 < POLL_TIMEOUT_MS) {
      attempts++;
      try {
        // talerExchangeClient.getReserveStatus geht DIREKT ans echte Exchange,
        // umgeht den 30s-Server-Cache in refreshReserveSnapshot. Sonst wuerden
        // wir nach 5 Min immer noch stale Cache-Daten sehen.
        const status = await talerExchangeClient.getReserveStatus(reserve_pub);
        lastStatus = status.reserve_status;
        lastBalance = status.current_balance;
        const balanceNum = parseFloat((status.current_balance || '').split(':').pop() || '0');
        const elapsed = Math.round((Date.now() - t0) / 1000);

        if (Number.isFinite(balanceNum) && balanceNum >= TARGET_BALANCE_NUM) {
          // eslint-disable-next-line no-console
          console.log(
            `[bank-wire-live] ✅ Wire angekommen: status=${lastStatus} ` +
            `balance=${lastBalance} nach ${elapsed}s (${attempts} polls)`,
          );
          expect(status.reserve_status).toMatch(/^(partial|full)$/);
          expect(balanceNum).toBeGreaterThanOrEqual(TARGET_BALANCE_NUM);
          return;
        }
        if (attempts % 15 === 0) {
          // eslint-disable-next-line no-console
          console.log(
            `[bank-wire-live] poll #${attempts} (${elapsed}s): status=${lastStatus} ` +
            `balance=${lastBalance} — warte weiter auf Wire ...`,
          );
        }
      } catch (e) {
        const msg = (e as { message?: string }).message || '';
        // Erwartet: 404 solange Exchange die Reserve noch nicht kennt (Wire noch nicht da).
        if (!msg.includes('404')) {
          // eslint-disable-next-line no-console
          console.warn(`[bank-wire-live] poll #${attempts} unexpected: ${msg}`);
        }
      }
      await new Promise<void>(r => setTimeout(r, POLL_INTERVAL_MS));
    }

    throw new Error(
      `TIMEOUT: Wire kam nicht innerhalb ${POLL_TIMEOUT_MS / 60_000} Minuten an. ` +
      `letzter status=${lastStatus} balance=${lastBalance}. ` +
      `Manuell pruefen: ${exchange_base_url}reserves/${reserve_pub} und ` +
      `${bank_wire_url} ob Wire mit korrektem Subject ausgeloest wurde.`,
    );
  }, POLL_TIMEOUT_MS + 30_000);

  it('Phase 4: HEIMAT /api/finance/balance reflektiert reale Reserve-Balance', async () => {
    // Nach Wire-Arrival muss /api/finance/balance die echte Summe zeigen.
    // Quelle: refreshReserveSnapshot inside talerService.getBalance ruft
    // GET exchange.demo.taler.net/reserves/<pub> und schreibt in DB. Wir
    // geben dem Cache max 35s Zeit (RESERVE_CACHE_TTL_MS + Puffer).
    const start = Date.now();
    let observed = 0;
    while (Date.now() - start < 60_000) {
      const res = await request(app).get(`/api/finance/balance/${userId}`);
      if (res.status === 200) {
        observed = res.body.balance;
        if (observed >= TARGET_BALANCE_NUM) {
          expect(res.body.source).toBe('live_exchange');
          expect(res.body.currency).toBe('KUDOS');
          // eslint-disable-next-line no-console
          console.log(
            `[bank-wire-live] ✅ Server-side balance=${observed} ${res.body.currency} ` +
            `(reserves_probed=${res.body.reserves_probed})`,
          );
          return;
        }
      }
      await new Promise<void>(r => setTimeout(r, 3000));
    }

    throw new Error(
      `HEIMAT /api/finance/balance zeigte nach Wire bislang nur ${observed} KUDOS ` +
      `(Erwartet >= ${TARGET_BALANCE_NUM}). Cache-Invalidierung in talerService.bindReserve ` +
      `oder naechstes refreshReserveSnapshot pruefen.`,
    );
  }, 90_000);

  it('Phase 5: POST /api/finance/taler/reserve registriert die gebundene Reserve (Privkey bleibt)', async () => {
    // bindReserve ist idempotent: wenn reserve_pub bereits in DB ist (von
    // createReserveForUser), bleibt der lokale Ed25519 reserve_priv_pkcs8
    // erhalten — bindReserve macht nur UPDATE/return, kein INSERT-override.
    const res = await request(app)
      .post('/api/finance/taler/reserve')
      .send({ userId, reserve_pub });
    expect(res.status).toBe(200);
    expect(res.body.reserve_pub).toBe(reserve_pub);
    expect(res.body.source).toBe('live_exchange');
    expect(res.body.balance).toMatch(/^KUDOS:\d+/);
    // eslint-disable-next-line no-console
    console.log(
      `[bank-wire-live] ✅ Reserve gebunden: ${reserve_pub.slice(0, 12)}… ` +
      `status=${res.body.status} balance=${res.body.balance}`,
    );
  }, 30000);
});
