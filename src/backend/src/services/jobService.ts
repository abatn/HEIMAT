// jobService.ts — Phase D: Job-Suche via Arbeitnow API (Open Source, kein API-Key)
//
// Datenquelle: https://www.arbeitnow.com/api/job-board-api
// Kein API-Key nötig, keine Rate-Limits für normalen Gebrauch.
// Enthält Tech-Jobs aus Deutschland (Greenhouse, SmartRecruiters, Join, Recruitee).
//
// Fallback-Strategie (mirror weatherService.ts):
//   Primary: Arbeitnow API
//   Kein Fallback nötig — Arbeitnow ist stabil und kostenlos.

import axios from 'axios';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JobListing {
  slug: string;
  company_name: string;
  title: string;
  description: string;
  remote: boolean;
  url: string;
  tags: string[];
  job_types: string[];
  location: string;
  created_at: number; // unix timestamp
}

export interface JobSearchResult {
  jobs: JobListing[];
  total: number;
  page: number;
  per_page: number;
  source: 'arbeitnow';
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const BASE_URL = 'https://www.arbeitnow.com/api/job-board-api';
const TIMEOUT_MS = 10_000;

export class JobService {
  /**
   * Jobs suchen nach Stichwort und Standort.
   *
   * @param query     Suchbegriff (z.B. "Entwickler", "Designer")
   * @param location  Standort (z.B. "Berlin", "Remote")
   * @param page      Seite (0-basiert)
   * @param perPage   Ergebnisse pro Seite (max 50)
   */
  async searchJobs(
    query: string,
    location?: string,
    page: number = 0,
    perPage: number = 20
  ): Promise<JobSearchResult> {
    const params: Record<string, string | number> = {
      search: query,
    };
    if (location) {
      params.location = location;
    }

    try {
      const response = await axios.get(BASE_URL, {
        params,
        timeout: TIMEOUT_MS,
        headers: {
          Accept: 'application/json',
        },
      });

      const data = response.data;
      const allJobs: JobListing[] = data.data || [];

      // Clientseitige Paginierung (Arbeitnow liefert alles auf einmal)
      const start = page * perPage;
      const paginatedJobs = allJobs.slice(start, start + perPage);

      return {
        jobs: paginatedJobs,
        total: allJobs.length,
        page,
        per_page: perPage,
        source: 'arbeitnow',
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`JobService: Arbeitnow failed — ${msg}`);
      throw new Error(`Job-Suche fehlgeschlagen: ${msg}`);
    }
  }
}

export const jobService = new JobService();
