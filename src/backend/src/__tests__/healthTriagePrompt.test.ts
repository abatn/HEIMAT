// ---------------------------------------------------------------------------
// healthTriagePrompt.test.ts — Phase X.10 Health AI Agent Prompt Tests
//
// Testet den Health-Triage-System-Prompt.
//
// Test-Strategie:
// - KEIN jest.mock (Mock-Policy)
// - Nur PURE Funktionen testen (kein Netzwerk, kein Timeout)
// - buildHealthSystemPrompt ist eine exportierte reine Funktion in
//   ollamaService.ts — kein axios, kein HTTP, keine DB
// ---------------------------------------------------------------------------

import { buildHealthSystemPrompt } from '../services/ollamaService';

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

  it('Triage-Block enthaelt Ada-Health-artige Rueckfragen', () => {
    const result = buildHealthSystemPrompt(basePrompt);

    expect(result).toContain('Schmerzskala');
    expect(result).toContain('Begleitsymptome');
    expect(result).toContain('Ausl\u00f6ser');
  });
});
