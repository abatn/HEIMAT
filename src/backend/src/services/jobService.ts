// jobService.ts — Erweiterter Job-Suche Service
//
// Datenquellen:
//   1. Adzuna API (250 calls/Tag, alle Branchen, mit Gehaltsdaten)
//   2. Arbeitnow API (Fallback für Tech-Jobs, kein API-Key)
//
// Branchen-Filter: Technik, Gesundheit, Handwerk, Bildung, Gastro, Verwaltung, Logistik

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
  created_at: number;
  // Adzuna-spezifische Felder
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: boolean;
  category?: string;
  source: 'adzuna' | 'arbeitnow';
}

export interface JobSearchResult {
  jobs: JobListing[];
  total: number;
  page: number;
  per_page: number;
  source: 'adzuna' | 'arbeitnow' | 'mixed';
}

// Branchen-Mapping: UI-Filter → Adzuna Category Tag (DE API)
// Gültig getestet: 2026-08-10
const BRANCHEN_MAP: Record<string, string> = {
  alle: '',
  technik: 'it-jobs',
  gesundheit: 'healthcare-nursing-jobs',
  handwerk: 'manufacturing-jobs',
  bildung: 'teaching-jobs',
  gastro: 'hospitality-catering-jobs',
  verwaltung: 'admin-jobs',
  logistik: 'logistics-warehouse-jobs',
};

// Adzuna Category Labels für UI
export const BRANCHEN_LABELS: Record<string, string> = {
  alle: 'Alle',
  technik: 'Technik',
  gesundheit: 'Gesundheit',
  handwerk: 'Handwerk',
  bildung: 'Bildung',
  gastro: 'Gastro',
  verwaltung: 'Verwaltung',
  logistik: 'Logistik',
};

// ---------------------------------------------------------------------------
// Adzuna API (primär)
// ---------------------------------------------------------------------------

const ADZUNA_BASE = 'https://api.adzuna.com/v1/api/jobs/de/search';
const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID || '';
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY || '';
const TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class JobService {
  /**
   * Jobs suchen — versucht zuerst Adzuna, dann Arbeitnow als Fallback.
   *
   * @param query     Suchbegriff (z.B. "Krankenpfleger", "Entwickler")
   * @param location  Standort (z.B. "Berlin", "München")
   * @param branchen  Branchen-Filter (z.B. "gesundheit", "technik")
   * @param page      Seite (0-basiert)
   * @param perPage   Ergebnisse pro Seite (max 50)
   */
  async searchJobs(
    query: string,
    location?: string,
    branchen?: string,
    page: number = 0,
    perPage: number = 20
  ): Promise<JobSearchResult> {
    // Versuche zuerst Adzuna (wenn API-Key vorhanden)
    if (ADZUNA_APP_ID && ADZUNA_APP_KEY) {
      try {
        const result = await this.searchAdzuna(
          query,
          location,
          branchen,
          page,
          perPage
        );
        if (result.jobs.length > 0) {
          return result;
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn(`Adzuna failed, trying Arbeitnow: ${msg}`);
      }
    }

    // Fallback: Arbeitnow
    return this.searchArbeitnow(query, location, page, perPage);
  }

  /**
   * Adzuna API durchsuchen
   */
  private async searchAdzuna(
    query: string,
    location?: string,
    branchen?: string,
    page: number = 0,
    perPage: number = 20
  ): Promise<JobSearchResult> {
    const adzunaPage = page + 1; // Adzuna ist 1-basiert
    const params: Record<string, string | number> = {
      app_id: ADZUNA_APP_ID,
      app_key: ADZUNA_APP_KEY,
      what: query,
      results_per_page: Math.min(perPage, 50),
      sort_by: 'date',
    };

    if (location) {
      params.where = location;
    }

    // Branchen-Filter
    if (branchen && branchen !== 'alle' && BRANCHEN_MAP[branchen]) {
      params.category = BRANCHEN_MAP[branchen];
    }

    const response = await axios.get(`${ADZUNA_BASE}/${adzunaPage}`, {
      params,
      timeout: TIMEOUT_MS,
      headers: { Accept: 'application/json' },
    });

    const data = response.data;
    const results = data.results || [];

    const jobs: JobListing[] = results.map((item: Record<string, unknown>) => {
      const company = item.company as Record<string, unknown> | undefined;
      const loc = item.location as Record<string, unknown> | undefined;
      const category = item.category as Record<string, unknown> | undefined;
      const salaryMin = item.salary_min as number | undefined;
      const salaryMax = item.salary_max as number | undefined;

      return {
        slug: String(item.id || ''),
        company_name: String(company?.display_name || ''),
        title: String(item.title || ''),
        description: String(item.description || '').replace(/<[^>]*>/g, ''),
        remote: false, // Adzuna hat kein Remote-Feld
        url: String(item.redirect_url || ''),
        tags: category ? [String(category.label || '')] : [],
        job_types: [],
        location: String(loc?.display_name || ''),
        created_at: item.created
          ? Math.floor(new Date(String(item.created)).getTime() / 1000)
          : Math.floor(Date.now() / 1000),
        salary_min: salaryMin || undefined,
        salary_max: salaryMax || undefined,
        salary_is_predicted: item.salary_is_predicted === '1',
        category: category ? String(category.label || '') : undefined,
        source: 'adzuna' as const,
      };
    });

    return {
      jobs,
      total: data.count || 0,
      page,
      per_page: perPage,
      source: 'adzuna',
    };
  }

  /**
   * Arbeitnow API durchsuchen (Fallback)
   */
  private async searchArbeitnow(
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

    const response = await axios.get(
      'https://www.arbeitnow.com/api/job-board-api',
      {
        params,
        timeout: TIMEOUT_MS,
        headers: { Accept: 'application/json' },
      }
    );

    const data = response.data;
    const allJobs: Record<string, unknown>[] = data.data || [];

    // Clientseitige Paginierung
    const start = page * perPage;
    const paginatedJobs = allJobs.slice(start, start + perPage);

    const jobs: JobListing[] = paginatedJobs.map(
      (item: Record<string, unknown>) => ({
        slug: String(item.slug || ''),
        company_name: String(item.company_name || ''),
        title: String(item.title || ''),
        description: String(item.description || '').replace(/<[^>]*>/g, ''),
        remote: item.remote === true,
        url: String(item.url || ''),
        tags: (item.tags as string[]) || [],
        job_types: (item.job_types as string[]) || [],
        location: String(item.location || ''),
        created_at: Number(item.created_at) || Math.floor(Date.now() / 1000),
        source: 'arbeitnow' as const,
      })
    );

    return {
      jobs,
      total: allJobs.length,
      page,
      per_page: perPage,
      source: 'arbeitnow',
    };
  }
}

export const jobService = new JobService();
