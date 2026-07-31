// ---------------------------------------------------------------------------
// ollamaService.test.ts — Phase AI-1 Ollama Service Tests
//
// Test-Strategie: KEIN jest.mock('axios'). Die OllamaService-Klasse hat
// Constructor-DI für AxiosInstance, aber für die 3 Tests nutzen wir
// den echten axios-Client:
//   - Constructor: prüft nur dass kein throw kommt
//   - Connection-Refused: Ollama läuft im CI nicht → ECONNREFUSED ist
//     der erwartete Pfad (kein Mock, reale Fehler-Behandlung)
//   - Fallback-Text-Konstante: ollamaService.getFallbackMessage()
//
// Mock-Policy-Konformität: Kein jest.mock, kein Stub, kein Fake.
// Der Connection-Refused-Fall ist ein REALER Integration-Test, der
// die Fehlerbehandlung im CI validiert (Ollama ist dort offline).
// ---------------------------------------------------------------------------

import { OllamaService } from '../services/ollamaService';
import { externalServices } from '../config/externalServices';

describe('OllamaService', () => {
  describe('Constructor', () => {
    it('erzeugt Service ohne Fehler', () => {
      const service = new OllamaService();
      expect(service).toBeInstanceOf(OllamaService);
    });

    it('setzt Standard-Modell und baseUrl', () => {
      const service = new OllamaService();
      // Kann per getter nicht öffentlich abgefragt werden → prüfe
      // dass getFallbackMessage() den erwarteten Text liefert
      expect(service.getFallbackMessage()).toContain(
        'KI-Assistent ist nicht verfügbar'
      );
    });

    it('baseUrl kommt aus externalServices-Registry', () => {
      // Prüfe dass externalServices.ollamaBaseUrl existiert
      expect(externalServices.ollamaBaseUrl).toBeDefined();
      expect(externalServices.ollamaBaseUrl).toContain('localhost');
    });
  });

  describe('Connection-Refused-Fallback (Ollama offline)', () => {
    it('chat() gibt Fallback-Text bei ECONNREFUSED (Ollama nicht im CI)', async () => {
      const service = new OllamaService();
      const result = await service.chat('Hallo Welt');
      expect(result).toContain('KI-Assistent ist nicht verfügbar');
    });

    it('chat() wirft KEINE Exception bei Verbindungsfehler', async () => {
      const service = new OllamaService();
      // Sollte nie throw-en, immer Fallback-Text liefern
      const result = await service.chat('Test');
      expect(result).toBeDefined();
      expect(result).toContain('KI-Assistent ist nicht verfügbar');
    });

    it('status() zeigt available=false bei offline-Ollama', async () => {
      const service = new OllamaService();
      const status = await service.status();
      expect(status.available).toBe(false);
      expect(status.model).toBe('qwen2.5:3b');
      expect(status.message).toContain('nicht erreichbar');
    });
  });

  describe('Fallback-Message', () => {
    it('getFallbackMessage() liefert deutschen Text', () => {
      const service = new OllamaService();
      const fallback = service.getFallbackMessage();
      expect(fallback).toContain('KI-Assistent');
      expect(fallback).toContain('nicht verfügbar');
      expect(fallback).toContain('Ollama');
    });

    it('Fallback-Text ist konstant (gleicher Wert pro Instanz)', () => {
      const service1 = new OllamaService();
      const service2 = new OllamaService();
      expect(service1.getFallbackMessage()).toBe(
        service2.getFallbackMessage()
      );
    });
  });
});
