/**
 * AbfallPlus API Tests
 *
 * Regeln:
 * - KEINE Mocks/Simulations (User-Regel: "mock, simulation, fake sind verboten")
 * - Echte HTTP-Calls gegen abfallplus.de
 * - CI: Diese Tests können bei API-Ausfall flaky sein
 */

import { AbfallPlusService } from '../services/abfallplusService';

// Increase timeout for external API calls
jest.setTimeout(60000);

describe('AbfallPlusService', () => {
  // Test Case 1: Stadt-Liste abrufen (Bonn)
  it('Bonn: init_connection + getKommunen liefert Kommunen', async () => {
    const service = new AbfallPlusService('de.k4systems.bonnorange');
    const steps = await service.initConnection();
    expect(steps).toBeDefined();
    expect(Array.isArray(steps)).toBe(true);

    const kommunen = await service.getKommunen();
    expect(kommunen.length).toBeGreaterThan(0);
    // Bonn hat 27 Kommunen (Buchstaben A-Z)
    expect(kommunen.length).toBe(27);
    expect(kommunen[0].name).toBe('A');
  });

  // Test Case 2: Straßen abrufen (Bonn, Kommune A)
  it('Bonn: getStreets für Kommune A liefert Straßen', async () => {
    const service = new AbfallPlusService('de.k4systems.bonnorange');
    await service.initConnection();
    await service.selectKommune('A');

    const streets = await service.getStreets();
    expect(streets.length).toBeGreaterThan(100);
    // "Auf dem Hügel" muss gefunden werden
    const huegel = streets.find(s => s.name.toLowerCase().includes('hügel'));
    expect(huegel).toBeDefined();
    expect(huegel!.name).toContain('Auf dem Hügel');
  });

  // Test Case 3: Kompletter Flow — Kalender für Bonn, Auf dem Hügel 6
  it('Bonn: fetchCalendar liefert Abfalltermine', async () => {
    const service = new AbfallPlusService('de.k4systems.bonnorange');
    const result = await service.fetchCalendar('Auf dem Hügel', '6', 2);

    expect(result.status).toBe('ok');
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.source).toBe('AbfallPlus');

    // Prüfe dass Events gültige Daten haben
    for (const event of result.events) {
      expect(event.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(event.summary).toBeTruthy();
      expect(event.wasteType).toBeTruthy();
    }

    // Prüfe dass diverse Abfallarten vorhanden sind
    const wasteTypes = new Set(result.events.map(e => e.wasteType));
    expect(wasteTypes.size).toBeGreaterThan(1);
  });
});
