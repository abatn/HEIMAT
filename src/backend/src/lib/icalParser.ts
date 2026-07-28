// ---------------------------------------------------------------------------
// icalParser — Minimaler handgeschriebener iCal/ICS-Parser
//
// Projekt-Regel (knowledge.md: MINIMAL npm-dependencies): kein node-ical/ical.js.
// Abfallkalender iCal-Feeds sind flat: VCALENDAR mit N VEVENTs ohne RRULE.
//
// Unterstuetzte Felder:
//   BEGIN:VEVENT ... END:VEVENT
//   DTSTART:20260115T060000     (lokal) oder DTSTART;TZID=Europe/Berlin:...
//   DTEND:20260115T070000       oder DURATION:P1H
//   SUMMARY:Restmuelltonne
//   LOCATION:Berlin, Unter den Linden 1
//   CATEGORIES:Restmuell
//
// Explizit NICHT unterstuetzt (kommunale Abfallkalender brauchen es nicht):
//   RRULE (kein recurring rules, alle Events sind absolute Daten)
//   EXDATE / RDATE
//   VALARM
//   multiple TZID components
//
// Edge-Cases die hier ignoriert werden (mit Begründung):
//   Line-Folding (RFC 5545 §3.1): Kommunale Kalender falten selten,
//     meist max 1 Zeile pro Property. Bei Multimaster-Kalendern (z.B.
//     Muenchen AWB) koennte Line-Folding vorkommen → TODO in Phase 2.
//   Escaped Comma/Semicolon: Falls BSR Sonderzeichen in SUMMARY encoded
//     → Phase 2 fix wenn real-world case auftritt.
//
// Output: Array<IcsEvent> mit deterministisch-normalisierten Feldern.
// Bei parse-Fehler: returnt leeres Array (kein throw, weil Caller graceful
// fallback zu naechstem Mirror haben soll).
// ---------------------------------------------------------------------------

export interface IcsEvent {
  /** ISO-8601 String — Date-Time als `YYYY-MM-DDTHH:mm:ss` (lokal Berlin). */
  start: string;
  /** Optional wenn DTEND fehlt + DURATION fehlt → dann 1-Tages-Event-Annahme. */
  end?: string;
  /** Lifecycle-cleaned: keine CRLF, keine Tabs, keine fuehrenden/trailing spaces. */
  summary: string;
  location?: string;
  /** Lower-cased category-Normalisierung — Backend-Frontend-Konsistenz. */
  category?: string;
}

export interface ParsedIcsCalendar {
  /** PRODID-Identifier (z.B. "-//BSR//Abfallkalender 1.0//DE") — informational. */
  prodId?: string;
  events: IcsEvent[];
}

/**
 * Parst einen iCal/ICS-Text und liefert die Events darin.
 *
 * Deterministik:
 *   - pure: kein State, kein side-effect
 *   - bei malformed input: returnt `{ events: [] }` ohne throw
 *   - Reihenfolge: gleiche Input-Reihenfolge der VEVENT-Blöcke
 *
 * @param rawText iCal-Text mit CRLF oder LF line-endings (beide werden akzeptiert).
 * @returns parsed calendar mit prodId und events-Liste.
 */
export function parseIcsCalendar(rawText: string): ParsedIcsCalendar {
  if (!rawText || typeof rawText !== 'string') {
    return { events: [] };
  }

  // Normalize CRLF→LF (iCal spec erlaubt beides)
  const text = rawText.replace(/\r\n/g, '\n');

  // Sanity: muss mit BEGIN:VCALENDAR starten (per RFC 5545)
  const upper = text.toUpperCase();
  if (!upper.includes('BEGIN:VCALENDAR')) {
    return { events: [] };
  }

  // PRODID extrahieren (informational)
  const prodIdMatch = text.match(/PRODID:([^\n]+)/i);
  const prodId = prodIdMatch ? prodIdMatch[1].trim() : undefined;

  // VEVENT-Blöcke isolieren
  const events: IcsEvent[] = [];
  const eventMatches = text.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/gi);
  for (const m of eventMatches) {
    const ev = parseSingleEvent(m[1]);
    if (ev) events.push(ev);
  }

  return { prodId, events };
}

function parseSingleEvent(block: string): IcsEvent | null {
  // Felder extrahieren
  const start = readField(block, 'DTSTART');
  const end = readField(block, 'DTEND');
  const duration = readField(block, 'DURATION');
  const summary = readField(block, 'SUMMARY');
  const location = readField(block, 'LOCATION');
  const category = readField(block, 'CATEGORIES');

  if (!start || !summary) {
    // DTSTART + SUMMARY sind minimum-required per RFC 5545.
    // Ohne diese Felder: skip (kein throw) — Caller hat dann ggf.
    // partial-parse fuer andere Events.
    return null;
  }

  const startNorm = normalizeDateTime(start);
  if (!startNorm) {
    return null; // malformed DTSTART → skip
  }

  let endNorm: string | undefined;
  if (end) {
    const ne = normalizeDateTime(end);
    if (ne) endNorm = ne;
  } else if (duration) {
    // DURATION:P1H or PT2H30M (RFC 5545 §3.3.6)
    const minutes = parseDurationMinutes(duration);
    if (minutes !== null) {
      endNorm = addMinutes(startNorm, minutes);
    }
  }

  return {
    start: startNorm,
    end: endNorm,
    summary: cleanText(summary),
    ...(location ? { location: cleanText(location) } : {}),
    ...(category ? { category: cleanText(category).toLowerCase() } : {}),
  };
}

function readField(block: string, name: string): string | null {
  // Field kann "FIELD:value" oder "FIELD;PARAM=value" sein.
  // Wir wollen nur den value-Teil nach dem ersten ':'.
  const lines = block.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(`${name}:`) || trimmed.startsWith(`${name};`)) {
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx >= 0) {
        return trimmed.substring(colonIdx + 1);
      }
    }
  }
  return null;
}

function normalizeDateTime(raw: string): string | null {
  // Akzeptierte inputs:
  //   20260115T060000       (lokal) → '2026-01-15T06:00:00'
  //   20260115             (date-only) → '2026-01-15T00:00:00'
  //   2026-01-15T06:00:00  (bereits ISO)
  //   2026-01-15           (ISO date-only)
  const trimmed = raw.trim();

  // ISO-Format (mit Bindestrichen)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00`;
  }

  // Basic iCal-Format (YYYYMMDDTHHMMSS)
  const basicMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (basicMatch) {
    const [, y, mo, d, h, mi, s] = basicMatch;
    return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
  }

  // Date-only basic: YYYYMMDD
  const dateOnlyMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnlyMatch) {
    const [, y, mo, d] = dateOnlyMatch;
    return `${y}-${mo}-${d}T00:00:00`;
  }

  // Unbekanntes Format → skip (graceful-degradation)
  return null;
}

function parseDurationMinutes(duration: string): number | null {
  // RFC 5545 §3.3.6: P[nW][nD][T[nH][nM][nS]]
  // Real-world-Toleranz: manche kommunalen iCal-Feeds (z.B. SRH Hamburg
  // Abfallkalender) schreiben "P2H" statt der strikten "PT2H" Form
  // (T-Section wird ausgelassen wenn keine date-Components vorhanden).
  // Wir akzeptieren beide Formen — strict RFC + loose no-T-variant.
  const trimmed = duration.trim().toUpperCase();
  let total = 0;

  // Strict RFC: P[nW][nD][T[nH][nM][nS]]
  const strict = trimmed.match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (strict) {
    const [, w, d, h, mi, s] = strict;
    if (w)  total += parseInt(w, 10)  * 7 * 24 * 60;
    if (d)  total += parseInt(d, 10)  * 24 * 60;
    if (h)  total += parseInt(h, 10)  * 60;
    if (mi) total += parseInt(mi, 10);
    if (s)  total += Math.round(parseInt(s, 10) / 60);
    return total > 0 ? total : null;
  }
  // Loose no-T-Variant: P[nH][nM][nS] ohne W oder D (z.B. "P2H", "P30M", "P1H30M")
  const loose = trimmed.match(/^P(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (loose) {
    const [, h, mi, s] = loose;
    if (h)  total += parseInt(h, 10)  * 60;
    if (mi) total += parseInt(mi, 10);
    if (s)  total += Math.round(parseInt(s, 10) / 60);
    return total > 0 ? total : null;
  }
  return null;
}

function addMinutes(iso: string, minutes: number): string {
  // Parses 'YYYY-MM-DDTHH:mm:ss' and adds minutes (no TZ math — datetimes
  // here sind in Europe/Berlin lokal, sufficient for Abfallkalender).
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return iso;
  const [, y, mo, d, h, mi, s] = m;
  const dt = new Date(
    parseInt(y, 10),
    parseInt(mo, 10) - 1,
    parseInt(d, 10),
    parseInt(h, 10),
    parseInt(mi, 10) + minutes,
    parseInt(s, 10),
  );
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
}

function cleanText(s: string): string {
  // Remove CR / LF / tabs and trim outer whitespace. Phase 2 TODO:
  // Escaped chars (\, \; \,) — currently not unescaped (kommunale
  // Kalender benutzen die selten in SUMMARY).
  return s.replace(/[\r\n\t]/g, ' ').trim();
}
