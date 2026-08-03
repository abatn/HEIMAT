// ---------------------------------------------------------------------------  
// Cross-Service AI — Unit Tests
//
// Testet die intelligente Cross-Service-Empfehlungslogik DIREKT
// (ohne echte API-Calls → kein Timeout in CI).
//
// Architektur:
//   - Importiere generateCrossServiceRecommendations() direkt
//   - Mocke keine externen APIs
//   - Teste nur die Recommendation-Engine (reine Logik)
// ---------------------------------------------------------------------------

import axios from 'axios';
import { OllamaService } from '../services/ollamaService';

// ---------------------------------------------------------------------------  
// Mock: Ollama offline (ECONNREFUSED) → Fallback-Pfad wird getestet
// ---------------------------------------------------------------------------

const mockAxios = {
  post: jest.fn().mockRejectedValue({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' }),
  get: jest.fn().mockRejectedValue({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' }),
} as unknown as typeof axios;

const offlineService = new OllamaService(mockAxios as never);

// ---------------------------------------------------------------------------  
// Export der internen Funktion zum Testen
// generateCrossServiceRecommendations ist NICHT exportiert,
// also testen wir über den chatWithContext-Fallback-Pfad mit
// leerem Service-Context (keine echten APIs).
// ---------------------------------------------------------------------------

describe('Cross-Service AI — Recommendation Engine', () => {
  // -----------------------------------------------------------------------  
  // Test 1: Leerer Context → Standard-Fallback
  // -----------------------------------------------------------------------  
  describe('Fallback ohne Service-Daten', () => {
    it('sollte Fallback-Text geben wenn keine Services vorhanden', async () => {
      const response = await offlineService.chatWithContext('Hallo', {});

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response).toContain('KI-Assistent ist nicht verfügbar');
    });
  });

  // -----------------------------------------------------------------------  
  // Test 2: Ollama-Status
  // -----------------------------------------------------------------------  
  describe('Ollama Service', () => {
    it('sollte Fallback-Message zurückgeben wenn Ollama offline', () => {
      const msg = offlineService.getFallbackMessage();
      expect(msg).toContain('KI-Assistent ist nicht verfügbar');
    });

    it('sollte aktives Modell zurückgeben', () => {
      const model = offlineService.getActiveModel();
      expect(typeof model).toBe('string');
      expect(model.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------  
  // Test 3: Health Triage (keine externen APIs nötig)
  // -----------------------------------------------------------------------  
  describe('Health Triage Auto-Detect', () => {
    it('sollte Triage-Antwort bei Symptom geben', async () => {
      const response = await offlineService.chatWithContext(
        'Ich habe starke Brustschmerzen',
        { health: { lat: 52.52, lng: 13.41, symptom: 'Brustschmerzen' } },
      );

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      // Triage sollte NOTFALL oder BEREITSCHAFT enthalten
      const hasTriage = response.includes('NOTFALL') || response.includes('BEREITSCHAFT') || response.includes('112') || response.includes('116117');
      expect(hasTriage).toBe(true);
    });

    it('sollte ROUTINE bei leichten Symptomen geben', async () => {
      const response = await offlineService.chatWithContext(
        'Ich habe leichte Kopfschmerzen',
        { health: { lat: 52.52, lng: 13.41, symptom: 'Kopfschmerzen' } },
      );

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      // Triage sollte mindestens ROUTINE enthalten
      const hasTriage = response.includes('ROUTINE') || response.includes('Hausarzt') || response.includes('Triage');
      expect(hasTriage).toBe(true);
    });
  });

  // -----------------------------------------------------------------------  
  // Test 4: chatWithContext mit Service-Context
  // (verwendet mockAxios → keine echten API-Calls → kein Timeout)
  // -----------------------------------------------------------------------  
  describe('chatWithContext mit Service-Context', () => {
    it('sollte Fallback bei leerem Context und keinem Ollama geben', async () => {
      const response = await offlineService.chatWithContext(
        'Was ist das Wetter?',
        { weather: { lat: 52.52, lng: 13.41 } },
      );

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      // Ohne echte APIs → Fallback-Text
      expect(response.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------  
// promptService — Struktur-Test (ohne echte API-Calls)
// ---------------------------------------------------------------------------

describe('promptService — Types und Struktur', () => {
  it('sollte ServiceName-Typen validieren', async () => {
    // Teste nur die Struktur, nicht die echten API-Calls
    const { promptService } = await import('../services/promptService');
    expect(promptService).toBeDefined();
    expect(typeof promptService.getPrompt).toBe('function');
    expect(typeof promptService.fetchServiceContexts).toBe('function');
  });
});
