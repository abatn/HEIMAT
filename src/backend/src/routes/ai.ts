import { Router, Request, Response, NextFunction } from 'express';
import { getDashboardContext, getPersonalizedContext } from '../services/aiHomeService';
import { ollamaService } from '../services/ollamaService';
import { promptService, type ServiceName } from '../services/promptService';
import { logger } from '../utils/logger';

export const aiRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next); };

const VALID_SERVICES = new Set<string>(['weather', 'air', 'waste', 'health', 'job', 'events', 'hotels', 'buergeramt']);

// --- Auto-Detect Health Triage ---
// Erkennt Symptome in User-Nachrichten OHNE services-Objekt.
// Trigger: Medizinische Keywords -> chatWithContext() mit health.symptom
// Verwendet Word-Boundary Regex um False-Positives zu vermeiden
// (z.B. 'blut' matcht NICHT 'Blumen', 'druck' matcht NICHT 'Druckerei')
const HEALTH_SYMPTOM_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  // Schmerzen (spezifisch)
  { regex: /\bschmerz(?:en|haft|ige[nr]?)?\b/i, label: 'Schmerz' },
  { regex: /\bkopfschmerz(?:en)?\b/i, label: 'Kopfschmerz' },
  { regex: /\bkopfweh\b/i, label: 'Kopfweh' },
  { regex: /\bmigraene\b/i, label: 'Migraene' },
  { regex: /\bbrustschmerz(?:en)?\b/i, label: 'Brustschmerz' },
  { regex: /\bbauchschmerz(?:en)?\b/i, label: 'Bauchschmerz' },
  { regex: /\brueckenschmerz(?:en)?\b/i, label: 'Rueckenschmerz' },
  { regex: /\bwirbelsaeule\b/i, label: 'Wirbelsaeule' },
  { regex: /\bgelenk(?:schmerz(?:en)?)?\b/i, label: 'Gelenk' },
  // Fieber
  { regex: /\bfieber\b/i, label: 'Fieber' },
  { regex: /\b(3[89]|4[0-9]|5[0-9])\s*grad\b/i, label: 'Temperatur' },
  { regex: /\bschüttelfrost\b/i, label: 'Schuettelfrost' },
  // Atemwege
  { regex: /\batemnot\b/i, label: 'Atemnot' },
  { regex: /\batmung\b/i, label: 'Atmung' },
  { regex: /\berstick(?:en|ung)?\b/i, label: 'Erstickung' },
  { regex: /\bkeine\s+luft\b/i, label: 'Keine Luft' },
  { regex: /\bhusten\b/i, label: 'Husten' },
  { regex: /\bhalsschmerz(?:en)?\b/i, label: 'Halsschmerz' },
  { regex: /\bschluckbeschwerd(?:en)?\b/i, label: 'Schluckbeschwerden' },
  // Herz/Kreislauf
  { regex: /\bbrustenge\b/i, label: 'Brustenge' },
  { regex: /\bherzen\b/i, label: 'Herzen' },
  { regex: /\bherzrhythmus\b/i, label: 'Herzrhythmus' },
  // Magen-Darm
  { regex: /\bdurchfall\b/i, label: 'Durchfall' },
  { regex: /\berbrechen\b/i, label: 'Erbrechen' },
  { regex: /\buebelkeit\b/i, label: 'Uebelkeit' },
  // Neuro
  { regex: /\bbewusstlos\b/i, label: 'Bewusstlos' },
  { regex: /\bohnmacht\b/i, label: 'Ohnmacht' },
  { regex: /\bschwindel\b/i, label: 'Schwindel' },
  { regex: /\bkrampf(?:e)?\b/i, label: 'Krampf' },
  { regex: /\bzittern\b/i, label: 'Zittern' },
  // Haut
  { regex: /\bausschlag\b/i, label: 'Ausschlag' },
  { regex: /\bjucken\b/i, label: 'Jucken' },
  { regex: /\bpusteln\b/i, label: 'Pusteln' },
  { regex: /\brotaugen\b/i, label: 'Rotaugen' },
  // Blut (nur als Wort, NICHT in 'Blumen' etc.)
  { regex: /\bblut(?:ig|ung|druck)?\b/i, label: 'Blut' },
  { regex: /\bwunde\b/i, label: 'Wunde' },
  // Infektion
  { regex: /\binfekt(?:ion)?\b/i, label: 'Infektion' },
  { regex: /\berkältung\b/i, label: 'Erkaeltung' },
  { regex: /\bgrippe\b/i, label: 'Grippe' },
  // Verletzung + Schmerzarten
  { regex: /\bbrennen\b/i, label: 'Brennen' },
  { regex: /\bstechen\b/i, label: 'Stechen' },
  { regex: /\bgefallen\b/i, label: 'Gefallen' },
  { regex: /\bverletzung\b/i, label: 'Verletzung' },
  { regex: /\bunfall\b/i, label: 'Unfall' },
];

/**
 * Erkennt ob eine Nachricht ein Gesundheitssymptom enthaelt.
 * Nutzt Word-Boundary Regex um False-Positives zu vermeiden.
 *
 * False-Positive-Beispiele die vermieden werden:
 *   - 'blut' matcht NICHT 'Blumen'
 *   - 'druck' matcht NICHT 'Druckerei'
 *   - 'brennen' matcht NICHT 'Brennnessel'
 *   - 'stechen' matcht NICHT 'Stechpalme'
 */
function detectHealthSymptom(message: string): string | null {
  for (const { regex, label } of HEALTH_SYMPTOM_PATTERNS) {
    if (regex.test(message)) {
      logger.debug(`Health Triage Auto-Detect: "${label}" matcht in "${message.substring(0, 50)}"`);
      return message.trim();
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// AI Home Dashboard — kontextualisierte Daten für die Startseite
// ---------------------------------------------------------------------------

aiRouter.get('/home', asyncHandler(async (req: Request, res: Response) => {
  const context = getDashboardContext();
  res.json({
    status: 'ok',
    context,
  });
}));

// ---------------------------------------------------------------------------
// AI Home Dashboard — personalisierte Daten via BayesClassifier
// POST /api/ai/home/personalized
// Body: { recentActions: string[] }
// ---------------------------------------------------------------------------

aiRouter.post('/home/personalized', asyncHandler(async (req: Request, res: Response) => {
  const { recentActions } = req.body;
  const actions: string[] = Array.isArray(recentActions) ? recentActions : [];
  const context = getPersonalizedContext(actions);
  res.json({
    status: 'ok',
    context,
    personalized: actions.length > 0,
  });
}));

// ---------------------------------------------------------------------------
// AI Chat — POST /api/ai/chat
//
// Sendet eine User-Nachricht an Ollama (auto-detect Modell) und gibt die
// KI-generierte Antwort zurueck.
//
// Body: { message, model?, systemPrompt?, services? }
//   services: { weather?: {lat,lng}, air?: {lat,lng}, waste?: {lat,lng,street?,houseNr?} }
//
// Response: { status, response, model, contexts?: [...] }
//
// Cross-Service (Phase AI-4):
//   - services-Objekt injected aktuelle Service-Daten in den System-Prompt
//   - Ollama kann dann quervernetzte Antworten geben (z.B. Wetter + Abfall)
//   - Wenn Ollama offline: direkte Daten-Rückgabe statt generischer Fallback
//
// Fallback: Wenn Ollama offline ist, kommen die Service-Daten als Text.
// ---------------------------------------------------------------------------

export interface ChatRequestBody {
  message: string;
  model?: string;
  systemPrompt?: string;
  services?: import('../services/promptService').ServiceContext;
}

aiRouter.post('/chat', asyncHandler(async (req: Request, res: Response) => {
  const { message, model, systemPrompt, services } = req.body as ChatRequestBody;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({
      status: 'error',
      error: 'message ist erforderlich',
    });
    return;
  }
  if (message.length > 2000) {
    res.status(400).json({
      status: 'error',
      error: 'message darf maximal 2000 Zeichen lang sein',
    });
    return;
  }

  // --- Route-Level Timeout (15s) ---
  // Verhindert dass der Client auf eine Antwort wartet die zu lange dauert.
  // Bei Timeout: Schneller Fallback mit Service-Daten (wenn vorhanden).
  const ROUTE_TIMEOUT_MS = 25000; // 25s — genug fuer Ollama Cold-Start, aber schnell genug fuer Client
  let responseSent = false;
  const timeoutId = setTimeout(() => {
    if (!responseSent) {
      responseSent = true;
      logger.warn(`AI Chat Timeout nach ${ROUTE_TIMEOUT_MS}ms — sende Fallback`);
      // Schneller Fallback: Cross-Service-Daten wenn vorhanden, sonst generischer Text
      if (services && typeof services === 'object' && Object.keys(services).length > 0) {
        const fallbackText = `⏱️ Die KI-Assistent-Antwort dauert zu lange. Hier sind die aktuellen Daten:\n\n${Object.entries(services).map(([k, v]) => `📊 ${k}: ${JSON.stringify(v)}`).join('\n')}`;
        res.json({ status: 'timeout', response: fallbackText, model: 'timeout' });
      } else {
        res.json({ status: 'timeout', response: '⏱️ KI-Assistent ist langsam. Bitte versuche es erneut oder stelle eine kürzere Frage.', model: 'timeout' });
      }
    }
  }, ROUTE_TIMEOUT_MS);

  try {
  // --- Health Triage Auto-Detect ---
  const detectedSymptom = detectHealthSymptom(message);
  if (detectedSymptom) {
    logger.info(`Health Triage Auto-Detect: "${detectedSymptom.substring(0, 50)}"`);
    const healthContext: import('../services/promptService').ServiceContext = { health: { lat: 0, lng: 0, symptom: detectedSymptom } };
    const response = await ollamaService.chatWithContext(
      message.trim(),
      healthContext,
      { model, systemPrompt },
    );
    if (!responseSent) {
      responseSent = true;
      clearTimeout(timeoutId);
      res.json({
        status: 'ok',
        response,
        model: model ?? ollamaService.getActiveModel(),
        services_used: ['health'],
      });
    }
    return;
  }

  // Cross-Service Chat
  if (services && typeof services === 'object' && Object.keys(services).length > 0) {
    const response = await ollamaService.chatWithContext(
      message.trim(),
      services,
      { model, systemPrompt },
    );

    if (!responseSent) {
      responseSent = true;
      clearTimeout(timeoutId);
      const isFallback = response.startsWith('Hier sind die aktuellen Daten');
      res.json({
        status: isFallback ? 'context' : 'ok',
        response,
        model: model ?? ollamaService.getActiveModel(),
        services_used: Object.keys(services),
      });
    }
    return;
  }

  // Standard-Chat
  const response = await ollamaService.chat(message.trim(), {
    model,
    systemPrompt,
  });

  if (!responseSent) {
    responseSent = true;
    clearTimeout(timeoutId);
    res.json({
      status: response === ollamaService.getFallbackMessage() ? 'fallback' : 'ok',
      response,
      model: model ?? ollamaService.getActiveModel(),
    });
  }
  } catch (err) {
    clearTimeout(timeoutId);
    if (!responseSent) {
      responseSent = true;
      logger.error(`AI Chat Error: ${err}`);
      res.json({ status: 'error', response: '⚠️ Fehler beim KI-Assistenten. Bitte versuche es erneut.', model: 'error' });
    }
  }
}));

// ---------------------------------------------------------------------------
// AI Chat Stream — POST /api/ai/chat/stream (SSE)
//
// Server-Sent Events Endpoint für token-by-token Antworten.
// Ollama streamt Tokens — wir pipen sie als SSE events durch.
//
// Response: text/event-stream mit JSON events:
//   data: {"token": "Hallo"}
//   data: {"token": " Wie"}
//   data: {"done": true, "model": "qwen2.5:3b"}
// ---------------------------------------------------------------------------

aiRouter.post('/chat/stream', asyncHandler(async (req: Request, res: Response) => {
  const { message, model, systemPrompt } = req.body as ChatRequestBody;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ status: 'error', error: 'message ist erforderlich' });
    return;
  }

  // SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Heartbeat every 15s to prevent proxy timeout
  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 15000);

  try {
    const activeModel = model ?? await ollamaService.getActiveModelAsync();
    const messages: import('../services/ollamaService').ChatMessage[] = [
      { role: 'system', content: systemPrompt ?? 'Du bist HEIMAT AI. Antworte kurz auf Deutsch.' },
      { role: 'user', content: message.trim() },
    ];

    const response = await fetch(`${ollamaService['baseUrl']}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: activeModel,
        messages,
        stream: true,
        options: { num_predict: 100, temperature: 0.3 },
      }),
    });

    if (!response.ok) {
      res.write(`data: ${JSON.stringify({ error: `Ollama HTTP ${response.status}` })}\n\n`);
      res.write('data: [DONE]\n\n');
      clearInterval(heartbeat);
      res.end();
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line);
            if (chunk.message?.content) {
              res.write(`data: ${JSON.stringify({ token: chunk.message.content })}\n\n`);
            }
            if (chunk.done) {
              res.write(`data: ${JSON.stringify({ done: true, model: chunk.model ?? activeModel })}\n\n`);
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    }

    res.write('data: [DONE]\n\n');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`AI Chat Stream Error: ${msg}`);
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.write('data: [DONE]\n\n');
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
}));

// ---------------------------------------------------------------------------
// AI Status — GET /api/ai/status
//
// Prueft ob Ollama laeuft und das Default-Modell verfuegbar ist.
// Response: { available: boolean, model: string, message: string }
// ---------------------------------------------------------------------------

aiRouter.get('/status', asyncHandler(async (req: Request, res: Response) => {
  const status = await ollamaService.status();
  res.json(status);
}));

// ---------------------------------------------------------------------------
// AI Service Prompt — GET /api/ai/service-prompt?service=weather&lat=&lng=
//
// Generiert natürliche deutsche Erklärungen für HEIMAT-Services:
//   /api/ai/service-prompt?service=weather&lat=52.52&lng=13.41
//   /api/ai/service-prompt?service=air&lat=52.52&lng=13.41
//   /api/ai/service-prompt?service=waste&lat=52.52&lng=13.41&street=&houseNr=
//
// Response: { service, text, data?, fetchedAt }
// Fallback: Bei Service-Fehler wird null geliefert + error-Text.
// KEIN Ollama-Call — Template-basierte Generierung (<50ms).
// ---------------------------------------------------------------------------

aiRouter.get('/service-prompt', asyncHandler(async (req: Request, res: Response) => {
  const service = req.query.service as string;
  const latStr = req.query.lat as string;
  const lngStr = req.query.lng as string;
  const street = req.query.street as string | undefined;
  const houseNr = req.query.houseNr as string | undefined;

  if (!service || !VALID_SERVICES.has(service)) {
    res.status(400).json({
      status: 'error',
      error: `Ungültiger Service. Erlaubt: ${Array.from(VALID_SERVICES).join(', ')}`,
    });
    return;
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({
      status: 'error',
      error: 'lat und lng sind erforderlich und müssen Zahlen sein',
    });
    return;
  }

  try {
    const result = await promptService.getPrompt(
      service as ServiceName,
      lat,
      lng,
      { street, houseNr },
    );
    res.json({
      status: 'ok',
      ...result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({
      status: 'error',
      error: `Prompt für ${service} fehlgeschlagen: ${msg}`,
    });
  }
}));
