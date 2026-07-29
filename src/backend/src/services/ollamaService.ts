// ---------------------------------------------------------------------------
// OllamaService — Axios-Client gegen lokale Ollama-Instanz.
//
// Ollama API (https://github.com/ollama/ollama/blob/main/docs/api.md):
//   - POST /api/chat  → { model, messages, stream }
//   - GET  /api/tags  → { models: [...] }
//
// Diese Service ist die Brücke zwischen HEIMAT-Backend und dem auf dem
// gleichen Server laufenden Ollama-Prozess (localhost:11434).
//
// Bei Verbindungsfehlern (Ollama offline / nicht installiert) liefert
// der Service einen klaren deutschen Fallback-Text.
//
// PRINZIP: Keine Cloud-AI, kein OpenAI, keine externen APIs.
// Nur lokales Ollama mit llama3.1:8b (General Purpose, 131k Kontext).
// ---------------------------------------------------------------------------

import axios, { AxiosInstance } from 'axios';
import { externalServices } from '../config/externalServices';
import { logger } from '../utils/logger';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatResponse {
  model: string;
  message: ChatMessage;
  done: boolean;
}

export interface OllamaStatus {
  available: boolean;
  model: string;
  message: string;
}

const DEFAULT_MODEL = 'llama3.1:8b';
const DEFAULT_SYSTEM_PROMPT = `Du bist HEIMAT AI, ein hilfreicher Assistent für die HEIMAT Super App.
Du kennst folgende Services:
- Wetter (DWD Open Data: Temperatur, Regen, Sonne, Wind)
- Luftqualität (CAMS: AQI, PM2.5, PM10, Ozon)
- Abfallkalender (Berlin/Hamburg/München Abfuhrtermine)
- E-Ladestationen (OSM: Standorte, Stecker-Typen, Öffnungszeiten)
- Mobilität (ÖPNV Haltestellen, Routen, Abfahrten)
- Gesundheit (Ärztesuche, Terminbuchung)

Antworte auf Deutsch, freundlich und präzise.
Wenn du eine Frage zu einem Service nicht beantworten kannst,
sage ehrlich "Das kann ich leider nicht beantworten".`;

const FALLBACK_MESSAGE =
  'KI-Assistent ist nicht verfügbar. Bitte stelle sicher, dass Ollama auf dem Server läuft (http://localhost:11434).';

export class OllamaService {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly systemPrompt: string;

  constructor(
    private readonly http: AxiosInstance = axios,
    options?: { baseUrl?: string; model?: string; systemPrompt?: string },
  ) {
    this.baseUrl = options?.baseUrl ?? externalServices.ollamaBaseUrl;
    this.model = options?.model ?? DEFAULT_MODEL;
    this.systemPrompt = options?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  }

  // -----------------------------------------------------------------------
  // chat — Sende Nachricht an Ollama, gib Antwort als String zurück.
  //
  // Bei Verbindungsfehlern (ECONNREFUSED, ECONNABORTED, ENOTFOUND, etc.)
  // wird FALLBACK_MESSAGE returned — kein Throw, kein Crash.
  //
  // Der System-Prompt wird automatisch vorangestellt, damit Ollama den
  // HEIMAT-Kontext kennt.
  // -----------------------------------------------------------------------
  async chat(
    userMessage: string,
    options?: { model?: string; systemPrompt?: string },
  ): Promise<string> {
    const messages: ChatMessage[] = [
      { role: 'system', content: options?.systemPrompt ?? this.systemPrompt },
      { role: 'user', content: userMessage },
    ];

    try {
      const response = await this.http.post<OllamaChatResponse>(
        `${this.baseUrl}/api/chat`,
        {
          model: options?.model ?? this.model,
          messages,
          stream: false,
        },
        { timeout: 30000 },
      );

      if (response.data?.message?.content) {
        return response.data.message.content.trim();
      }

      logger.warn('Ollama response had no message content');
      return FALLBACK_MESSAGE;
    } catch (error: unknown) {
      const axiosError = error as { code?: string; message?: string };
      const code = axiosError.code;
      const msg = axiosError.message ?? String(error);

      if (
        code === 'ECONNREFUSED' ||
        code === 'ECONNABORTED' ||
        code === 'ENOTFOUND' ||
        code === 'ETIMEDOUT' ||
        code === 'EAI_AGAIN' ||
        msg.includes('connect')
      ) {
        logger.warn(
          `Ollama nicht erreichbar (${code ?? msg}). Sende Fallback-Text.`,
        );
        return FALLBACK_MESSAGE;
      }

      // Andere Fehler (z.B. 4xx/5xx von Ollama selbst) auch loggen,
      // aber mild behandeln.
      logger.error(
        `Ollama chat failed: ${msg}`,
      );
      return FALLBACK_MESSAGE;
    }
  }

  // -----------------------------------------------------------------------
  // getFallbackMessage — Öffentlicher Zugriff auf den Fallback-Text.
  // Wird in routes/ai.ts genutzt um status='fallback' zu signalisieren.
  // -----------------------------------------------------------------------
  getFallbackMessage(): string {
    return FALLBACK_MESSAGE;
  }

  // -----------------------------------------------------------------------
  // status — Prüfe ob Ollama läuft und das Default-Modell verfügbar ist.
  //
  // Nutzt GET /api/tags um die verfügbaren Modelle abzufragen.
  // Kein Throw bei Verbindungsfehlern — nur `available: false`.
  // -----------------------------------------------------------------------
  async status(): Promise<OllamaStatus> {
    try {
      const response = await this.http.get<{ models?: Array<{ name: string }> }>(
        `${this.baseUrl}/api/tags`,
        { timeout: 5000 },
      );

      const models = response.data?.models ?? [];
      const hasDefaultModel = models.some(
        (m: { name: string }) => m.name === this.model,
      );

      return {
        available: true,
        model: this.model,
        message: hasDefaultModel
          ? `Ollama läuft. Modell ${this.model} ist verfügbar.`
          : `Ollama läuft, aber Modell ${this.model} ist nicht geladen. Verfügbare Modelle: ${models.map((m: { name: string }) => m.name).join(', ') || 'keine'}`,
      };
    } catch (error: unknown) {
      const axiosError = error as { code?: string; message?: string };
      const detail = axiosError.code ?? axiosError.message ?? String(error);
      return {
        available: false,
        model: this.model,
        message: `Ollama ist nicht erreichbar: ${detail}`,
      };
    }
  }
}

// Module-Level Singleton — 1x bei Process-Start instanziiert.
export const ollamaService = new OllamaService();
