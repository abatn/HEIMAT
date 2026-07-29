import { Router, Request, Response, NextFunction } from 'express';
import { getDashboardContext, getPersonalizedContext } from '../services/aiHomeService';
import { ollamaService } from '../services/ollamaService';

export const aiRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next); };

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
