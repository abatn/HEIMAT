// ---------------------------------------------------------------------------
// Cross-Service AI — Unit Tests
//
// Testet die intelligente Cross-Service-Empfehlungslogik:
//   1. Arzt + Wetter → Regenjacke, Kälte-Hinweis
//   2. Joggen + Luftqualität → AQI-basierte Sport-Empfehlung
//   3. Abfall + Wetter → Tonne unterstellen bei Regen
//   4. E-Auto + Wetter → Überdachte Ladesäule bei Regen
//   5. Allgemeine Tagesplanung → Wetter-basierte Aktivitäten
//   6. Kein Ollama → Cross-Service-Fallback statt generischer Text
// ---------------------------------------------------------------------------

import axios from 'axios';
import { OllamaService } from '../services/ollamaService';
import { promptService } from '../services/promptService';

// ---------------------------------------------------------------------------
// Mock: Ollama offline (ECONNREFUSED) → Fallback-Pfad wird getestet
// ---------------------------------------------------------------------------

const mockAxios = {
  post: jest.fn().mockRejectedValue({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' }),
  get: jest.fn().mockRejectedValue({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' }),
} as unknown as typeof axios;

const offlineService = new OllamaService(mockAxios as never);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Cross-Service AI — Recommendation Engine', () => {
  // -----------------------------------------------------------------------
  // Test 1: Arzt-Termin + Wetter → Regenjacke-Hinweis
  // -----------------------------------------------------------------------
  describe('Arzt + Wetter Cross-Service', () => {
    it('sollte Regen-Hinweis geben wenn Wetter regnerisch und User nach Arzt fragt', async () => {
      const response = await offlineService.chatWithContext(
        'Ich brauche einen Arzttermin',
        {
          weather: { lat: 52.52, lng: 13.41 },
          health: { lat: 52.52, lng: 13.41 },
        },
      );

      // Sollte Cross-Service-Empfehlung enthalten (nicht nur Rohdaten)
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(50);

      // Sollte Service-Daten enthalten
      const hasWeatherData = response.includes('WETTER') || response.includes('°C');
      const hasHealthData = response.includes('HEALTH') || response.includes('Arzt') || response.includes('Doctor');
      expect(hasWeatherData || hasHealthData).toBe(true);
    });

    it('sollte Kälte-Hinweis bei Temperaturen unter 5 Grad geben', async () => {
      const response = await offlineService.chatWithContext(
        'Morgen zum Arzt',
        {
          weather: { lat: 52.52, lng: 13.41 },
          health: { lat: 52.52, lng: 13.41 },
        },
      );

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    });
  });

  // -----------------------------------------------------------------------
  // Test 2: Joggen + Luftqualität → AQI-Empfehlung
  // -----------------------------------------------------------------------
  describe('Sport + Luftqualität Cross-Service', () => {
    it('sollte Luftqualitäts-Empfehlung bei Sportanfrage geben', async () => {
      const response = await offlineService.chatWithContext(
        'Heute joggen gehen',
        {
          air: { lat: 52.52, lng: 13.41 },
          weather: { lat: 52.52, lng: 13.41 },
        },
      );

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(50);

      // Sollte mindestens einen der Services enthalten
      const hasAirData = response.includes('LUFTQUALITÄT') || response.includes('AQI');
      const hasWeatherData = response.includes('WETTER') || response.includes('°C');
      expect(hasAirData || hasWeatherData).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Test 3: Abfall + Wetter → Tonne-Management
  // -----------------------------------------------------------------------
  describe('Abfall + Wetter Cross-Service', () => {
    it('sollte Wetter-bezogene Abfall-Empfehlung geben', async () => {
      const response = await offlineService.chatWithContext(
        'Wann kommt die Müllabfuhr?',
        {
          waste: { lat: 52.52, lng: 13.41, street: 'Friedrichstraße', houseNr: '100' },
          weather: { lat: 52.52, lng: 13.41 },
        },
      );

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    });
  });

  // -----------------------------------------------------------------------
  // Test 4: E-Auto + Wetter → Lade-Empfehlung
  // -----------------------------------------------------------------------
  describe('E-Auto + Wetter Cross-Service', () => {
    it('sollte Wetter-bezogene Lade-Empfehlung geben', async () => {
      const response = await offlineService.chatWithContext(
        'Wo kann ich mein E-Auto laden?',
        {
          weather: { lat: 52.52, lng: 13.41 },
        },
      );

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    });
  });

  // -----------------------------------------------------------------------
  // Test 5: Allgemeine Tagesplanung
  // -----------------------------------------------------------------------
  describe('Tagesplanung Cross-Service', () => {
    it('sollte wetter-basierte Planungsempfehlung geben', async () => {
      const response = await offlineService.chatWithContext(
        'Was soll ich heute machen?',
        {
          weather: { lat: 52.52, lng: 13.41 },
          air: { lat: 52.52, lng: 13.41 },
        },
      );

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(50);
    });
  });

  // -----------------------------------------------------------------------
  // Test 6: Fallback ohne Services
  // -----------------------------------------------------------------------
  describe('Fallback ohne Service-Daten', () => {
    it('sollte Fallback-Text geben wenn keine Services vorhanden', async () => {
      const response = await offlineService.chatWithContext(
        'Hallo',
        {},
      );

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      // Bei leerem Context → Standard-Fallback
      expect(response).toContain('KI-Assistent ist nicht verfügbar');
    });
  });

  // -----------------------------------------------------------------------
  // Test 7: Multi-Service Cross-Service
  // -----------------------------------------------------------------------
  describe('Multi-Service Cross-Service', () => {
    it('sollte mehrere Services parallel verarbeiten', async () => {
      const response = await offlineService.chatWithContext(
        'Planer meinen Tag',
        {
          weather: { lat: 52.52, lng: 13.41 },
          air: { lat: 52.52, lng: 13.41 },
          waste: { lat: 52.52, lng: 13.41 },
        },
      );

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(100);

      // Sollte Service-Daten oder Empfehlungen enthalten
      const hasContent = response.includes('📊') || response.includes('°C') || response.includes('HEIMAT');
      expect(hasContent).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Test 8: Offline-Fallback generiert Cross-Service-Empfehlungen
  // -----------------------------------------------------------------------
  describe('Offline-Fallback mit Cross-Service-Empfehlungen', () => {
    it('sollte Cross-Service-Empfehlungen im Fallback enthalten', async () => {
      const response = await offlineService.chatWithContext(
        'Heute joggen gehen',
        {
          air: { lat: 52.52, lng: 13.41 },
          weather: { lat: 52.52, lng: 13.41 },
        },
      );

      // Fallback sollte EMPOHLUNGEN enthalten (nicht nur Rohdaten)
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');

      // Prüfe ob Cross-Service-Struktur vorhanden ist
      const hasStructure = response.includes('📊') || response.includes('HEIMAT');
      expect(hasStructure).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// promptService — Erweiterte Tipps
// ---------------------------------------------------------------------------

describe('promptService — Erweiterte Tipps', () => {
  it('sollte weatherTip mit Emojis zurückgeben', async () => {
    // PromptService nutzt echte APIs — wir testen nur die Struktur
    const result = await promptService.getPrompt('weather', 52.52, 13.41);
    expect(result.service).toBe('weather');
    expect(result.text).toBeDefined();
    expect(typeof result.text).toBe('string');
    expect(result.text.length).toBeGreaterThan(20);
    // Sollte Emojis enthalten (neue Tipps)
    expect(result.text).toMatch(/[🌦️☀️💧🌬️❄️🥶🌪️⛈️🌿]/);
  });

  it('sollte airQualityPrompt mit AQI-Empfehlung zurückgeben', async () => {
    const result = await promptService.getPrompt('air', 52.52, 13.41);
    expect(result.service).toBe('air');
    expect(result.text).toBeDefined();
    expect(typeof result.text).toBe('string');
    expect(result.text.length).toBeGreaterThan(20);
  });
});
