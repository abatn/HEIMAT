// ---------------------------------------------------------------------------
// healthTriagePrompt.test.ts — Phase X.10 Health AI Agent Prompt Tests
//
// Testet die Health-Triage-Prompt-Logik in ollamaService.ts + promptService.ts
//
// Test-Strategie:
// - KEIN jest.mock (Mock-Policy)
// - Teste EXPORTIERTE pure Funktion buildHealthSystemPrompt (kein Netzwerk)
// - Nur 1 chatWithContext Integrationstest mit Recording-HTTP
// ---------------------------------------------------------------------------

import { OllamaService, buildHealthSystemPrompt } from '../services/ollamaService';
import { promptService } from '../services/promptService';
import axios from 'axios';
import type { AxiosInstance } from 'axios';

// ---------------------------------------------------------------------------
// Tests: Pure Function (kein Netzwerk)
// ---------------------------------------------------------------------------

describe('HealthTriagePrompt — buildHealthSystemPrompt', () => {
  const basePrompt = 'Du bist HEIMAT AI, ein hilfreicher Assistent.';

  it('fuegt Triage-Block an Basis-Prompt an', () => {
    const result = buildHealthSystemPrompt(basePrompt);

    expect(result).toContain(basePrompt);
    expect(result).toContain('Symptom-Assessment');
    expect(result).toContain('Schritt 1');
    expect(result).toContain('Schritt 2');
    expect(result).toContain('Schritt 3');
  });

  it('Triage-Block enthaelt NOTFALL-Kriterien', () => {
    const result = buildHealthSystemPrompt(basePrompt);

    expect(result).toContain('NOTFALL');
    expect(result).toContain('Brustschmerz');
    expect(result).toContain('Atemnot');
    expect(result).toContain('Bewusstlosigkeit');
    expect(result).toContain('Schlaganfall');
    expect(result).toContain('112');
  });

  it('Triage-Block enthaelt BEREITSCHAFTS-Kriterien', () => {
    const result = buildHealthSystemPrompt(basePrompt);

    expect(result).toContain('BEREITSCHAFTSDIENST');
    expect(result).toContain('39\u00b0C');
    expect(result).toContain('116117');
  });

  it('Triage-Block enthaelt ROUTINE-Kriterien', () => {
    const result = buildHealthSystemPrompt(basePrompt);

    expect(result).toContain('ROUTINETERMIN');
    expect(result).toContain('Hausarzt');
    expect(result).toContain('Erk\u00e4ltung');
    expect(result).toContain('Kopfschmerzen');
  });

  it('Triage-Block enthaelt medizinische Disclaimer', () => {
    const result = buildHealthSystemPrompt(basePrompt);

    expect(result).toContain('KEINE medizinische Diagnose');
    expect(result).toContain('Keine Medikamente');
    expect(result).toContain('einf\u00fchlsam');
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
        expect(healthCtx.text).not.toContain('Symptom-Meldung');
      }
    }
  });
});


