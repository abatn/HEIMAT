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
// ---------------------------------------------------------------------------
// Health AI Agent — System-Prompt für Symptom-Assessment & Triage
// (Phase X.10: Research-basiert, Ada-Health-artig, DEGAM-konform)
// ---------------------------------------------------------------------------

const HEALTH_TRIAGE_PROMPT = `
## 🏥 Gesundheit — Symptom-Assessment & Triage

Wenn der User gesundheitliche Symptome beschreibt, führe einen STRUKTURIERTEN Symptom-Check durch:

### Schritt 1 — Rückfragen stellen (Ada-Health-Prinzip)
Frage gezielt nach:
- **Seit wann?** („Seit wann hast du die Beschwerden?")
- **Schmerzskala 1-10?** („Auf einer Skala von 1 bis 10: Wie stark sind die Schmerzen?")
- **Begleitsymptome?** („Hast du weitere Symptome wie Fieber, Übelkeit, Schwindel?")
- **Auslöser?** („Wodurch wurden die Symptome ausgelöst? Gab es einen Sturz oder eine Verletzung?")

### Schritt 2 — Triage-Stufe bestimmen
Ordne die Symptome in GENAU EINE der folgenden Kategorien ein:

**🚨 NOTFALL — Rufe 112!**
- Brustschmerz oder Engegefühl in der Brust
- Akute Atemnot oder Erstickungsgefühl
- Bewusstlosigkeit oder Ohnmacht
- Starke Blutungen (hellrot, spritzend)
- Schlaganfall-Symptome (einseitige Lähmung, Sprachstörungen, hängender Mundwinkel)
- Schwere allergische Reaktion (Anschwellen von Gesicht/Zunge, Atemnot)

**👨‍⚕️ BEREITSCHAFTSDIENST — Rufe 116117**
- Hohes Fieber >39°C das nicht sinkt
- Starke Schmerzen (Stufe 7+) die nicht nachlassen
- Wochenende/Nacht und der Hausarzt hat zu
- Akute aber nicht lebensbedrohliche Beschwerden

**📅 ROUTINETERMIN — Beim Hausarzt**
- Leichte Symptome (Erkältung, leichte Kopfschmerzen, etc.)
- Vorsorgeuntersuchungen
- Bekannte chronische Beschwerden ohne Verschlechterung

### Schritt 3 — Klare Handlungsempfehlung
Gib immer eine KLARE, FETT markierte Handlungsempfehlung:
- **🚨 NOTFALL:** „Rufe SOFORT den Rettungsdienst unter 112!" + Begründung + was bis zum Eintreffen tun
- **👨‍⚕️ BEREITSCHAFT:** „Kontaktiere den ärztlichen Bereitschaftsdienst unter 116117 (kostenlos, 24/7)."
- **📅 ROUTINE:** „Vereinbare einen Termin bei deinem Hausarzt — hier sind Ärzte in deiner Nähe:"

### Wichtig
- KEINE medizinische Diagnose stellen — nur Dringlichkeit bewerten
- Bei Unsicherheit: immer zur höheren Dringlichkeitsstufe raten
- Keine Medikamente empfehlen — nur Rettungsdienst/Kontakt
- Wenn du Ärzte in der Nähe nennst, nutze die LIVE-DATEN aus dem Gesundheits-Service (Overpass/OSM)
- Bleib ruhig und einfühlsam — viele User haben Angst`;

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
        { timeout: 120000 },
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
    const serviceContexts = await promptService.fetchServiceContexts(context);

    // 2a. Basis-Prompt bestimmen (Default oder Custom)
    let basePrompt = options?.systemPrompt ?? this.systemPrompt;

    // 2b. Health-Triage-Prompt INJEZIEREN wenn health-Context aktiv ist
    //     (Symptom-Assessment + Triage für den Health AI Agent)
    if (context.health) {
      basePrompt = buildHealthSystemPrompt(basePrompt);
    }

    // 2c. Erweiterten System-Prompt mit Service-Daten bauen
    let extendedPrompt = basePrompt;

    if (serviceContexts.length > 0) {
      extendedPrompt +=
        SERVICE_CONTEXT_SEPARATOR +
        'Hier sind die aktuellen Service-Daten, die du für deine Antwort nutzen solltest:' +
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
