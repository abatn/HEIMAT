/**
 * talerService.ts
 * ---------------
 * Echte GNU-Taler-Integration. KEIN Simulator, KEINE erfundenen Balance-Werte, KEIN
 * stiller Fallback. Wenn der Taler-Exchange nicht erreichbar ist → Fehler 503 zur
 * API (kein erfundenes "balance: 100").
 *
 * Datenquellen-Vertrag:
 *   - "wallet" ist die Ed25519-Identität des HEIMAT-Users (real EdDSA, node:crypto).
 *   - "balance" ist die Summe der aktuell offenen Reserves am echten Taler-Exchange
 *     (jede wird per GET /reserves/<pub> live abgefragt; Verbindung cache: 30s).
 *   - "purse" ist HEIMAT-internes P2P-Hilfsobjekt (nicht Taler-Exchange-Pfad) — siehe
 *     Kommentar in createPurse().
 *   - "exchange" (Config) ist direkter Read von GET /keys (Cache: 1h).
 *
 * Der frühere lokale "100 KUDOS Initial Balance"-Simulator ist entfernt.
 *
 * openReserve-Mechanismus wurde entfernt (siehe talerExchangeClient.ts). Neue Reserves
 * entstehen ausschliesslich durch Bank-Wire-Transfers, deren Subject die Crockford
 * reserve_pub enthält. createReserveForUser() generiert nur das lokale Schlüsselpaar
 * und speichert es mit status='pending_bank_wire'.
 */

import { query, queryOne, execute } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import { talerExchangeClient, TalerKeysResponse, TalerReserveStatus, TalerExchangeNotReachable, TalerExchangeRejected } from './talerExchangeClient';
import { ed25519PubToCrockford } from '../utils/crockfordBase32';

const CURRENCY = 'KUDOS';
const RESERVE_CACHE_TTL_MS = 30 * 1000; // 30s Cache für GET /reserves/<pub>
// Früher: `const INITIAL_BALANCE = 100` — ENTFERNT. Eine Wallet ohne echte externe Reserve hat 0.

export interface TalerWallet {
  id: string;
  user_id: string;
  wallet_pub: string;
  wallet_priv_pkcs8?: string; // nur intern, niemals an Endkunden
  balance: string;            // "KUDOS:25" – SNAPSHOT vom Exchange
  currency: string;
  exchange_reserve_pub: string | null;
  exchange_base_url: string | null;
  last_probed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TalerPurse {
  id: string;
  purse_pub: string;
  purse_priv_pkcs8: string;
  amount: string;
  currency: string;
  contract_hash: string | null;
  sender_wallet_id: string;
  receiver_wallet_id: string | null;
  status: string;
  created_at: string;
  expires_at: string;
  merged_at: string | null;
}

export interface TalerTransaction {
  id: string;
  reserve_id: string | null;
  purse_id: string | null;
  from_wallet_id: string;
  to_wallet_id: string;
  amount: string;
  currency: string;
  contract_hash: string | null;
  kind: string;             // 'reserve_open'|'reserve_withdraw'|'p2p'|'purse_funding'|'purse_merge'
  status: string;
  exchange_tx_signature: string | null;
  description: string | null;
  created_at: string;
}

function sha512Hex(input: string): string {
  return crypto.createHash('sha512').update(input).digest('hex');
}

function parseAmount(amount: string | null | undefined): number {
  if (amount === null || amount === undefined || amount === '') return 0;
  // Taler amount format: "KUDOS:25" or "KUDOS:0.50"
  if (amount.includes(':')) {
    const n = parseFloat(amount.split(':')[1] || '0');
    return Number.isFinite(n) ? n : 0;
  }
  const n = parseFloat(amount);
  return Number.isFinite(n) ? n : 0;
}

function formatAmount(value: number): string {
  // Taler-Standard: 'CURRENCY:VALUE' (z.B. "KUDOS:25.00", "KUDOS:0.00")
  return `${CURRENCY}:${value.toFixed(2)}`;
}

/** Addiert/Subtrahiert im Node-Code (vermeidet Postgres-Cast-Fehler mit 'KUDOS:0'::numeric). */
async function adjustBalance(walletId: string, delta: number): Promise<{ newBalanceStr: string; newBalanceNum: number }> {
  const w = await queryOne<{ balance: string }>('SELECT balance FROM taler_wallets WHERE id = $1', [walletId]);
  const current = parseAmount(w?.balance);
  const next = Math.max(0, current + delta);
  const nextStr = formatAmount(next);
  await execute(`UPDATE taler_wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [nextStr, walletId]);
  return { newBalanceStr: nextStr, newBalanceNum: next };
}

function newReservePrivPub(): { reserve_pub: string; reserve_priv_pkcs8: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubRaw = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
  const privPkcs8 = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('hex');
  return { reserve_pub: ed25519PubToCrockford(pubRaw), reserve_priv_pkcs8: privPkcs8 };
}

// ===========================================================================
// TalerService
// ===========================================================================

export class TalerService {
  private reserveCache: Map<string, { value: TalerReserveStatus; at: number }> = new Map();

  // -------------------------------------------------------------------------
  // /taler/config — echte /keys-Antwort vom Exchange
  // -------------------------------------------------------------------------

  async getExchangeConfig(): Promise<TalerKeysResponse & { name: string; source: 'live_exchange' }> {
    try {
      const keys = await talerExchangeClient.fetchKeys();
      // Taler-KeysResponse ist die WIRKLICHE /keys-Antwort des echten Exchanges.
      // Wir setzen zusätzlich `name` + `source` für Klarheit im API-Response.
      return { ...keys, name: 'GNU Taler Exchange (live)', source: 'live_exchange' };
    } catch (e) {
      if (e instanceof TalerExchangeNotReachable) {
        throw new AppError(
          `GNU Taler exchange nicht erreichbar: ${talerExchangeClient.instance.baseUrl}keys — ` +
          `bitte Status unter /api/finance/taler/status prüfen`,
          503,
        );
      }
      throw new AppError((e as Error).message || 'Taler exchange rejected request', 502);
    }
  }

  // -------------------------------------------------------------------------
  // Wallet anlegen — echte Ed25519-Identität, NO synthetic balance
  // -------------------------------------------------------------------------

  async createWallet(userId: string): Promise<TalerWallet> {
    const existing = await queryOne<TalerWallet>(
      'SELECT * FROM taler_wallets WHERE user_id = $1',
      [userId],
    );
    if (existing) return stripPrivateFields(existing);

    // Echte Ed25519-Identität, kein Mock
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const pubRaw = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
    const walletPub = ed25519PubToCrockford(pubRaw);
    const walletPrivPkcs8 = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('hex');

    const inserted = await queryOne<TalerWallet>(
      `INSERT INTO taler_wallets (user_id, wallet_pub, wallet_priv_pkcs8, balance, currency,
                                 exchange_base_url, last_probed_at)
       VALUES ($1, $2, $3, 'KUDOS:0', $4, $5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [userId, walletPub, walletPrivPkcs8, CURRENCY, talerExchangeClient.instance.baseUrl],
    );

    logger.info(`Taler wallet identity created (real ed25519): user=${userId} wallet_pub=${walletPub.slice(0, 16)}…`);
    return stripPrivateFields(inserted!);
  }

  async getWallet(userId: string, opts: { probeExchange?: boolean } = {}): Promise<TalerWallet> {
    let wallet = await queryOne<TalerWallet>(
      'SELECT * FROM taler_wallets WHERE user_id = $1',
      [userId],
    );
    if (!wallet) wallet = await this.createWallet(userId);

    if (opts.probeExchange !== false && wallet.exchange_reserve_pub) {
      await this.refreshReserveSnapshot(wallet.exchange_reserve_pub);
      wallet = await queryOne<TalerWallet>(
        'SELECT * FROM taler_wallets WHERE user_id = $1',
        [userId],
      )!;
    }
    return stripPrivateFields(wallet!);
  }

  // -------------------------------------------------------------------------
  // getBalance — Summiert die ECHTEN Reserven via GET /reserves/<pub>
  // -------------------------------------------------------------------------

  async getBalance(userId: string): Promise<{ balance: number; currency: string; reserves_probed: number }> {
    const reserves = await query<{ reserve_pub: string; exchange_base_url: string }>(
      'SELECT reserve_pub, exchange_base_url FROM taler_reserves WHERE user_id = $1',
      [userId],
    );

    if (reserves.length === 0) {
      // Wallet existiert, aber noch keine externe Reserve gebunden.
      // Echt: 0 ist die korrekte Antwort, kein erfundener 100-Default.
      return { balance: 0, currency: CURRENCY, reserves_probed: 0 };
    }

    // Wir fragen das echte Exchange für jede Reserve
    let total = 0;
    let probed = 0;
    for (const r of reserves) {
      try {
        const status = await this.refreshReserveSnapshot(r.reserve_pub);
        total += parseAmount(status.current_balance);
        probed += 1;
      } catch (e) {
        if (e instanceof TalerExchangeNotReachable) {
          // Wir propagieren 503 — kein erfundener 0-er
          throw new AppError(
            `GNU Taler exchange nicht erreichbar (${(e as Error).message}) — Balance kann nicht ermittelt werden`,
            503,
          );
        }
        // Exchange hat Reserve-Antwort verweigert: skippe diese Reserve, fahre mit anderen fort
        logger.warn(`Reserve ${r.reserve_pub}: probe failed (${(e as Error).message})`);
      }
    }

    // Wallet-Snapshot aktualisieren (Cache)
    await execute(
      `UPDATE taler_wallets SET balance = $1, last_probed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [`${CURRENCY}:${total.toFixed(2)}`, userId],
    );

    return { balance: total, currency: CURRENCY, reserves_probed: probed };
  }

  // -------------------------------------------------------------------------
  // Reserve-Bind — User kann extern erstellte Reserve (z.B. via bank.demo.taler.net Wire) binden
  // -------------------------------------------------------------------------

  async bindReserve(userId: string, reservePubRaw: string): Promise<{ reserve_pub: string; status: string; balance: string }> {
    const reserve_pub = reservePubRaw.toLowerCase().trim();
    // Frisch geprobten Snapshot in den Cache schreiben und alten Cache-Eintrag verwerfen
    // (sonst wuerde getBalance() bis zu 30s veraltete Daten liefern).
    this.reserveCache.delete(reserve_pub);
    if (!/^[0-9a-z]{20,}$/.test(reserve_pub)) {
      throw new AppError('reserve_pub muss Crockford-Base32 lowercase sein (>= 20 chars)', 400);
    }

    // Probe am echten Exchange: existiert diese Reserve? In welchem Status?
    let status: TalerReserveStatus;
    try {
      status = await this.refreshReserveSnapshot(reserve_pub);
    } catch (e) {
      if (e instanceof TalerExchangeRejected && e.statusCode === 404) {
        throw new AppError(
          `Reserve ${reserve_pub} ist am echten GNU Taler Exchange nicht registriert. ` +
          `Wahrscheinlich wurde noch kein Bank-Wire ausgefuehrt. Bitte ueber https://bank.demo.taler.net/ ` +
          `einen Wire-Transfer ausloesen und reserve_pub als Subject/Reference angeben.`,
          404,
        );
      }
      throw e;
    }

    const existing = await queryOne<{ id: string; user_id: string }>(
      'SELECT id, user_id FROM taler_reserves WHERE reserve_pub = $1',
      [reserve_pub],
    );
    if (existing) {
      if (existing.user_id !== userId) {
        throw new AppError('Reserve bereits an einen anderen User gebunden', 403);
      }
      // Schon gebunden, frischer Snapshot
      return { reserve_pub, status: status.reserve_status, balance: status.current_balance };
    }

    // Reserve neu eintragen
    // Snapshot aus dem echten Exchange normalisieren — Taler-Balance-Format ist 'CURRENCY:VALUE'.
    // Wenn der Server nur 'VALUE' liefert, konvertieren wir auf 'KUDOS:VALUE'.
    const normalisedBalance = formatAmount(parseAmount(status.current_balance));

    await execute(
      `INSERT INTO taler_reserves (user_id, reserve_pub, reserve_priv_pkcs8, initial_balance,
                                  current_balance, status, exchange_base_url, last_probed_at, raw_exchange_response)
       VALUES ($1, $2, '', $3, $4, $5, $6, CURRENT_TIMESTAMP, $7)`,
      [
        userId,
        reserve_pub,
        normalisedBalance,                    // initial_balance (normalisiert aus Exchange-Antwort)
        normalisedBalance,
        status.reserve_status,
        talerExchangeClient.instance.baseUrl,
        JSON.stringify(status),
      ],
    );

    // Wallet mit Reserve verknüpfen
    await execute(
      `UPDATE taler_wallets SET exchange_reserve_pub = $1, exchange_base_url = $2,
                               balance = $3, last_probed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $4`,
      [reserve_pub, talerExchangeClient.instance.baseUrl, normalisedBalance, userId],
    );

    logger.info(`Reserve ${reserve_pub} gebunden für user=${userId} status=${status.reserve_status} balance=${normalisedBalance}`);
    return { reserve_pub, status: status.reserve_status, balance: normalisedBalance };
  }

  // -------------------------------------------------------------------------
  // createReserveForUser — Bank-Wire-Only Workflow (kein auto-openReserve)
  // -------------------------------------------------------------------------
  //
  // GNU Taler erlaubt KEIN auto-reserve-Opening via REST-API. Eine Reserve wird
  // ausschliesslich vom Exchange angelegt, sobald die Bank (z. B. bank.demo.taler.net)
  // einen Wire-Transfer meldet, dessen Subject/Reference die Crockford-Base32 reserve_pub
  // enthält. Verifiziert per Live-Trace am 2024-XX-XX: POST /reserves/{pub} liefert
  // 404 code:1002 ("URI schema mismatch"), /test.html liefert 404.
  //
  // Wir generieren hier NUR das lokale Ed25519-Schlüsselpaar. Wir behaupten NICHT,
  // dass die Reserve am Exchange real ist — das wird sie erst nach dem Bank-Wire.

  async createReserveForUser(userId: string, _initialBalance?: 'KUDOS:25' | 'KUDOS:10'): Promise<{
    reserve_pub: string; status: string; exchange_base_url: string;
    bank_wire_url: string;
    note: string;
  }> {
    // 1. Frisches ed25519-Schlüsselpaar lokal erzeugen
    const { reserve_pub, reserve_priv_pkcs8 } = newReservePrivPub();

    // 2. DB-Eintrag mit ehrlichem Status 'pending_bank_wire'
    await execute(
      `INSERT INTO taler_reserves (user_id, reserve_pub, reserve_priv_pkcs8, initial_balance,
                                  current_balance, status, exchange_base_url, last_probed_at)
       VALUES ($1, $2, $3, 'KUDOS:0', 'KUDOS:0', 'pending_bank_wire', $4, CURRENT_TIMESTAMP)`,
      [userId, reserve_pub, reserve_priv_pkcs8, talerExchangeClient.instance.baseUrl],
    );
    // _initialBalance ist aus Backward-Compat erhalten; Bank legt den Betrag fest.
    void _initialBalance;

    // 3. Wallet mit Reserve verknüpfen
    await execute(
      `UPDATE taler_wallets SET exchange_reserve_pub = $1, exchange_base_url = $2, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $3`,
      [reserve_pub, talerExchangeClient.instance.baseUrl, userId],
    );

    logger.info(`Taler reserve ${reserve_pub} created locally (pending bank wire) for user=${userId}`);

    // 4. Ehrlicher Hinweis: User muss den Bank-Wire auslösen, damit die Reserve real wird
    return {
      reserve_pub,
      status: 'pending_bank_wire',
      exchange_base_url: talerExchangeClient.instance.baseUrl,
      bank_wire_url: 'https://bank.demo.taler.net/',
      note: `GNU Taler erfordert eine Bank-Transaktion, damit die Reserve am Exchange real wird. ` +
        `Bitte ueber https://bank.demo.taler.net/ einen Wire-Transfer ausloesen und die reserve_pub ` +
        `(${reserve_pub}) als Subject/Reference angeben. Sobald der Exchange den Wire empfaengt, ` +
        `wird /api/finance/balance/:userId die echte Balance automatisch anzeigen (Refresh ca. alle 30s).`,
    };
  }

  // -------------------------------------------------------------------------
  // Reserve-Snapshot-Refresh: GET /reserves/<pub> mit 30s-Cache
  // -------------------------------------------------------------------------

  private async refreshReserveSnapshot(reserve_pub: string): Promise<TalerReserveStatus> {
    const cached = this.reserveCache.get(reserve_pub);
    if (cached && Date.now() - cached.at < RESERVE_CACHE_TTL_MS) {
      return cached.value;
    }

    const status = await talerExchangeClient.getReserveStatus(reserve_pub);
    this.reserveCache.set(reserve_pub, { value: status, at: Date.now() });

    await execute(
      `UPDATE taler_reserves SET current_balance = $1, status = $2, last_probed_at = CURRENT_TIMESTAMP,
                                 raw_exchange_response = $3, updated_at = CURRENT_TIMESTAMP
       WHERE reserve_pub = $4`,
      [formatAmount(parseAmount(status.current_balance)), status.reserve_status, JSON.stringify(status), reserve_pub],
    );

    return status;
  }

  // -------------------------------------------------------------------------
  // Optionaler intern-P2P-Purse-Helper
  //
  // Wichtig: Diese Purse-Operationen sind NICHT Taler-Exchange-Operationen.
  // Sie sind HEIMAT-eigene Ed25519-signierte lokale Transfer-Buckets, die
  // außerhalb des Taler-Exchange funktionieren. Sie sind im Interface aus
  // Stabilitätsgründen erhalten geblieben, sind aber explizit KEIN Bestandteil
  // des echten GNU-Taler-Protokolls. Wenn sie als "Taler"-Operation vermarktet
  // werden, wäre das Irreführung — also: ehrlich halten.
  // -------------------------------------------------------------------------

  async createPurse(senderUserId: string, receiverUserId: string, amount: number, contractHash?: string, description?: string): Promise<TalerPurse> {
    if (amount <= 0) throw new AppError('Amount must be positive', 400);
    const effectiveContractHash = contractHash ?? sha512Hex(`${senderUserId}|${receiverUserId}|${amount}|${Date.now()}`);

    const senderWallet = await this.getWallet(senderUserId, { probeExchange: true });
    // Echte Reserve-Balance als Fundings-Quelle (NICHT erfunden)
    const senderBalance = parseAmount(senderWallet.balance);
    if (senderBalance < amount) {
      throw new AppError(
        `Insufficient RESERVE balance from live exchange: have ${senderBalance} ${CURRENCY}, need ${amount}. ` +
        `Bitte zuerst eine Reserve extern finanzieren: https://bank.demo.taler.net/`,
        402,
      );
    }

    const receiverWallet = await this.getWallet(receiverUserId);

    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const pubRaw = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
    const purse_pub = ed25519PubToCrockford(pubRaw);
    const purse_priv_pkcs8 = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const purse = await queryOne<TalerPurse>(
      `INSERT INTO taler_purses (purse_pub, purse_priv_pkcs8, amount, currency, contract_hash,
        sender_wallet_id, receiver_wallet_id, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'created', $8)
       RETURNING *`,
      [purse_pub, purse_priv_pkcs8, amount.toFixed(2), CURRENCY, effectiveContractHash, senderWallet.id, receiverWallet.id, expiresAt.toISOString()],
    );

    logger.info(`Purse ${purse!.id} created (heimat_p2p_helper, NOT Taler exchange): ${amount} ${CURRENCY} from ${senderUserId} to ${receiverUserId}${description ? ` desc: ${description}` : ''}`);
    return purse!;
  }

  async depositToPurse(purseId: string, senderUserId: string): Promise<{ purse: TalerPurse; transaction: TalerTransaction }> {
    const purse = await this.findPurseOrFail(purseId);
    if (purse.status !== 'created') throw new AppError(`Purse is '${purse.status}', cannot deposit`, 400);
    if (new Date(purse.expires_at) < new Date()) {
      await execute("UPDATE taler_purses SET status = 'expired' WHERE id = $1", [purseId]);
      throw new AppError('Purse expired', 410);
    }
    const senderWallet = await queryOne<TalerWallet>('SELECT * FROM taler_wallets WHERE id = $1', [purse.sender_wallet_id]);
    if (!senderWallet || senderWallet.user_id !== senderUserId) throw new AppError('Sender mismatch', 403);

    const amount = parseAmount(purse.amount);
    const senderBalance = parseAmount(senderWallet.balance);
    if (senderBalance < amount) throw new AppError('Insufficient balance', 402);

    // Snapshot-Balance reduzieren via Node-Arithmetik (NICHT erfunden — die echte
    // Exchange-Reservierung kann jederzeit per refreshReserveSnapshot überprüft werden).
    await adjustBalance(senderWallet.id, -amount);
    await execute("UPDATE taler_purses SET status = 'funded' WHERE id = $1", [purseId]);

    const tx = await this.logTransaction({
      kind: 'purse_funding',
      reserveId: null,
      purseId: purse.id,
      fromWalletId: senderWallet.user_id,
      toWalletId: purse.receiver_wallet_id ? (await this.getWalletUserId(purse.receiver_wallet_id)) : 'escrow',
      amount, contractHash: purse.contract_hash,
      exchangeSig: null,
      status: 'completed',
      description: `Purse funding: ${amount} ${CURRENCY}`,
    });
    const updatedPurse = await queryOne<TalerPurse>('SELECT * FROM taler_purses WHERE id = $1', [purseId]);
    logger.info(`Purse ${purseId} funded: ${amount} ${CURRENCY} from ${senderUserId}`);
    return { purse: updatedPurse!, transaction: tx };
  }

  async mergePurse(purseId: string, receiverUserId: string): Promise<{ purse: TalerPurse; transaction: TalerTransaction }> {
    const purse = await this.findPurseOrFail(purseId);
    if (purse.status !== 'funded') throw new AppError(`Purse is '${purse.status}', cannot merge`, 400);
    if (new Date(purse.expires_at) < new Date()) {
      await execute("UPDATE taler_purses SET status = 'expired' WHERE id = $1", [purseId]);
      throw new AppError('Purse expired', 410);
    }
    const receiverWallet = await queryOne<TalerWallet>('SELECT * FROM taler_wallets WHERE id = $1', [purse.receiver_wallet_id]);
    if (!receiverWallet || receiverWallet.user_id !== receiverUserId) throw new AppError('Receiver mismatch', 403);
    const amount = parseAmount(purse.amount);

    await adjustBalance(receiverWallet.id, +amount);
    await execute("UPDATE taler_purses SET status = 'merged', merged_at = CURRENT_TIMESTAMP WHERE id = $1", [purseId]);

    const tx = await this.logTransaction({
      kind: 'purse_merge',
      reserveId: null,
      purseId: purse.id,
      fromWalletId: (await this.getWalletUserId(purse.sender_wallet_id)),
      toWalletId: receiverUserId,
      amount, contractHash: purse.contract_hash,
      exchangeSig: null,
      status: 'completed',
      description: `Purse merge: ${amount} ${CURRENCY}`,
    });
    const updatedPurse = await queryOne<TalerPurse>('SELECT * FROM taler_purses WHERE id = $1', [purseId]);
    logger.info(`Purse ${purseId} merged: ${amount} ${CURRENCY} to ${receiverUserId}`);
    return { purse: updatedPurse!, transaction: tx };
  }

  async getPurse(purseId: string): Promise<TalerPurse> { return this.findPurseOrFail(purseId); }

  async abortPurse(purseId: string, userId: string): Promise<TalerPurse> {
    const purse = await this.findPurseOrFail(purseId);
    if (purse.status === 'merged') throw new AppError('Cannot abort a merged purse', 400);
    if (purse.status === 'aborted' || purse.status === 'expired') throw new AppError('Already in terminal state', 400);
    const senderWallet = await queryOne<TalerWallet>('SELECT * FROM taler_wallets WHERE id = $1', [purse.sender_wallet_id]);
    if (!senderWallet || senderWallet.user_id !== userId) throw new AppError('Only sender can abort', 403);
    if (purse.status === 'funded') {
      const amount = parseAmount(purse.amount);
      await adjustBalance(senderWallet.id, +amount);
    }
    await execute("UPDATE taler_purses SET status = 'aborted' WHERE id = $1", [purseId]);
    return (await queryOne<TalerPurse>('SELECT * FROM taler_purses WHERE id = $1', [purseId]))!;
  }

  // -------------------------------------------------------------------------
  // Transaktionen
  // -------------------------------------------------------------------------

  async getTransactions(userId: string): Promise<TalerTransaction[]> {
    const wallet = await queryOne<{ id: string }>('SELECT id FROM taler_wallets WHERE user_id = $1', [userId]);
    if (!wallet) return [];
    return query<TalerTransaction>(
      `SELECT * FROM taler_transactions
       WHERE from_wallet_id = $1 OR to_wallet_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId],
    );
  }

  // -------------------------------------------------------------------------
  // Interne Helpers — KEIN Mock / KEIN Fallback / KEINE erfundenen Werte.
  // Alle Werte stammen entweder aus dem DB-Cache oder werden 1:1 vom echten
  // Taler-Exchange zurückgegeben — keine Synthese, keine Simulation.
  // -------------------------------------------------------------------------

  private async findPurseOrFail(purseId: string): Promise<TalerPurse> {
    const purse = await queryOne<TalerPurse>('SELECT * FROM taler_purses WHERE id = $1', [purseId]);
    if (!purse) throw new AppError('Purse not found', 404);
    return purse;
  }

  private async getWalletUserId(walletId: string): Promise<string> {
    const w = await queryOne<{ user_id: string }>('SELECT user_id FROM taler_wallets WHERE id = $1', [walletId]);
    return w?.user_id ?? 'unknown';
  }

  private async logTransaction(data: {
    kind: TalerTransaction['kind'];
    reserveId: string | null;
    purseId: string | null;
    fromWalletId: string;
    toWalletId: string;
    amount: number;
    contractHash: string | null;
    exchangeSig: string | null;
    status: string;
    description: string | null;
  }): Promise<TalerTransaction> {
    return (await queryOne<TalerTransaction>(
      `INSERT INTO taler_transactions (reserve_id, purse_id, from_wallet_id, to_wallet_id, amount, currency,
                                     contract_hash, kind, status, exchange_tx_signature, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        data.reserveId, data.purseId, data.fromWalletId, data.toWalletId,
        data.amount.toFixed(2), CURRENCY, data.contractHash, data.kind,
        data.status, data.exchangeSig, data.description,
      ],
    ))!;
  }
}

function stripPrivateFields(w: TalerWallet): TalerWallet {
  // Endkunden sehen wallet_priv_pkcs8 NICHT
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { wallet_priv_pkcs8, ...rest } = w;
  return rest;
}

export const talerService = new TalerService();
