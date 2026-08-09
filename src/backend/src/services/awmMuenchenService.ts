/**
 * AWM München Service — Port der Python-Implementierung
 * Quelle: https://github.com/mampfes/hacs_waste_collection_schedule
 * Datei: custom_components/.../source/awm_muenchen_de.py
 *
 * API Flow (Multi-Step):
 *   1. GET https://www.awm-muenchen.de/entsorgen/abfuhrkalender → form hidden fields
 *   2. POST address → ICS download link OR location ID selection
 *   3. POST location IDs (if needed) → ICS download link OR collection cycle selection
 *   4. POST collection cycle (if needed) → ICS download link
 *   5. GET ICS → parse events
 */

import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { parseIcsCalendar, type IcsEvent } from '../lib/icalParser';
import { logger } from '../utils/logger';

const BASE_URL = 'https://www.awm-muenchen.de';

export interface AwmMuenchenResult {
  status: 'ok' | 'error';
  events: IcsEvent[];
  city?: string;
  source?: string;
  message?: string;
}

export class AwmMuenchenService {
  private readonly street: string;
  private readonly houseNumber: string;
  private session: AxiosInstance;
  private cookies: Record<string, string> = {};

  constructor(street: string, houseNumber: string) {
    this.street = street;
    this.houseNumber = houseNumber;
    this.session = axios.create({ timeout: 20000, maxRedirects: 5 });
  }

  private async request(url: string, method: 'get' | 'post' = 'get', data?: Record<string, string>): Promise<string> {
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Origin': BASE_URL,
    };

    const cookieStr = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookieStr) headers['Cookie'] = cookieStr;

    let resp;
    if (method === 'get') {
      resp = await this.session.get(url, { headers });
    } else {
      resp = await this.session.post(url, new URLSearchParams(data || {}).toString(), {
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    }

    // Update cookies
    const setCookies = resp.headers['set-cookie'];
    if (setCookies && Array.isArray(setCookies)) {
      for (const c of setCookies) {
        const [nv] = c.split(';');
        const eq = nv.indexOf('=');
        if (eq > 0) this.cookies[nv.substring(0, eq).trim()] = nv.substring(eq + 1).trim();
      }
    }

    return typeof resp.data === 'string' ? resp.data : String(resp.data);
  }

  private getFormInfos(html: string, formName: string): { actionUrl: string; args: Record<string, string> } {
    const $ = cheerio.load(html);
    const form = $(`form#${formName}`);
    const actionUrl = BASE_URL + decodeURIComponent(form.attr('action') || '');

    const args: Record<string, string> = {};
    form.find('input[type="hidden"]').each((_, el) => {
      const name = $(el).attr('name') || '';
      const value = $(el).attr('value') || '';
      if (name) args[name] = value;
    });

    return { actionUrl, args };
  }

  async fetchCalendar(weeks: number = 2): Promise<AwmMuenchenResult> {
    try {
      // Step 1: Get initial form
      const page1 = await this.request(`${BASE_URL}/entsorgen/abfuhrkalender`);
      let { actionUrl, args } = this.getFormInfos(page1, 'abfuhrkalender');

      // Add address
      args['tx_awmabfuhrkalender_abfuhrkalender[strasse]'] = this.street;
      args['tx_awmabfuhrkalender_abfuhrkalender[hausnummer]'] = this.houseNumber;
      args['tx_awmabfuhrkalender_abfuhrkalender[section]'] = 'address';
      args['tx_awmabfuhrkalender_abfuhrkalender[submitAbfuhrkalender]'] = 'true';

      // Step 2: POST address
      const page2 = await this.request(actionUrl, 'post', args);
      const $page2 = cheerio.load(page2);

      // Check for direct ICS download
      const downloadLinks = $page2('a.downloadics');
      if (downloadLinks.length > 0) {
        return await this.downloadIcs($page2, downloadLinks, weeks);
      }

      // Step 3: Check for location ID selection
      const rLocationSelect = $page2('select#tx_awmabfuhrkalender_abfuhrkalender\\[stellplatz\\]\\[restmuell\\]');
      const bLocationSelect = $page2('select#tx_awmabfuhrkalender_abfuhrkalender\\[stellplatz\\]\\[bio\\]');
      const pLocationSelect = $page2('select#tx_awmabfuhrkalender_abfuhrkalender\\[stellplatz\\]\\[papier\\]');

      if (rLocationSelect.length || bLocationSelect.length || pLocationSelect.length) {
        // Auto-select first option for each
        if (rLocationSelect.length) {
          const firstOption = rLocationSelect.find('option').first().val();
          if (firstOption) args['tx_awmabfuhrkalender_abfuhrkalender[stellplatz][restmuell]'] = String(firstOption);
        }
        if (bLocationSelect.length) {
          const firstOption = bLocationSelect.find('option').first().val();
          if (firstOption) args['tx_awmabfuhrkalender_abfuhrkalender[stellplatz][bio]'] = String(firstOption);
        }
        if (pLocationSelect.length) {
          const firstOption = pLocationSelect.find('option').first().val();
          if (firstOption) args['tx_awmabfuhrkalender_abfuhrkalender[stellplatz][papier]'] = String(firstOption);
        }

        const formInfos2 = this.getFormInfos(page2, 'abfuhrkalender');
        actionUrl = formInfos2.actionUrl;
        args = { ...args, ...formInfos2.args };

        const page3 = await this.request(actionUrl, 'post', args);
        const $page3 = cheerio.load(page3);

        const downloadLinks3 = $page3('a.downloadics');
        if (downloadLinks3.length > 0) {
          return await this.downloadIcs($page3, downloadLinks3, weeks);
        }

        // Step 4: Check for collection cycle selection
        const rCycleSelect = $page3('select[name="tx_awmabfuhrkalender_abfuhrkalender[leerungszyklus][R]"]');
        const bCycleSelect = $page3('select[name="tx_awmabfuhrkalender_abfuhrkalender[leerungszyklus][B]"]');
        const pCycleSelect = $page3('select[name="tx_awmabfuhrkalender_abfuhrkalender[leerungszyklus][P]"]');

        if (rCycleSelect.length || bCycleSelect.length || pCycleSelect.length) {
          if (rCycleSelect.length) {
            const firstOption = rCycleSelect.find('option').first().val();
            if (firstOption) args['tx_awmabfuhrkalender_abfuhrkalender[leerungszyklus][R]'] = String(firstOption);
          }
          if (bCycleSelect.length) {
            const firstOption = bCycleSelect.find('option').first().val();
            if (firstOption) args['tx_awmabfuhrkalender_abfuhrkalender[leerungszyklus][B]'] = String(firstOption);
          }
          if (pCycleSelect.length) {
            const firstOption = pCycleSelect.find('option').first().val();
            if (firstOption) args['tx_awmabfuhrkalender_abfuhrkalender[leerungszyklus][P]'] = String(firstOption);
          }

          const formInfos3 = this.getFormInfos(page3, 'abfuhrkalender');
          actionUrl = formInfos3.actionUrl;
          args = { ...args, ...formInfos3.args };

          const page4 = await this.request(actionUrl, 'post', args);
          const $page4 = cheerio.load(page4);

          const downloadLinks4 = $page4('a.downloadics');
          if (downloadLinks4.length > 0) {
            return await this.downloadIcs($page4, downloadLinks4, weeks);
          }
        }
      }

      return { status: 'error', events: [], message: 'ICS-Download-Link nicht gefunden' };
    } catch (error: any) {
      logger.error(`AWM München error: ${error.message}`);
      return { status: 'error', events: [], message: error.message };
    }
  }

  private async downloadIcs($: cheerio.CheerioAPI, links: any, weeks: number): Promise<AwmMuenchenResult> {
    const events: IcsEvent[] = [];

    for (const link of links.toArray()) {
      const href = $(link).attr('href');
      if (href) {
        const icsUrl = BASE_URL + decodeURIComponent(href);
        const icsResp = await this.request(icsUrl);
        const parsed = parseIcsCalendar(icsResp);

        const cutoffMs = Date.now() + weeks * 7 * 24 * 60 * 60 * 1000;
        for (const e of parsed.events) {
          const t = Date.parse(e.start);
          if (isFinite(t) && t <= cutoffMs) {
            // Clean up summary (remove "Achtung:" prefix)
            const summary = (e.summary || '').replace('Achtung:', '').trim();
            events.push({ ...e, summary });
          }
        }
      }
    }

    logger.info(`AWM München: ${events.length} Events für ${this.street} ${this.houseNumber}`);

    return {
      status: 'ok',
      events,
      city: 'München',
      source: 'AWM München',
    };
  }
}
