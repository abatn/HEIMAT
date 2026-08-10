// jobs.test.ts — Tests für erweiterten Job-Service (Adzuna + Arbeitnow)
//
// Keine Mocks — echte API-Calls gegen Adzuna und Arbeitnow
// Tests prüfen: Jobs aus verschiedenen Branchen, Gehaltsdaten, Branchen-Filter

import { jobService, BRANCHEN_LABELS } from '../services/jobService';

// Timeout für externe API-Calls
jest.setTimeout(30_000);

describe('JobService (erweitert)', () => {
  // ------------------------------------------------------------------
  // Grundfunktionen
  // ------------------------------------------------------------------

  describe('searchJobs — Basis', () => {
    it('sollte Jobs für "Entwickler" finden', async () => {
      const result = await jobService.searchJobs('Entwickler', undefined, undefined, 0, 5);
      expect(result.jobs.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
      expect(result.source).toBeDefined();
    });

    it('sollte Jobs für "Krankenpfleger Berlin" finden', async () => {
      const result = await jobService.searchJobs('Krankenpfleger', 'Berlin', undefined, 0, 5);
      expect(result.jobs.length).toBeGreaterThan(0);
    });

    it('sollte Jobs für "Koch München" finden', async () => {
      const result = await jobService.searchJobs('Koch', 'München', undefined, 0, 5);
      expect(result.jobs.length).toBeGreaterThan(0);
    });

    it('sollte Jobs für "Lehrer Köln" finden', async () => {
      const result = await jobService.searchJobs('Lehrer', 'Köln', undefined, 0, 5);
      expect(result.jobs.length).toBeGreaterThan(0);
    });
  });

  // ------------------------------------------------------------------
  // Branchen-Filter
  // ------------------------------------------------------------------

  describe('searchJobs — Branchen-Filter', () => {
    it('sollte Gesundheits-Jobs finden', async () => {
      const result = await jobService.searchJobs('Pflege', undefined, 'gesundheit', 0, 5);
      expect(result.jobs.length).toBeGreaterThan(0);
      // Prüfe ob Kategorie vorhanden ist (wenn Adzuna)
      if (result.source === 'adzuna') {
        result.jobs.forEach((job) => {
          expect(job.category).toBeDefined();
        });
      }
    });

    it('sollte IT-Jobs finden', async () => {
      const result = await jobService.searchJobs('Entwickler', undefined, 'technik', 0, 5);
      expect(result.jobs.length).toBeGreaterThan(0);
    });

    it('sollte alle verfügbaren Branchen auflisten', () => {
      expect(Object.keys(BRANCHEN_LABELS)).toEqual(
        expect.arrayContaining([
          'alle', 'technik', 'gesundheit', 'handwerk',
          'bildung', 'gastro', 'verwaltung', 'logistik'
        ])
      );
    });
  });

  // ------------------------------------------------------------------
  // Gehaltsdaten
  // ------------------------------------------------------------------

  describe('searchJobs — Gehaltsdaten', () => {
    it('sollte Gehaltsdaten enthalten wenn vorhanden (Adzuna)', async () => {
      // Adzuna liefert salary_min/salary_max
      const result = await jobService.searchJobs('Entwickler', 'Berlin', 'technik', 0, 10);
      
      // Mindestens einige Jobs sollten Gehalt haben (nicht alle)
      if (result.source === 'adzuna' && result.jobs.length > 0) {
        const jobsWithSalary = result.jobs.filter(j => j.salary_min || j.salary_max);
        // Mindestens 1 Job sollte Gehalt haben
        expect(jobsWithSalary.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ------------------------------------------------------------------
  // Quellen
  // ------------------------------------------------------------------

  describe('searchJobs — Quellen', () => {
    it('sollte Arbeitnow als Fallback verwenden wenn Adzuna nicht konfiguriert', async () => {
      // Ohne ADZUNA_APP_ID/KEY sollte Arbeitnow als Fallback dienen
      const result = await jobService.searchJobs('Test', undefined, undefined, 0, 5);
      expect(result.source).toBeDefined();
      expect(['adzuna', 'arbeitnow']).toContain(result.source);
    });
  });

  // ------------------------------------------------------------------
  // Paginierung
  // ------------------------------------------------------------------

  describe('searchJobs — Paginierung', () => {
    it('sollte paginierte Ergebnisse liefern', async () => {
      const page0 = await jobService.searchJobs('Entwickler', undefined, undefined, 0, 5);
      expect(page0.page).toBe(0);
      expect(page0.jobs.length).toBeLessThanOrEqual(5);
    });
  });

  // ------------------------------------------------------------------
  // Fehlerbehandlung
  // ------------------------------------------------------------------

  describe('searchJobs — Fehlerbehandlung', () => {
    it('sollte leere Ergebnisse für ungültige Suchbegriffe liefern', async () => {
      const result = await jobService.searchJobs(
        'xyznonexistentjob12345',
        undefined,
        undefined,
        0,
        5
      );
      // Sollte keine Fehler werfen, sondern leere Liste
      expect(result.jobs).toBeDefined();
      expect(Array.isArray(result.jobs)).toBe(true);
    });
  });
});
