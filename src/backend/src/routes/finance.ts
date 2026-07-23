/**
 * routes/finance.ts — Echte GNU Taler-Integration
 *
 * KEIN Simulator-Endpoint. KEIN Synthetic-Balance.
 * Alle Daten, die hier ausgegeben werden, stammen entweder:
 *   1. Von GET https://exchange.demo.taler.net/keys (live, cache 1h) — für /taler/config und /taler/status
 *   2. Von GET https://exchange.demo.taler.net/reserves/<reserve_pub> (live, cache 30s) — für /balance
 *   3. Aus der lokalen Postgres-Tabelle — nur als Cache/Mirror des echten Exchange-State
 *
 * Wenn der Exchange nicht erreichbar ist, antworten wir 5xx — der Endkunde erfährt so,
 * dass keine verlässliche Bilanz verfügbar ist.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate';
import {
  walletParamsSchema,
  talerWalletBodySchema,
  talerPurseBodySchema,
  talerPurseActionBodySchema,
} from '../middleware/schemas';
import { z } from 'zod';
import { talerService } from '../services/talerService';
import { talerExchangeClient } from '../services/talerExchangeClient';

export const financeRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next); };

// Schema für /taler/reserve-bind (User bindet eine extern erstellte Reserve ans Wallet)
const reserveBindBodySchema = z.object({
  userId: z.string().min(1, 'userId required').max(255),
  reserve_pub: z.string().regex(/^[0-9a-z]{20,}$/, 'reserve_pub muss Crockford-Base32 lowercase sein (>= 20 Zeichen)'),
});

const reserveOpenBodySchema = z.object({
  userId: z.string().min(1, 'userId required').max(255),
  initial_balance: z.enum(['KUDOS:10', 'KUDOS:25']).default('KUDOS:25'),
});

// ---------------------------------------------------------------------------
// Wallet-Identität — reale Ed25519 Schlüsselpaar (kein Synthetic)
// ---------------------------------------------------------------------------

financeRouter.post('/taler/wallet', validate(talerWalletBodySchema, 'body'), asyncHandler(async (req: Request, res: Response) => {
  const wallet = await talerService.createWallet(req.body.userId);
  res.json({ status: 'ok', wallet });
}));

// ---------------------------------------------------------------------------
// Bilanz — ECHT vom Exchange, niemals erfunden
// ---------------------------------------------------------------------------

financeRouter.get('/balance/:userId', validate(walletParamsSchema, 'params'), asyncHandler(async (req: Request, res: Response) => {
  const result = await talerService.getBalance(req.params.userId);
  res.json({
    status: 'ok',
    source: 'live_exchange',
    balance: result.balance,
    currency: result.currency,
    reserves_probed: result.reserves_probed,
    note: result.reserves_probed === 0
      ? 'Wallet hat noch keine Reserve-Bindung. Extern via /api/finance/taler/reserve (POST {reserve_pub}) oder /api/finance/taler/reserve/open anlegen.'
      : 'Summe der verfügbaren Reserven am GNU Taler Exchange.',
  });
}));

// ---------------------------------------------------------------------------
// Exchange-Config — ECHTE /keys-Antwort
// ---------------------------------------------------------------------------

financeRouter.get('/taler/config', asyncHandler(async (req: Request, res: Response) => {
  const config = await talerService.getExchangeConfig();
  res.json(config);
}));

// ---------------------------------------------------------------------------
// Exchange-Status — echt (live /keys-Probe)
// ---------------------------------------------------------------------------

financeRouter.get('/taler/status', asyncHandler(async (req: Request, res: Response) => {
  const probe = await talerExchangeClient.probe();
  const httpStatus = probe.reachable ? 200 : 503;
  res.status(httpStatus).json({
    source: 'live_exchange',
    base_url: probe.base_url,
    reachable: probe.reachable,
    latency_ms: probe.latency_ms,
    master_public_key: probe.master_public_key,
    denomination_count: probe.denomination_count,
    currency: probe.currency,
    error: probe.error,
    last_checked_at: new Date().toISOString(),
  });
}));

// ---------------------------------------------------------------------------
// Reserve-Bind: externe Reserve ans Wallet binden
// (User hat Reserve z.B. via https://exchange.demo.taler.net/test.html erstellt)
// ---------------------------------------------------------------------------

financeRouter.post('/taler/reserve', validate(reserveBindBodySchema, 'body'), asyncHandler(async (req: Request, res: Response) => {
  const { userId, reserve_pub } = req.body;
  // Sicherstellen: Wallet existiert
  await talerService.getWallet(userId);
  const result = await talerService.bindReserve(userId, reserve_pub);
  res.json({ status: 'ok', ...result, source: 'live_exchange' });
}));

// ---------------------------------------------------------------------------
// Reserve-Anlegen — Bank-Wire-Only Workflow (GNU Taler Wire-Spec)
// ---------------------------------------------------------------------------
// GNU Taler erlaubt KEIN auto-reserve-Opening via REST-API. Wir generieren
// hier nur das lokale Ed25519-Schlüsselpaar und speichern es mit Status
// 'pending_bank_wire'. Der User muss den Wire-Transfer manuell ueber
// https://bank.demo.taler.net/ ausloesen. Das Response enthaelt die
// reserve_pub + bank_wire_url + note mit der genauen Anleitung.

financeRouter.post('/taler/reserve/open', validate(reserveOpenBodySchema, 'body'), asyncHandler(async (req: Request, res: Response) => {
  const { userId, initial_balance } = req.body;
  const result = await talerService.createReserveForUser(userId, initial_balance);
  res.json({ status: 'ok', ...result, source: 'live_exchange' });
}));

// ---------------------------------------------------------------------------
// Wallet-spezifische Transaktionen (lokal gecachte Spiegel)
// ---------------------------------------------------------------------------

financeRouter.get('/transactions/:userId', validate(walletParamsSchema, 'params'), asyncHandler(async (req: Request, res: Response) => {
  const transactions = await talerService.getTransactions(req.params.userId);
  res.json({ status: 'ok', transactions, count: transactions.length });
}));

// ---------------------------------------------------------------------------
// HEIMAT-interne P2P-Purse-Endpoints — explizit KEIN Taler-Exchange
// (Dokumentiert in /api/finance/taler/info oder README)
// ---------------------------------------------------------------------------

financeRouter.post('/taler/purse/create', validate(talerPurseBodySchema, 'body'), asyncHandler(async (req: Request, res: Response) => {
  const { senderUserId, receiverUserId, amount, contractHash } = req.body;
  const purse = await talerService.createPurse(senderUserId, receiverUserId, amount, contractHash);
  res.json({ status: 'ok', purse, layer: 'heimat_p2p_helper' });
}));

financeRouter.get('/taler/purse/:purseId', asyncHandler(async (req: Request, res: Response) => {
  const purse = await talerService.getPurse(req.params.purseId);
  res.json({ status: 'ok', purse, layer: 'heimat_p2p_helper' });
}));

financeRouter.post('/taler/purse/:purseId/deposit', validate(talerPurseActionBodySchema, 'body'), asyncHandler(async (req: Request, res: Response) => {
  const result = await talerService.depositToPurse(req.params.purseId, req.body.senderUserId);
  res.json({ status: 'ok', ...result, layer: 'heimat_p2p_helper' });
}));

financeRouter.post('/taler/purse/:purseId/merge', validate(talerPurseActionBodySchema, 'body'), asyncHandler(async (req: Request, res: Response) => {
  const result = await talerService.mergePurse(req.params.purseId, req.body.receiverUserId);
  res.json({ status: 'ok', ...result, layer: 'heimat_p2p_helper' });
}));

financeRouter.post('/taler/purse/:purseId/abort', validate(talerPurseActionBodySchema, 'body'), asyncHandler(async (req: Request, res: Response) => {
  const purse = await talerService.abortPurse(req.params.purseId, req.body.userId);
  res.json({ status: 'ok', purse, layer: 'heimat_p2p_helper' });
}));
