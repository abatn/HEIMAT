import { logger } from '../utils/logger';

export interface Disruption {
  affected_stops: string[];
  affected_lines: string[];
  timeframe: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  alternatives: string[];
}

export async function analyzeDisruptions(alerts: string[]): Promise<Disruption[]> {
  if (alerts.length === 0) return [];

  return alerts.map(parseAlert).filter((d): d is Disruption => d !== null);
}

function parseAlert(text: string): Disruption | null {
  if (!text || text.length < 10) return null;

  const lower = text.toLowerCase();

  const lines: string[] = [];
  const lineMatches = lower.match(/\b([usb]\d{1,2})\b/gi);
  if (lineMatches) {
    lines.push(...new Set(lineMatches.map((l: string) => l.toUpperCase())));
  }

  const stopMatches = text.match(/(?:Haltestelle|Station|Bahnhof|Halt)\s+([A-Za-zäöüßÄÖÜ\s-]+?)(?=[,.]|$)/g);
  const stops: string[] = [];
  if (stopMatches) {
    for (const m of stopMatches) {
      const name = m.replace(/^(?:Haltestelle|Station|Bahnhof|Halt)\s+/i, '').trim();
      if (name.length > 1) stops.push(name);
    }
  }

  const timeMatch = lower.match(
    /(?:vom|ab|seit)\s+(\d{1,2}\.\d{1,2}\.\d{2,4}\s*\d{0,2}[:.]?\d{0,2})/i
  );
  let timeframe = '';
  if (timeMatch) {
    timeframe = timeMatch[1];
  } else {
    const simpleTime = lower.match(/(\d{1,2})[:.](\d{2})\s*(?:uhr)?/);
    if (simpleTime) timeframe = `${simpleTime[1]}:${simpleTime[2]} Uhr`;
  }

  let severity: 'high' | 'medium' | 'low' = 'medium';
  if (/\b(sperrung|ausfall|streik|vollausfall|notbetrieb)\b/i.test(text)) {
    severity = 'high';
  } else if (/\b(verspätung|verzögerung|störung|beeinträchtigung)\b/i.test(text)) {
    severity = 'medium';
  } else if (/\b(umleitung|info|hinweis|änderung)\b/i.test(text)) {
    severity = 'low';
  }

  return {
    affected_stops: stops,
    affected_lines: lines,
    timeframe,
    severity,
    description: text.substring(0, 500),
    alternatives: [],
  };
}

export async function getDisruptionsFromTransitous(): Promise<string[]> {
  try {
    const response = await fetch('https://api.transitous.org/api/v1/alerts', {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return [];
    const data: any = await response.json();
    return data.alerts?.map((a: any) => a.description).filter(Boolean) || [];
  } catch (error: any) {
    logger.warn('Transitous alerts fetch failed', error);
    return [];
  }
}
