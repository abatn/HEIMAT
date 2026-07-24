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
import { requireAuth, AuthRequest } from '../middleware/auth';
import {
  talerPurseBodySchema,
  talerPurseActionBodySchema,
} from '../middleware/schemas';
import { z } from 'zod';
import { talerService } from '../services/talerService';
import { talerExchangeClient } from '../services/talerExchangeClient';
import { AppError } from '../middleware/errorHandler';

export const financeRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next); };

// Schema für /taler/reserve-bind (User bindet eine extern erstellte Reserve ans Wallet)
const reserveBindBodySchema = z.object({
  reserve_pub: z.string().regex(/^[0-9a-z]{20,}$/, 'reserve_pub muss Crockford-Base32 lowercase sein (>= 20 Zeichen)'),
});

const reserveOpenBodySchema = z.object({
  initial_balance: z.enum(['KUDOS:10', 'KUDOS:25']).default('KUDOS:25'),
});

// ---------------------------------------------------------------------------
// Wallet-Identität — reale Ed25519 Schlüsselpaar (kein Synthetic)
// ---------------------------------------------------------------------------

financeRouter.post('/taler/wallet', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const wallet = await talerService.createWallet(req.userId!);
  res.json({ status: 'ok', wallet });
}));

// ---------------------------------------------------------------------------
// Bilanz — ECHT vom Exchange, niemals erfunden
// ---------------------------------------------------------------------------

financeRouter.get('/balance', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await talerService.getBalance(req.userId!);
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

financeRouter.post('/taler/reserve', requireAuth, validate(reserveBindBodySchema, 'body'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { reserve_pub } = req.body;
  // Sicherstellen: Wallet existiert
  await talerService.getWallet(req.userId!);
  const result = await talerService.bindReserve(req.userId!, reserve_pub);
  res.json({ status: 'ok', ...result, source: 'live_exchange' });
}));

// ---------------------------------------------------------------------------
// Reserve-Anlegen — Bank-Wire-Only Workflow (GNU Taler Wire-Spec)
// ---------------------------------------------------------------------------

financeRouter.post('/taler/reserve/open', requireAuth, validate(reserveOpenBodySchema, 'body'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { initial_balance } = req.body;
  const result = await talerService.createReserveForUser(req.userId!, initial_balance);
  res.json({ status: 'ok', ...result, source: 'live_exchange' });
}));

// ---------------------------------------------------------------------------
// Wallet-spezifische Transaktionen (lokal gecachte Spiegel)
// ---------------------------------------------------------------------------

financeRouter.get('/transactions', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const transactions = await talerService.getTransactions(req.userId!);
  res.json({ status: 'ok', transactions, count: transactions.length });
}));

// ---------------------------------------------------------------------------
// HEIMAT-interne P2P-Purse-Endpoints — explizit KEIN Taler-Exchange
// ---------------------------------------------------------------------------

financeRouter.post('/taler/purse/create', requireAuth, validate(talerPurseBodySchema, 'body'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { senderUserId, receiverUserId, amount, contractHash } = req.body;
  // Sicherstellen: Sender ist der authentifizierte User
  if (senderUserId !== req.userId) {
    throw new AppError('Sender muss der authentifizierte User sein', 403);
  }
  const purse = await talerService.createPurse(senderUserId, receiverUserId, amount, contractHash);
  res.json({ status: 'ok', purse, layer: 'heimat_p2p_helper' });
}));

financeRouter.get('/taler/purse/:purseId', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const purse = await talerService.getPurse(req.params.purseId as string);
  res.json({ status: 'ok', purse, layer: 'heimat_p2p_helper' });
}));

financeRouter.post('/taler/purse/:purseId/deposit', requireAuth, validate(talerPurseActionBodySchema, 'body'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await talerService.depositToPurse(req.params.purseId as string, req.userId!);
  res.json({ status: 'ok', ...result, layer: 'heimat_p2p_helper' });
}));

financeRouter.post('/taler/purse/:purseId/merge', requireAuth, validate(talerPurseActionBodySchema, 'body'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await talerService.mergePurse(req.params.purseId as string, req.userId!);
  res.json({ status: 'ok', ...result, layer: 'heimat_p2p_helper' });
}));

financeRouter.post('/taler/purse/:purseId/abort', requireAuth, validate(talerPurseActionBodySchema, 'body'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const purse = await talerService.abortPurse(req.params.purseId as string, req.userId!);
  res.json({ status: 'ok', purse, layer: 'heimat_p2p_helper' });
}));

// ---------------------------------------------------------------------------
// Legacy /pay Endpoint — kompatibel mit altem Frontend
// ---------------------------------------------------------------------------

const payBodySchema = z.object({
  to: z.string().min(1, 'to is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().max(10).optional(),
  description: z.string().max(500).optional(),
});

financeRouter.post('/pay', requireAuth, validate(payBodySchema, 'body'), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { to, amount, currency, description } = req.body;
  const from = req.userId!;
  const purse = await talerService.createPurse(from, to, amount, undefined, description);
  await talerService.depositToPurse(purse.id, from);
  const { purse: merged } = await talerService.mergePurse(purse.id, to);
  res.json({
    status: 'ok',
    transaction: {
      id: purse.id,
      amount,
      currency: currency || 'KUDOS',
      status: merged.status === 'merged' ? 'completed' : 'pending',
      description: description || null,
      created_at: purse.created_at,
    },
  });
}));
