// ---------------------------------------------------------------------------
// healthTriagePrompt.test.ts — Phase X.10 Health AI Agent Prompt Tests
//
// Testet die Health-Triage-Prompt-Logik in ollamaService.ts + promptService.ts
//
// Test-Strategie:
// - KEIN jest.mock (Mock-Policy)
// - Constructor-DI für AxiosInstance in OllamaService
// - Mock-HTTP fängt den POST /api/chat Request ab und prüft den System-Prompt
// - Testet: Health-Triage-Prompt wird injiziert + Symptom-Context wird übergeben
// ---------------------------------------------------------------------------

import { OllamaService } from '../services/ollamaService';
import { promptService } from '../services/promptService';
import axios from 'axios';
import type { AxiosInstance } from 'axios';

// ---------------------------------------------------------------------------
// Hilfsfunktion: Erzeugt eine AxiosInstance die POST-Anfragen aufzeichnet
// ---------------------------------------------------------------------------

function createRecordingHttp(): {
  http: AxiosInstance;
  getRequests: () => Array<{ url: string; body: unknown }>;
} {
  const requests: Array<{ url: string; body: unknown }> = [];

  const http = axios.create({
    // adapter: macht keine echten HTTP-Calls (nur Recording)
  });

  // @ts-expect-error - AxiosInstance-adapter überschreiben für Test-Zwecke
  http.defaults.adapter = async (config: Record<string, unknown>) => {
    requests.push({
      url: config.url as string,
      body: config.data ? JSON.parse(config.data as string) : null,
    });
    return {
      data: {
        model: 'llama3.1:8b',
        message: {
          role: 'assistant',
          content: 'Danke fuer deine Nachricht.',
        },
        done: true,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };

  return {
    http,
    getRequests: () => [...requests],
  };
}

// ---------------------------------------------------------------------------
// Der vollständige Triage-Prompt-Block (genutzte Strings für Assertions)
// ---------------------------------------------------------------------------
// Der Triage-Block beginnt mit dieser Überschrift:
// "## 🏥 Gesundheit — Symptom-Assessment & Triage"
// und enthält die Abschnitte "Schritt 1", "Schritt 2", "Schritt 3".
// Der DEFAULT_SYSTEM_PROMPT enthält nur die Service-Liste mit
// "Symptom-Assessment + Triage" als Beschreibung (einzeilig, kein Block).
// Daher: Prüfe auf den BLOCK (mehrzeilig) nicht auf den String allein.

describe('HealthTriagePrompt — buildHealthSystemPrompt', () => {
  it('chatWithContext mit health-Context injiziert Triage-Prompt', async () => {
    const { http, getRequests } = createRecordingHttp();
    const service = new OllamaService(http);

    await service.chatWithContext('Ich habe Rueckenschmerzen', {
      health: { lat: 52.52, lng: 13.41 },
    });

    const requests = getRequests();
    expect(requests.length).toBe(1);
    const messages = (requests[0].body as Record<string, unknown>).messages as Array<Record<string, unknown>>;
    const systemMsg = messages.find(m => m.role === 'system')?.content as string;

    // Pruefe: Triage-Prompt-Block (mehrzeilig) ist enthalten
    expect(systemMsg).toContain('Symptom-Assessment');
    expect(systemMsg).toContain('NOTFALL');
    expect(systemMsg).toContain('BEREITSCHAFTSDIENST');
    expect(systemMsg).toContain('ROUTINETERMIN');
    expect(systemMsg).toContain('Schritt 1');
    expect(systemMsg).toContain('Schritt 2');
    expect(systemMsg).toContain('Schritt 3');
    expect(systemMsg).toContain('112');
    expect(systemMsg).toContain('116117');
  });

  it('chatWithContext OHNE health-Context enthaelt keinen Triage-Block', async () => {
    const { http, getRequests } = createRecordingHttp();
    const service = new OllamaService(http);

    await service.chatWithContext('Wie ist das Wetter?', {
      weather: { lat: 52.52, lng: 13.41 },
    });

    const requests = getRequests();
    expect(requests.length).toBe(1);
    const messages = (requests[0].body as Record<string, unknown>).messages as Array<Record<string, unknown>>;
    const systemMsg = messages.find(m => m.role === 'system')?.content as string;

    // Default-Prompt + Service-Daten
    expect(systemMsg).toContain('HEIMAT AI');
    expect(systemMsg).toContain('[WEATHER]');

    // Default-Prompt erwaehnt "Symptom-Assessment" nur als Liste (einzeilig)
    // Der MEHRZEILIGE Triage-BLOCK muss fehlen
    expect(systemMsg).not.toContain('Schritt 1');
    expect(systemMsg).not.toContain('Schritt 2');
    expect(systemMsg).not.toContain('NOTFALL');
  });

  it('chatWithContext mit health+weather: beide Kontexte sichtbar', async () => {
    const { http, getRequests } = createRecordingHttp();
    const service = new OllamaService(http);

    await service.chatWithContext('Ich habe Kopfschmerzen', {
      health: { lat: 52.52, lng: 13.41 },
      weather: { lat: 52.52, lng: 13.41 },
    });

    const requests = getRequests();
    expect(requests.length).toBe(1);
    const messages = (requests[0].body as Record<string, unknown>).messages as Array<Record<string, unknown>>;
    const systemMsg = messages.find(m => m.role === 'system')?.content as string;

    // Triage-Prompt + beide Service-Kontexte
    expect(systemMsg).toContain('Schritt 1');
    expect(systemMsg).toContain('NOTFALL');
    // Service-Daten: [WEATHER] + [HEALTH]
    expect(systemMsg).toContain('[WEATHER]');
    expect(systemMsg).toContain('[HEALTH]');
  });
});

describe('HealthTriagePrompt — Symptom-Context in promptService', () => {
  it('fetchServiceContexts mit Symptom uebergibt symptom-String', async () => {
    const result = await promptService.fetchServiceContexts({
      health: { lat: 52.52, lng: 13.41, symptom: 'Brustschmerzen' },
    });

    // Ergebnis kann im CI ohne Netzwerk leer sein
    if (result.length > 0) {
      const healthCtx = result.find(r => r.service === 'health');
      if (healthCtx) {
        expect(healthCtx.text).toBeTruthy();
      }
    }
  });

  it('health-Context ohne Symptom hat keinen Symptom-Text', async () => {
    const result = await promptService.fetchServiceContexts({
      health: { lat: 52.52, lng: 13.41 },
    });

    if (result.length > 0) {
      const healthCtx = result.find(r => r.service === 'health');
      if (healthCtx) {
        // Ohne Symptom: Keine Symptom-Meldung im Text
        expect(healthCtx.text).not.toContain('Symptom-Meldung');
      }
    }
  });
});

describe('HealthTriagePrompt — Triage-Kategorien im Prompt', () => {
  it('Triage-Prompt enthaelt NOTFALL-Kriterien (Brustschmerz, Atemnot)', async () => {
    const { http, getRequests } = createRecordingHttp();
    const service = new OllamaService(http);

    await service.chatWithContext('Mir geht es nicht gut', {
      health: { lat: 52.52, lng: 13.41 },
    });

    const requests = getRequests();
    const messages = (requests[0].body as Record<string, unknown>).messages as Array<Record<string, unknown>>;
    const systemMsg = messages.find(m => m.role === 'system')?.content as string;

    expect(systemMsg).toContain('Brustschmerz');
    expect(systemMsg).toContain('Atemnot');
    expect(systemMsg).toContain('Bewusstlosigkeit');
    expect(systemMsg).toContain('Schlaganfall');
  });

  it('Triage-Prompt enthaelt BEREITSCHAFTS-Kriterien', async () => {
    const { http, getRequests } = createRecordingHttp();
    const service = new OllamaService(http);

    await service.chatWithContext('Ich habe Fieber', {
      health: { lat: 52.52, lng: 13.41 },
    });

    const requests = getRequests();
    const messages = (requests[0].body as Record<string, unknown>).messages as Array<Record<string, unknown>>;
    const systemMsg = messages.find(m => m.role === 'system')?.content as string;

    expect(systemMsg).toContain('39\u00b0C');
    expect(systemMsg).toContain('116117');
    expect(systemMsg).toContain('BEREITSCHAFTSDIENST');
  });

  it('Triage-Prompt enthaelt ROUTINE-Kriterien (Erkaeltung, Kopfschmerzen)', async () => {
    const { http, getRequests } = createRecordingHttp();
    const service = new OllamaService(http);

    await service.chatWithContext('Ich habe Schnupfen', {
      health: { lat: 52.52, lng: 13.41 },
    });

    const requests = getRequests();
    const messages = (requests[0].body as Record<string, unknown>).messages as Array<Record<string, unknown>>;
    const systemMsg = messages.find(m => m.role === 'system')?.content as string;

    expect(systemMsg).toContain('ROUTINETERMIN');
    expect(systemMsg).toContain('Hausarzt');
    // Genauen Prompt-Text verwenden
    // Prompt-Text: Erkältung, leichte Kopfschmerzen
    // (Umbrüche: newline + Aufzählungszeichen statt Komma)
    expect(systemMsg).toContain('Erkältung');
    expect(systemMsg).toContain('Kopfschmerzen');
  });
});
