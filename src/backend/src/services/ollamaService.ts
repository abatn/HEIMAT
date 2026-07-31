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
import { promptService, type ServiceContext } from './promptService';
import { ragService } from './ragService';

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

// Modell-Praeferenz-Reihenfolge (kleinere Modelle zuerst = schneller)
// Wird bei Startup via GET /api/tags automatisch erkannt.
const MODEL_PREFERENCES = ['qwen2.5:3b', 'phi3:3.8b', 'llama3.1:8b'];
// ---------------------------------------------------------------------------
// Health AI Agent — System-Prompt für Symptom-Assessment & Triage
// (Phase X.10: Research-basiert, Ada-Health-artig, DEGAM-konform)
// ---------------------------------------------------------------------------

const HEALTH_TRIAGE_PROMPT = `
## Gesundheit — Triage
Rückfragen: seit wann? Schmerzskala 1-10? Begleitsymptome?
NOTFALL (Brustschmerz, Atemnot, Bewusstlosigkeit, Schlaganfall) → 112
BEREITSCHAFT (Fieber >39, Schmerzen 7+) → 116117
ROUTINE (leichte Symptome) → Hausarzt
(3) Klare Handlungsempfehlung fett markiert.
Regeln: Keine Diagnose, keine Medikamente.`;

const DEFAULT_SYSTEM_PROMPT = `Du bist HEIMAT AI, ein hilfreicher Assistent für die HEIMAT Super App.
Du kennst folgende Services:
- Wetter (DWD Open Data: Temperatur, Regen, Sonne, Wind)
- Luftqualität (CAMS: AQI, PM2.5, PM10, Ozon)
- Abfallkalender (Berlin/Hamburg/München Abfuhrtermine)
- E-Ladestationen (OSM: Standorte, Stecker-Typen, Öffnungszeiten)
- Mobilität (ÖPNV Haltestellen, Routen, Abfahrten)
- Gesundheit (Symptom-Assessment + Triage + Ärztesuche via OSM Live-Daten)

Antworte auf Deutsch, freundlich und präzise.
Wenn du eine Frage zu einem Service nicht beantworten kannst,
sage ehrlich "Das kann ich leider nicht beantworten".`;

/** Kombinierter Prompt: Default + Health Triage. Wird genutzt wenn
 *  der health-Service im Context aktiv ist. */
export function buildHealthSystemPrompt(basePrompt: string): string {
  return basePrompt + HEALTH_TRIAGE_PROMPT;
}

const FALLBACK_MESSAGE =
  'KI-Assistent ist nicht verfügbar. Bitte stelle sicher, dass Ollama auf dem Server läuft (http://localhost:11434).';

/** Separator zwischen Service-Kontexten im System-Prompt. */
const SERVICE_CONTEXT_SEPARATOR = '\n\n---\n\n';



export class OllamaService {
  private readonly baseUrl: string;
  private detectedModel: string | null = null;
  private detectPromise: Promise<void> | null = null;
  private readonly systemPrompt: string;

  constructor(
    private readonly http: AxiosInstance = axios,
    options?: { baseUrl?: string; systemPrompt?: string },
  ) {
    this.baseUrl = options?.baseUrl ?? externalServices.ollamaBaseUrl;
    this.systemPrompt = options?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    // Auto-Detect: Modell bei Startup erkenen (cached promise)
    this.detectPromise = this.detectAvailableModel().catch(() => {
      logger.warn('Ollama Model-Auto-Detect fehlgeschlagen, nutze Fallback');
    });
  }

  // -----------------------------------------------------------------------
  // detectAvailableModel — Erkenne verfuegbare Modelle via GET /api/tags.
  // Waehlt das kleinste/schnellste Modell aus MODEL_PREFERENCES.
  // -----------------------------------------------------------------------
  private async detectAvailableModel(): Promise<void> {
    try {
      const response = await this.http.get<{ models?: Array<{ name: string }> }>(
        `${this.baseUrl}/api/tags`,
        { timeout: 5000 },
      );
      const models = response.data?.models ?? [];
      const modelNames = models.map((m: { name: string }) => m.name);

      // Bevorzugtes Modell finden (kleinste zuerst)
      for (const pref of MODEL_PREFERENCES) {
        if (modelNames.some(name => name === pref || name.startsWith(pref))) {
          this.detectedModel = pref;
          logger.info(`Ollama Auto-Detect: Modell ${pref} gefunden (${modelNames.length} Modelle verfuegbar)`);
          return;
        }
      }

      // Kein Praeferenz-Modell gefunden — erstes verfuegbares nehmen
      if (modelNames.length > 0) {
        this.detectedModel = modelNames[0];
        logger.info(`Ollama Auto-Detect: Kein Praeferenz-Modell, nutze ${modelNames[0]}`);
      } else {
        logger.warn('Ollama Auto-Detect: Keine Modelle gefunden');
      }
    } catch (error: unknown) {
      const axiosError = error as { code?: string; message?: string };
      logger.warn(`Ollama Auto-Detect fehlgeschlagen: ${axiosError.code ?? axiosError.message}`);
    }
  }

  // -----------------------------------------------------------------------
  // getActiveModel — Gib das aktive Modell zurueck (detected oder fallback).
  // Wartet beim ersten Aufruf auf Auto-Detect (max 5s).
  // -----------------------------------------------------------------------
  async getActiveModelAsync(): Promise<string> {
    if (this.detectedModel) return this.detectedModel;
    if (this.detectPromise) {
      await Promise.race([this.detectPromise, new Promise(r => setTimeout(r, 5000))]);
    }
    return this.detectedModel || 'qwen2.5:3b';
  }

  // Sync-Version (fuer routes/ai.ts response-Feld) — gibt Fallback wenn Detect noch laeuft.
  getActiveModel(): string {
    return this.detectedModel || 'qwen2.5:3b';
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
    // Beim ersten Aufruf auf Auto-Detect warten (max 5s)
    const model = options?.model ?? await this.getActiveModelAsync();
    const messages: ChatMessage[] = [
      { role: 'system', content: options?.systemPrompt ?? this.systemPrompt },
      { role: 'user', content: userMessage },
    ];

    try {
      const response = await this.http.post<OllamaChatResponse>(
        `${this.baseUrl}/api/chat`,
        {
          model,
          messages,
          stream: false,
        },
        { timeout: 60000 },
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
  // chatWithContext — Ollama-Chat mit eingebetteten Service-Daten.
  //
  // Holt vor dem Chat die aktuellen Daten für die angeforderten Services
  // (Wetter, Luftqualität, Abfall) und injiziert sie in den System-Prompt.
  // So kann Ollama (wenn online) quervernetzte Antworten geben.
  //
  // Wenn Ollama offline ist, werden die Service-Daten direkt als
  // strukturierte Antwort zurückgegeben (kein generischer Fallback).
  //
  // @param userMessage  Die Nachricht des Users
  // @param context      Welche Services mit welchen Parametern abgefragt werden
  // @param options      Modell + SystemPrompt-Optionen
  // @returns            Antwort-String (entweder Ollama oder Service-Daten)
  // -----------------------------------------------------------------------
  async chatWithContext(
    userMessage: string,
    context: ServiceContext,
    options?: { model?: string; systemPrompt?: string },
  ): Promise<string> {
    // 1. Service-Kontexte parallel fetchen
    // Bei Health Triage: NUR Health-Kontext (andere Services irrelevant fuer Triage)
    const isHealthTriage = !!(context.health?.symptom);
    const contextToFetch = isHealthTriage
      ? { health: context.health }
      : context;
    const serviceContexts = await promptService.fetchServiceContexts(contextToFetch);

    // 2a. Basis-Prompt bestimmen (Default oder Custom)
    let basePrompt = options?.systemPrompt ?? this.systemPrompt;

    // 2b. Health-Triage-Prompt + RAG-Kontext INJEZIEREN wenn health-Context aktiv ist
    if (context.health) {
      basePrompt = buildHealthSystemPrompt(basePrompt);

      // RAG: DEGAM-Leitlinien basierend auf User-Symptomen abrufen
      // Prompt-Size Guard: Bei >6k Zeichen RAG ueberspringen (qwen2.5:3b 32k Context)
      if (context.health.symptom && basePrompt.length < 6000) {
        const guidelineChunks = await ragService.searchGuidelines(context.health.symptom);
        if (guidelineChunks.length > 0) {
          const ragContext = ragService.formatGuidelinesForPrompt(guidelineChunks);
          basePrompt += ragContext;
          logger.info(`RAG: ${guidelineChunks.length} DEGAM-Leitlinien fuer Symptom "${context.health.symptom}" gefunden`);
        }
      } else if (context.health.symptom) {
        logger.warn(`RAG uebersprungen: Prompt zu lang (${basePrompt.length} Zeichen > 6000)`);
      }
    }

    // 2c. Erweiterten System-Prompt mit Service-Daten bauen
    let extendedPrompt = basePrompt;

    if (serviceContexts.length > 0) {
      extendedPrompt +=
        SERVICE_CONTEXT_SEPARATOR +
        (isHealthTriage
          ? 'Ärzte in der Nähe:'
          : 'Service-Daten:') +
        SERVICE_CONTEXT_SEPARATOR +
        serviceContexts
          .map(sc => `[${sc.service.toUpperCase()}]: ${sc.text}`)
          .join(SERVICE_CONTEXT_SEPARATOR);
    }

    // 3. An Ollama senden
    const ollamaResponse = await this.chat(userMessage, {
      model: options?.model,
      systemPrompt: extendedPrompt,
    });

    // 4. Wenn Ollama offline war → kombinierte Service-Daten zurückgeben
    if (ollamaResponse === FALLBACK_MESSAGE && serviceContexts.length > 0) {
      const combined = serviceContexts
        .map(sc => `📊 ${sc.service.toUpperCase()}\n${sc.text}`)
        .join('\n\n');
      return (
        `Hier sind die aktuellen Daten aus deinen HEIMAT-Services:\n\n${combined}\n\n` +
        `💡 Für eine persönlichere Erklärung stelle bitte sicher, dass der KI-Assistent läuft.`
      );
    }

    return ollamaResponse;
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
      const activeModel = this.getActiveModel();
      const hasActiveModel = models.some(
        (m: { name: string }) => m.name === activeModel,
      );

      return {
        available: true,
        model: activeModel,
        message: hasActiveModel
          ? `Ollama laeuft. Modell ${activeModel} ist verfuegbar.`
          : `Ollama laeuft, aber Modell ${activeModel} ist nicht geladen. Verfuegbare Modelle: ${models.map((m: { name: string }) => m.name).join(', ') || 'keine'}`,
      };
    } catch (error: unknown) {
      const axiosError = error as { code?: string; message?: string };
      const detail = axiosError.code ?? axiosError.message ?? String(error);
      return {
        available: false,
        model: this.getActiveModel(),
        message: `Ollama ist nicht erreichbar: ${detail}`,
      };
    }
  }
}

// Module-Level Singleton — 1x bei Process-Start instanziiert.
export const ollamaService = new OllamaService();
