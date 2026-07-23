/**
 * talerExchangeClient.ts
 * ----------------------
 * Echter Client zum GNU-Taler-Exchange.
 *
 * Was hier passiert:
 *   - GET /keys: Master-Public-Key, Denominations, Currency, Base-URL — direkt vom echten
 *     Exchange (Default: https://exchange.demo.taler.net) geladen, gecached für 1 Stunde.
 *   - GET /reserves/<reserve_pub>: Reserve-Status (verfügbar/abgehoben) — direkt vom Exchange.
 *
 * Was hier NICHT passiert:
 *   - KEIN Fallback auf einen lokalen Simulator. Wenn der Exchange nicht erreichbar ist,
 *     wirft jede Methode. Anwendungen müssen 5xx an den Endkunden weitergeben.
 *   - KEINE erfundenen Balance-Werte. Eine Wallet ohne externe Reserve hat schlicht
 *     balance: 0 — und das wird vom Exchange bestätigt.
 *   - KEIN openReserve-Mechanismus: GNU Taler erlaubt kein auto-reserve-Opening via
 *     REST-API. Verifiziert per Live-Trace am exchange.demo.taler.net (POST /reserves/{pub}
 *     → 404 code:1002 "URI schema mismatch"). Eine Reserve wird ausschliesslich durch
 *     einen Bank-Wire angelegt, dessen Subject/Reference die Crockford-Base32 reserve_pub
 *     enthält.
 *
 * Netzwerk:
 *   - HTTPS-Only mit TLS-Validierung, Axios mit custom Agent (family: 4)
 *   - Render Free Tier ist IPv4-only — wir erzwingen es für ausgehendes DNS.
 */

import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import * as crypto from 'crypto';
import { ed25519PubToCrockford, crockfordDecode } from '../utils/crockfordBase32';
import { logger } from '../utils/logger';

const DEFAULT_EXCHANGE_URL = process.env.TALER_EXCHANGE_URL || 'https://exchange.demo.taler.net/';
const KEYS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 Stunde

function ipv4HttpsAgent() {
  return new https.Agent({ family: 4, keepAlive: true, rejectUnauthorized: true });
}

export interface TalerDenominationKey {
  value: { value: string; currency: string };
  stamp_start: { t_s: number };
  stamp_expire: { t_s: number };
  denom_pub: string;
  master_sig: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
}

export interface TalerKeysResponse {
  version: string;
  base_url: string;
  currency: string;
  master_public_key: string;
  denomination_keys: TalerDenominationKey[];
  signkeys?: unknown[];
  reserve_closing_delay?: unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
}

export interface TalerReserveStatus {
  reserve_pub: string;
  reserve_status: 'unknown' | 'partial' | 'full' | 'closed';
  current_balance: string;        // "KUDOS:25" format
  requested_amount?: string;
  history?: unknown[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
}

export interface Ed25519KeyPair {
  pubB32: string;
  privRaw: Buffer;
}

export class TalerExchangeNotReachable extends Error {
  statusCode = 503;
  isOperational = true;
  constructor(public cause: unknown, public upstream: string) {
    super(`Taler exchange not reachable: ${upstream} (${(cause as Error)?.message || 'unknown'})`);
  }
}

export class TalerExchangeRejected extends Error {
  statusCode: number;
  isOperational = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(public body: any, status: number, public upstream: string) {
    super(`Taler exchange rejected request: ${status} ${JSON.stringify(body)?.slice(0, 200)}`);
    this.statusCode = status;
  }
}

// ===========================================================================
// TalerExchangeClient
// ===========================================================================

class TalerKeysCache {
  private cache: { value: TalerKeysResponse; baseUrl: string; fetchedAt: number } | null = null;

  get(): { value: TalerKeysResponse; baseUrl: string } | null {
    if (!this.cache) return null;
    if (Date.now() - this.cache.fetchedAt > KEYS_CACHE_TTL_MS) return null;
    return { value: this.cache.value, baseUrl: this.cache.baseUrl };
  }

  set(value: TalerKeysResponse, baseUrl: string): void {
    this.cache = { value, baseUrl, fetchedAt: Date.now() };
  }

  invalidate(): void { this.cache = null; }
}

export class TalerExchangeClient {
  private ax: AxiosInstance;
  public readonly baseUrl: string;

  constructor(baseUrl: string = DEFAULT_EXCHANGE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, '') + '/';
    this.ax = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: { 'User-Agent': 'heimat-backend/1.0 (gnu-taler-client)' },
      httpsAgent: ipv4HttpsAgent(),
      validateStatus: () => true, // wir inspizieren den Status selbst
    });
  }

  // --------------------------------------------------------------------------
  // Schlüsselerzeugung — Real Ed25519
  // --------------------------------------------------------------------------

  /**
   * Erzeugt ein neues Ed25519 Schlüsselpaar (Taler-konform).
   * Reserve-Pub wird in Crockford-Base32 zurückgegeben (Taler-Format).
   * Wird vom talerService.createReserveForUser() für neue Reserves genutzt;
   * das anschließende "Reale-machen" erfolgt durch den Bank-Wire (siehe oben).
   */
  static generateEd25519KeyPair(): Ed25519KeyPair {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const pubRaw = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
    const privRaw = privateKey.export({ type: 'pkcs8', format: 'der' });
    return { pubB32: ed25519PubToCrockford(pubRaw), privRaw };
  }

  // --------------------------------------------------------------------------
  // GET /keys — Echt, mit 1h-Cache
  // --------------------------------------------------------------------------

  async fetchKeys(forceRefresh = false): Promise<TalerKeysResponse> {
    if (!forceRefresh) {
      const cached = keysCache.get();
      if (cached) return cached.value;
    }

    try {
      const res = await this.ax.get<TalerKeysResponse>('keys');
      if (res.status !== 200 || !res.data) {
        keysCache.invalidate();
        throw new TalerExchangeRejected(res.data, res.status, `${this.baseUrl}keys`);
      }
      // Taler /keys: master_public_key ist Crockford-Base32 (Taler-konform), denomination_keys[]
      // existiert. Schnelle Sanity-Checks.
      if (typeof res.data.master_public_key !== 'string' || res.data.master_public_key.length < 20) {
        throw new TalerExchangeRejected(res.data, 502, `${this.baseUrl}keys`);
      }
      if (!Array.isArray(res.data.denomination_keys) || res.data.denomination_keys.length === 0) {
        throw new TalerExchangeRejected(res.data, 502, `${this.baseUrl}keys`);
      }
      keysCache.set(res.data, this.baseUrl);
      logger.info(`Taler /keys fetched: master_pub=${res.data.master_public_key.slice(0, 12)}… denominations=${res.data.denomination_keys.length}`);
      return res.data;
    } catch (e) {
      if (e instanceof TalerExchangeRejected) throw e;
      keysCache.invalidate();
      throw new TalerExchangeNotReachable(e, `${this.baseUrl}keys`);
    }
  }

  // --------------------------------------------------------------------------
  // GET /reserves/<pub> — Echt
  // --------------------------------------------------------------------------

  async getReserveStatus(reservePubB32: string): Promise<TalerReserveStatus> {
    if (!/^[0-9a-z]{20,}$/.test(reservePubB32)) {
      throw new Error('reserve_pub must be Crockford-Base32 lowercase (>=20 chars)');
    }
    try {
      const res = await this.ax.get<TalerReserveStatus>(`reserves/${reservePubB32}`);
      if (res.status === 404) {
        // Echtes Signal: Reserve existiert am Exchange nicht. Wir propagieren das
        // ehrlich als 4xx (kein synthetisches {"status":"unknown","balance":"0"}).
        throw new TalerExchangeRejected(res.data, 404, `${this.baseUrl}reserves/${reservePubB32}`);
      }
      if (res.status !== 200 || !res.data) {
        throw new TalerExchangeRejected(res.data, res.status, `${this.baseUrl}reserves/${reservePubB32}`);
      }
      return res.data;
    } catch (e) {
      if (e instanceof TalerExchangeRejected) throw e;
      throw new TalerExchangeNotReachable(e, `${this.baseUrl}reserves/${reservePubB32}`);
    }
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  /** Prüft ob Exchange erreichbar und /keys valide liefert (für /taler/status Route). */
  async probe(): Promise<{
    reachable: boolean;
    latency_ms: number;
    master_public_key: string | null;
    denomination_count: number;
    currency: string | null;
    base_url: string;
    error: string | null;
  }> {
    const t0 = Date.now();
    try {
      const keys = await this.fetchKeys();
      return {
        reachable: true,
        latency_ms: Date.now() - t0,
        master_public_key: keys.master_public_key,
        denomination_count: keys.denomination_keys.length,
        currency: keys.currency,
        base_url: this.baseUrl,
        error: null,
      };
    } catch (e) {
      return {
        reachable: false,
        latency_ms: Date.now() - t0,
        master_public_key: null,
        denomination_count: 0,
        currency: null,
        base_url: this.baseUrl,
        error: (e as Error).message || 'unknown',
      };
    }
  }
}

// Singleton-Instanz mit Module-Cache
const keysCache = new TalerKeysCache();
const clientInstance: TalerExchangeClient = new TalerExchangeClient();

export const talerExchangeClient = {
  instance: clientInstance,
  fetchKeys: (force?: boolean) => clientInstance.fetchKeys(force),
  getReserveStatus: (pub: string) => clientInstance.getReserveStatus(pub),
  generateEd25519KeyPair: TalerExchangeClient.generateEd25519KeyPair,
  probe: () => clientInstance.probe(),
  decodeCrockford: crockfordDecode,
};
