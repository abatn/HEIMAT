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
import { whoIcdService } from './whoIcdService';
import { triageRulesService, type TriageResult } from './triageRulesService';
import { healthMemoryService } from './healthMemoryService';
import { userMedicationsService } from './userMedicationsService';

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

const HEALTH_TRIAGE_PROMPT = `Du bist HEIMAT Triage-Assistent. Antworte kurz (max 150 Wörter).
Stufen: NOTFALL (Brustschmerz, Atemnot, Bewusstlosigkeit, Schlaganfall)→112 | BEREITSCHAFT (Fieber>39, Schmerzen 7+)→116117 | ROUTINE (leichte Symptome)→Hausarzt.
Rückfragen: seit wann? Schmerzskala 1-10? Begleitsymptome?
Handlungsempfehlung fett. Keine Diagnose, keine Medikamente. Deutsch.`;

const DEFAULT_SYSTEM_PROMPT = `Du bist HEIMAT AI — ein intelligenter Cross-Service-Assistent für den deutschen Alltag.
Du verbindest ECHTE Live-Daten aus mehreren Services zu ACTIONABLE Empfehlungen.

## Deine Services (alle mit ECHTEN Live-Daten):
- 🌦️ Wetter (DWD): Temperatur, Regen, Sonne, Wind, Unwetter
- 🌬️ Luftqualität (CAMS/UBA): AQI, PM2.5, PM10, Ozon, Gesundheitsempfehlung
- 🗑️ Abfallkalender: Nächste Abfuhrtermine nach Standort
- 🚗 Parken (OSM): Kostenlose/gedeckte Plätze in der Nähe
- 🔌 E-Ladestationen (OSM): Schnelllader, Standorte, Stecker-Typen
- 🚇 Mobilität (ÖPNV): Haltestellen, Abfahrten, Routen
- 👨‍⚕️ Gesundheit: Ärzte (OSM), Triage (WHO ICD-11), Medikamente
- 💼 Jobs (Arbeitnow): Stellenangebote, Remote-Optionen

## Cross-Service-Intelligenz (DEIN Kern-Vorteil):
Du KOMBINIERST Services zu Handlungsempfehlungen:
- "Morgen Arzt?" → Wetter (Regenjacke?) + ÖPNV (Nächste Verbindung) + Parken (wenn Auto)
- "Heute joggen?" → Luftqualität (AQI OK?) + Wetter (Temperatur/Regen?)
- "Abfall rausstellen?" → Wann (Datum?) + Wetter (Regen? Tonne unterstellen!)
- "E-Auto laden?" → Nächste Station + Aktueller Preis + Wetter (draußen laden?)
- "Neuen Job suchen?" → Remote möglich? + ÖPNV erreichbar?

## Regeln:
- ANTWORTE IMMER AUF DEUTSCH
- Gib KONKRETE Handlungsempfehlungen, nicht nur Rohdaten
- Nutze Emojis für Struktur (🌦️ 🚗 🏥 💼)
- Max 200 Wörter — kurz und präzise
- Bei Notfällen: IMMER 112/116117 erwähnen
- Keine medizinische Diagnose, nur Empfehlungen
- Wenn Daten fehlen: Sage ehrlich was nicht verfügbar ist`;

/** Kombinierter Prompt: Default + Health Triage. Wird genutzt wenn
 *  der health-Service im Context aktiv ist. */
export function buildHealthSystemPrompt(basePrompt: string): string {
  return basePrompt + HEALTH_TRIAGE_PROMPT;
}

const FALLBACK_MESSAGE =
  'KI-Assistent ist nicht verfügbar. Bitte stelle sicher, dass Ollama auf dem Server läuft (http://localhost:11434).';

/** Separator zwischen Service-Kontexten im System-Prompt. */
const SERVICE_CONTEXT_SEPARATOR = '\n\n---\n\n';

// -----------------------------------------------------------------------
// Cross-Service Recommendation Engine
// Generiert intelligente Handlungsempfehlungen aus kombinierten Service-Daten.
// Wird als Fallback genutzt wenn Ollama offline ist.
// -----------------------------------------------------------------------

type ServiceData = { service: string; text: string; data?: Record<string, unknown> };

/** Erkenne Cross-Service-Muster in den Daten und generiere Empfehlungen. */
function generateCrossServiceRecommendations(
  userMessage: string,
  services: ServiceData[],
): string[] {
  const recommendations: string[] = [];
  const msg = userMessage.toLowerCase();

  // Service-Daten als Map für schnellen Zugriff
  const dataMap = new Map<string, ServiceData>();
  for (const s of services) {
    dataMap.set(s.service, s);
  }

  // --- Cross-Service 1: Arzt-Termin + Wetter + ÖPNV ---
  if (msg.includes('arzt') || msg.includes('termin') || msg.includes('doctor')) {
    const weather = dataMap.get('weather');
    if (weather) {
      const tempMatch = weather.text.match(/(\d+)°C/);
      const temp = tempMatch ? parseInt(tempMatch[1]) : null;
      const isRaining = weather.text.toLowerCase().includes('regen') || weather.text.toLowerCase().includes('niederschlag');

      if (isRaining) {
        recommendations.push('🌧️ **Regen am Arzttermin** — Nimm einen Regenschirm mit! Bei ÖPNV: Regenjacke reicht. Bei Auto: Scheibenwischer prüfen.');
      }
      if (temp !== null && temp < 5) {
        recommendations.push('🥶 **Kalt am Arzttermin** — Zieh dich warm an. Schal und Handschuhe nicht vergessen!');
      }
    }
    const mobility = dataMap.get('mobility');
    if (mobility && mobility.text.includes('Abfahrt')) {
      recommendations.push(`🚇 **ÖPNV zum Arzt** — ${mobility.text.substring(0, 100)}...`);
    }
  }

  // --- Cross-Service 2: Joggen/Sport + Luftqualität + Wetter ---
  if (msg.includes('joggen') || msg.includes('sport') || msg.includes('laufen') || msg.includes('rad')) {
    const air = dataMap.get('air');
    const weather = dataMap.get('weather');

    if (air) {
      const aqiMatch = air.text.match(/AQI[\s:]+(\d+)/i);
      const aqi = aqiMatch ? parseInt(aqiMatch[1]) : null;
      if (aqi !== null && aqi > 50) {
        recommendations.push(`⚠️ **Luftqualität mäßig (AQI ${aqi})** — Leichter Sport okay, aber kein Intensiv-Training draußen.`);
      } else if (aqi !== null && aqi < 20) {
        recommendations.push('✅ **Perfekte Luft für Sport** — AQI ist sehr gut. Raus an die frische Luft!');
      }
    }
    if (weather) {
      const tempMatch = weather.text.match(/(\d+)°C/);
      const temp = tempMatch ? parseInt(tempMatch[1]) : null;
      if (temp !== null && temp > 30) {
        recommendations.push('💧 **Heißer Tag** — Viel Wasser mitnehmen! Lieber morgens oder abends trainieren.');
      }
    }
  }

  // --- Cross-Service 3: Abfall rausstellen + Wetter ---
  if (msg.includes('abfall') || msg.includes('müll') || msg.includes('tonne') || msg.includes('abfuhr')) {
    const weather = dataMap.get('weather');
    const waste = dataMap.get('waste');

    if (waste && waste.text.includes('Abfuhr')) {
      if (weather) {
        const isRaining = weather.text.toLowerCase().includes('regen') || weather.text.toLowerCase().includes('niederschlag');
        if (isRaining) {
          recommendations.push('🌧️ **Regen bei Abfuhr** — Stell die Tonne am Abend raus (nicht am Morgen), damit sie nicht voll läuft!');
        } else {
          recommendations.push('☀️ **Trockene Abfuhr** — Perfekt! Tonne rausstellen und morgens abholen.');
        }
      }
    }
  }

  // --- Cross-Service 4: E-Auto laden + Wetter ---
  if (msg.includes('laden') || msg.includes('e-auto') || msg.includes('ladesäule') || msg.includes('ev')) {
    const weather = dataMap.get('weather');
    const ev = dataMap.get('ev');

    if (ev && ev.text.includes('Station')) {
      if (weather) {
        const isRaining = weather.text.toLowerCase().includes('regen');
        if (isRaining) {
          recommendations.push('🌧️ **Regen beim Laden** — Suche eine überdachte Ladesäule!');
        } else {
          recommendations.push('☀️ **Trockenes Wetter** — Draußen laden kein Problem.');
        }
      }
    }
  }

  // --- Cross-Service 5: Job-Suche + ÖPNV ---
  if (msg.includes('job') || msg.includes('stelle') || msg.includes('arbeit') || msg.includes('bewerbung')) {
    const job = dataMap.get('job');
    if (job && job.text.includes('Remote')) {
      recommendations.push('💻 **Remote-Job gefunden** — Kein Pendeln nötig! Perfekt für Work-Life-Balance.');
    }
  }

  // --- Cross-Service 6: Allgemeine Tagesplanung ---
  if (msg.includes('plan') || msg.includes('tag') || msg.includes('heute') || msg.includes('morgen')) {
    const weather = dataMap.get('weather');
    if (weather) {
      const tempMatch = weather.text.match(/(\d+)°C/);
      const temp = tempMatch ? parseInt(tempMatch[1]) : null;
      const isRaining = weather.text.toLowerCase().includes('regen');

      if (isRaining) {
        recommendations.push('🌧️ **Regen geplant** — Innenaktivitäten oder Regenjacke einplanen!');
      } else if (temp !== null && temp > 20) {
        recommendations.push('☀️ **Schönes Wetter** — Perfekt für Aktivitäten draußen!');
      }
    }
  }

  return recommendations;
}



export interface HealthContextWithMemory {
  symptom?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  specialty?: string;
  userId?: string;
}

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
  // getMemoryContext — Lade Symptom-Verlauf für Ollama-Kontext.
  // -----------------------------------------------------------------------
  private async getMemoryContext(userId: string): Promise<string> {
    try {
      const context = await healthMemoryService.getRecentForContext(userId, 5);
      return context;
    } catch (e) {
      logger.warn(`Memory-Kontext konnte nicht geladen werden: ${e}`);
      return '';
    }
  }

  // -----------------------------------------------------------------------
  // getMedicationContext — Lade aktuelle Medikamente für Ollama-Kontext.
  // -----------------------------------------------------------------------
  private async getMedicationContext(userId: string): Promise<string> {
    try {
      const context = await userMedicationsService.getMedicationsForContext(userId);
      
      // Auch Interaktionen laden
      const interactions = await userMedicationsService.checkUserInteractions(userId);
      
      let result = context;
      if (interactions.hasSevereInteraction) {
        result += '\n\n⚠️ WARNUNG: Schwerwiegende Interaktionen gefunden!';
        for (const inter of interactions.interactions.filter(i => i.severity === 'schwerwiegend')) {
          result += `\n- ${inter.drug_a} + ${inter.drug_b}: ${inter.description}`;
        }
      }
      
      return result;
    } catch (e) {
      logger.warn(`Medikamenten-Kontext konnte nicht geladen werden: ${e}`);
      return '';
    }
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
          options: {
            num_predict: 100,   // Max 100 Tokens (~75 Wörter) — kürzer = schneller
            temperature: 0.3,   // Deterministisch — Triage braucht Präzision
          },
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
    const isHealthTriage = !!(context.health?.symptom);
    const userId = context.health?.userId;

    // ---- FAST PATH: Health Triage ----
    // Strategie: WHO ICD-API -> deterministische Rules -> Ollama Fallback
    // Kein Overpass (15-20s), kein RAG (1-2s), kein langer Prompt.
    if (isHealthTriage) {
      const symptom = context.health?.symptom ?? userMessage;
      logger.info(`Health Triage: WHO ICD-API + Rules-Engine (kein Ollama noetig)`);

      // 1. WHO ICD-API: Symptom -> ICD-11 Codes (1-3s)
      let icdCodes: string[] = [];
      if (whoIcdService.isConfigured()) {
        try {
          const icdResult = await whoIcdService.searchBySymptom(symptom, 3);
          if (icdResult.success) {
            icdCodes = icdResult.entities.map(e => e.code);
            logger.info(`Health Triage: ICD-11 Codes: ${icdCodes.join(', ')}`);
          }
        } catch (e) {
          logger.warn(`WHO ICD-API Fehler (Fallback auf Keywords): ${e}`);
        }
      }

      // 2. Deterministische Rules-Engine (kein LLM, <1ms)
      const triageResult = triageRulesService.evaluateTriage(symptom, icdCodes);

      // 3. Formatierung fuer User-Antwort
      const triageText = triageRulesService.formatTriageForPrompt(triageResult);

      // 4. Gedächtnis- und Medikamenten-Kontext laden (wenn userId vorhanden)
      let memoryContext = '';
      let medicationContext = '';
      if (userId) {
        [memoryContext, medicationContext] = await Promise.all([
          this.getMemoryContext(userId),
          this.getMedicationContext(userId),
        ]);
      }

      // 5. Erweiterten Triage-Prompt bauen
      let enhancedTriagePrompt = HEALTH_TRIAGE_PROMPT + triageText;
      if (memoryContext) {
        enhancedTriagePrompt += `\n\nVorherige Symptome des Users:\n${memoryContext}`;
      }
      if (medicationContext) {
        enhancedTriagePrompt += `\n\nAktuelle Medikamente:\n${medicationContext}`;
      }

      // 6. Ollama als optionaler Enhancer (nicht noetig fuer Triage)
      // Bei hohem Konfidenz-Level (0.7+) brauchen wir kein LLM
      if (triageResult.confidence >= 0.7) {
        return this.buildTriageResponse(userMessage, triageResult);
      }

      // Bei niedriger Konfidenz: Ollama als Fallback
      logger.info(`Health Triage: Niedrige Konfidenz (${triageResult.confidence}), nutze Ollama als Fallback`);
      const ollamaResponse = await this.chat(userMessage, {
        model: options?.model,
        systemPrompt: enhancedTriagePrompt,
      });

      // Wenn Ollama auch nichts Brauchbares liefert, Rules-Result verwenden
      if (ollamaResponse === FALLBACK_MESSAGE) {
        return this.buildTriageResponse(userMessage, triageResult);
      }

      return ollamaResponse;
    }

    // ---- STANDARD PATH: Non-Triage (alle Services parallel fetchen) ----
    const serviceContexts = await promptService.fetchServiceContexts(context);

    // Basis-Prompt bestimmen
    let basePrompt = options?.systemPrompt ?? this.systemPrompt;

    // Health-Kontext ohne Symptom (z.B. Ärztesuche) — erweiterten Prompt bauen
    if (context.health && !isHealthTriage) {
      basePrompt = buildHealthSystemPrompt(basePrompt);
      
      // Gedächtnis- und Medikamenten-Kontext hinzufügen
      if (userId) {
        const [memoryCtx, medCtx] = await Promise.all([
          this.getMemoryContext(userId),
          this.getMedicationContext(userId),
        ]);
        
        if (memoryCtx) {
          basePrompt += `\n\nVorherige Symptome des Users:\n${memoryCtx}`;
        }
        if (medCtx) {
          basePrompt += `\n\nAktuelle Medikamente:\n${medCtx}`;
        }
      }
    }

    // Service-Daten anhängen
    if (serviceContexts.length > 0) {
      basePrompt +=
        SERVICE_CONTEXT_SEPARATOR +
        'Service-Daten:' +
        SERVICE_CONTEXT_SEPARATOR +
        serviceContexts
          .map(sc => `[${sc.service.toUpperCase()}]: ${sc.text}`)
          .join(SERVICE_CONTEXT_SEPARATOR);
    }

    const ollamaResponse = await this.chat(userMessage, {
      model: options?.model,
      systemPrompt: basePrompt,
    });

    // Fallback: Service-Daten + Cross-Service-Empfehlungen wenn Ollama offline
    if (ollamaResponse === FALLBACK_MESSAGE && serviceContexts.length > 0) {
      // 1. Cross-Service-Empfehlungen generieren (intelligente Kombination)
      const recommendations = generateCrossServiceRecommendations(userMessage, serviceContexts);

      // 2. Rohdaten-Block
      const rawData = serviceContexts
        .map(sc => `📊 **${sc.service.toUpperCase()}**\n${sc.text}`)
        .join('\n\n');

      // 3. Zusammenbauen: Empfehlungen zuerst, dann Rohdaten
      let response = '';
      if (recommendations.length > 0) {
        response += '🎯 **HEIMAT Empfehlung:**\n' +
          recommendations.join('\n\n') + '\n\n---\n\n';
      }
      response += rawData;
      response += '\n\n---\n\n💡 _Für eine persönlichere Erklärung stelle bitte sicher, dass der KI-Assistent läuft._';

      return response;
    }

    return ollamaResponse;
  }

  // -----------------------------------------------------------------------
  // buildTriageResponse — Formatierte Triage-Antwort aus Rules-Engine.
  // -----------------------------------------------------------------------
  private buildTriageResponse(userMessage: string, result: TriageResult): string {
    const emoji = result.level === 'NOTFALL' ? '🚨'
      : result.level === 'BEREITSCHAFT' ? '⚠️'
      : 'ℹ️';

    const lines = [
      `${emoji} **HEIMAT Triage-Ergebnis**`,
      '',
      `**Stufe: ${result.level}**`,
      `**📞 ${result.phoneNumber}**`,
      '',
      result.recommendation,
      '',
      '---',
      '',
      '⚠️ *Dies ist keine medizinische Diagnose. Bei Unsicherheit wähle 112 oder den ärztlichen Bereitschaftsdienst 116117.*',
    ];

    if (result.icdCodes.length > 0) {
      lines.splice(-2, 0, `🏥 ICD-11: ${result.icdCodes.join(', ')}`);
    }

    return lines.join('\n');
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
