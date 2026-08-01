// ---------------------------------------------------------------------------
// whoIcdService.ts — WHO ICD-API v2 Client (OAuth2 Client Credentials)
//
//utzt die WHO ICD-API v2 um Symptom-Texte in ICD-11 Codes zu konvertieren.
// Diese Codes werden danach von triageRulesService.ts in Triage-Level gemappt.
//
// Authentifizierung: OAuth2 Client Credentials
//   - Token-Endpoint: https://icdaccessmanagement.who.int/connect/token
//   - Search-Endpoint: https://id.who.int/icd/release/11/2026-01/mms/search
//
// Privacy: Nur Symptom-Keywords werden an WHO gesendet (keine PII).
// Kosten: Kostenlos (WHO ICD-API ist frei zugänglich mit Registrierung).
// ---------------------------------------------------------------------------

import axios from 'axios';
import { externalServices } from '../config/externalServices';
import { logger } from '../utils/logger';

// ICD API v2 Endpoints
const TOKEN_URL = 'https://icdaccessmanagement.who.int/connect/token';
// WHO_ICD_RELEASE kann via env-var ueberschrieben werden (Default: 2026-01)
const SEARCH_RELEASE = process.env.WHO_ICD_RELEASE ?? '2026-01';
const SEARCH_BASE = `https://id.who.int/icd/release/11/${SEARCH_RELEASE}/mms/search`;
const API_VERSION = 'v2';

export interface IcdSearchResult {
  /** ICD-11 Code (z.B. "8A80" für Kopfschmerzen) */
  code: string;
  /** Titel des ICD-11 Eintrags */
  title: string;
  /** URI des ICD-11 Eintrags */
  id: string;
  /** Relevanz-Score (hoeher = relevanter) */
  score: number;
}

export interface IcdSearchResponse {
  /** Gefundene ICD-11 Codes */
  entities: IcdSearchResult[];
  /** Ob die Suche erfolgreich war */
  success: boolean;
  /** Fehlermeldung bei Misserfolg */
  error?: string;
}

/**
 * WHO ICD-API v2 Service — Klasse mit Constructor-DI fuer Tests.
 *
 * Strategie:
 *   1. OAuth2 Token abrufen (gecacht, Token laeuft ~1 Stunde)
 *   2. Symptom-Text an WHO ICD-API senden
 *   3. Top-Ergebnisse als IcdSearchResult[] zurueckgeben
 *
 * Bei Verbindungsfehlern oder fehlenden Credentials wird ein leeres
 * Ergebnis zurueckgegeben (kein Crash, kein Throw).
 */
export class WhoIcdService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor() {
    this.clientId = externalServices.whoIcdClientId;
    this.clientSecret = externalServices.whoIcdClientSecret;
  }

  /** Gibt zurueck ob die ICD-API konfiguriert ist (Credentials vorhanden). */
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  // -------------------------------------------------------------------------
  // getToken — OAuth2 Client Credentials Flow
  //
  // Holt ein Access-Token vom WHO Identity Server.
  // Token wird gecacht (Laufzeit ~1 Stunde).
  // -------------------------------------------------------------------------
  private async getToken(): Promise<string | null> {
    // Token noch gueltig? → Cache nutzen
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.isConfigured()) {
      logger.debug('WHO ICD-API: Keine Credentials konfiguriert');
      return null;
    }

    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('scope', 'icdapi_access');

      // HTTP Basic Auth mit Client-ID und Client-Secret
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post<{
        access_token: string;
        expires_in: number;
        token_type: string;
      }>(TOKEN_URL, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${auth}`,
        },
        timeout: 10000,
      });

      const { access_token, expires_in } = response.data;
      this.accessToken = access_token;
      // 5 Minuten vor Ablauf erneuern (Sicherheitsmarge)
      this.tokenExpiry = Date.now() + (expires_in - 300) * 1000;

      logger.info('WHO ICD-API: Token erfolgreich abgerufen');
      return this.accessToken;
    } catch (error: unknown) {
      const axiosError = error as { code?: string; message?: string; response?: { status?: number } };
      logger.warn(`WHO ICD-API Token-Fehler: ${axiosError.code ?? axiosError.message ?? String(error)}`);
      this.accessToken = null;
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // searchBySymptom — ICD-11 Suche nach Symptom-Text
  //
  // Sendet den Symptom-Text an die WHO ICD-API und gibt die besten
  // ICD-11 Codes zurueck. Unterstuetzt deutsche und englische Symptome.
  //
  // @param symptoms  Freitext-Symptom (z.B. "Kopfschmerzen seit 2 Tagen")
  // @param limit     Maximale Anzahl Ergebnisse (Default: 3)
  // @returns         IcdSearchResponse mit gefundenen Codes
  // -------------------------------------------------------------------------
  async searchBySymptom(symptoms: string, limit: number = 3): Promise<IcdSearchResponse> {
    if (!symptoms || symptoms.trim().length === 0) {
      return { entities: [], success: true };
    }

    // Symptom-Text bereinigen: nur relevante Woerter behalten
    const cleanSymptom = symptoms
      .toLowerCase()
      .replace(/[^a-zäöüß0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
      .join(' ')
      .trim();

    if (cleanSymptom.length === 0) {
      return { entities: [], success: true };
    }

    const token = await this.getToken();
    if (!token) {
      return {
        entities: [],
        success: false,
        error: 'WHO ICD-API nicht konfiguriert oder Token-Fehler',
      };
    }

    try {
      const searchUrl = `${SEARCH_BASE}?q=${encodeURIComponent(cleanSymptom)}`;
      const response = await axios.get<{
        destinationEntities?: Array<{
          theCode?: string;
          title?: string;
          id?: string;
          score?: number;
        }>;
      }>(searchUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'API-Version': API_VERSION,
          'Accept': 'application/json, application/ld+json',
          'Accept-Language': 'de,en',
        },
        timeout: 10000,
      });

      const rawEntities = response.data?.destinationEntities ?? [];
      const entities: IcdSearchResult[] = rawEntities
        .filter(e => e.theCode && e.title)
        .slice(0, limit)
        .map(e => ({
          code: e.theCode!,
          title: e.title!,
          id: e.id ?? '',
          score: e.score ?? 0,
        }));

      logger.info(`WHO ICD-API: ${entities.length} Ergebnisse fuer "${cleanSymptom}"`);
      return { entities, success: true };
    } catch (error: unknown) {
      const axiosError = error as { code?: string; message?: string; response?: { status?: number } };
      const status = axiosError.response?.status;
      logger.warn(`WHO ICD-API Suche fehlgeschlagen (status ${status ?? 'timeout'}): ${axiosError.message ?? String(error)}`);
      return {
        entities: [],
        success: false,
        error: `ICD-API Fehler: ${status ?? axiosError.code ?? 'timeout'}`,
      };
    }
  }
}

// Module-Level Singleton
export const whoIcdService = new WhoIcdService();
