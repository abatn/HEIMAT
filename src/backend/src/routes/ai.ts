import { Router, Request, Response, NextFunction } from 'express';
import { getDashboardContext, getPersonalizedContext } from '../services/aiHomeService';
import { ollamaService } from '../services/ollamaService';
import { promptService, type ServiceName } from '../services/promptService';

export const aiRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next); };

const VALID_SERVICES = new Set<string>(['weather', 'air', 'waste']);

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
// Sendet eine User-Nachricht an Ollama (llama3.1:8b) und gibt die
// KI-generierte Antwort zurueck.
//
// Body: { message: string, model?: string, systemPrompt?: string }
// Response: { status: 'ok' | 'error', response: string, model: string }
//
// Fallback: Wenn Ollama offline ist, kommt ein klarer deutscher Text
// (kein Mock, kein Cache).
// ---------------------------------------------------------------------------

export interface ChatRequestBody {
  message: string;
  model?: string;
  systemPrompt?: string;
}

aiRouter.post('/chat', asyncHandler(async (req: Request, res: Response) => {
  const { message, model, systemPrompt } = req.body as ChatRequestBody;

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

  const response = await ollamaService.chat(message.trim(), {
    model,
    systemPrompt,
  });

  res.json({
    status: response === ollamaService.getFallbackMessage() ? 'fallback' : 'ok',
    response,
    model: model ?? 'llama3.1:8b',
  });
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
