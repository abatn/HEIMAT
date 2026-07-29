// ---------------------------------------------------------------------------
// promptService.ts — Phase AI-3 Service-Prompts
//
// Liefert natürliche, deutsche Erklärungen für alle HEIMAT-Services:
//   - Wetter:   "In Berlin sind es aktuell 22°C und teilweise bewölkt..."
//   - Luft:     "Der AQI ist 15 (Sehr gut). PM2.5=7.8, PM10=11.3..."
//   - Abfall:   "Nächste Abfuhr: Restmüll am 15.08.2026..."
//
// KEIN Ollama-Call — alle Texte werden aus Templates generiert.
// Das hält die Latenz bei <50ms (vs 1-5s bei Ollama) und funktioniert
// auch wenn Ollama offline ist.
//
// Architektur-Mirror zu weatherService.ts / airQualityService.ts:
// - Ruft die Service-Singletons direkt auf (kein axios-Doppel)
// - Einfache {placeholder}-Template-Engine (kein npm-dep)
// - Jeder Service hat genau ein Template + fill()-Funktion
// ---------------------------------------------------------------------------

import { weatherService, type WeatherData } from './weatherService';
import { airQualityService, type AirQualityData } from './airQualityService';
import { WasteService } from './wasteService';
import axios from 'axios';

// WasteService hat keinen Module-Level-Singleton (benötigt axios im Constructor).
// Erzeuge einen für promptService (analog zu weatherService + airQualityService).
const wasteService = new WasteService(axios);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ServiceName = 'weather' | 'air' | 'waste' | 'job' | 'events' | 'hotels' | 'buergeramt';

export interface ServicePromptResult {
  service: ServiceName;
  text: string;
  data?: Record<string, unknown>;
  fetchedAt: string;
}

/** ServiceContext — Beschreibt welche Services mit welchen Parametern
 *  in den Chat-Kontext eingebunden werden sollen (Phase AI-4).
 *  Mobile App sendet dieses Objekt an POST /api/ai/chat mit.
 */
export interface ServiceContext {
  weather?: { lat: number; lng: number };
  air?: { lat: number; lng: number };
  waste?: { lat: number; lng: number; street?: string; houseNr?: string };
  job?: { query?: string; location?: string };
  events?: { location?: string; date?: string };
  hotels?: { city?: string; budget?: number; checkin?: string; checkout?: string };
  buergeramt?: { location?: string; service?: string };
}

// ---------------------------------------------------------------------------
// Template-Engine: simple {placeholder} replacement
// ---------------------------------------------------------------------------

function fillTemplate(template: string, values: Record<string, string | number | null | undefined>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    const strValue = value?.toString() ?? '';
    result = result.replaceAll(`{${key}}`, strValue);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Weather-Tipp-Generator (Regeln ohne Ollama)
// ---------------------------------------------------------------------------

function weatherTip(temp: number, weatherCode: number, windSpeed: number, precipitation: number): string {
  const tips: string[] = [];

  if (precipitation > 5) tips.push('Nimm einen Regenschirm mit');
  else if (precipitation > 1) tips.push('Ein Regenschirm könnte nicht schaden');

  if (temp < 5) tips.push('Zieh dich warm an — es ist eisig kalt');
  else if (temp < 12) tips.push('Eine Jacke ist heute empfehlenswert');
  else if (temp > 30) tips.push('Trink genug Wasser und such Schatten');

  if (windSpeed > 50) tips.push('Stürmisch! Achte auf herabfallende Äste');
  else if (windSpeed > 30) tips.push('Es ist windig — halt deine Mütze fest');

  if (weatherCode >= 95) tips.push('Gewittergefahr! Bleib wenn möglich drinnen');

  if (tips.length === 0) {
    if (temp > 20 && weatherCode <= 2) tips.push('Perfektes Wetter für einen Spaziergang');
    else tips.push('Angenehmes Wetter heute');
  }

  // Nur den relevantesten Tipp zurückgeben
  return tips[0] ?? '';
}

// ---------------------------------------------------------------------------
// Weather-Prompt
// ---------------------------------------------------------------------------

const WEATHER_TEMPLATE =
  'In {location} sind es aktuell {temp}°C und {condition}. ' +
  'Die Höchsttemperatur liegt bei {temp_max}°C, die Tiefsttemperatur bei {temp_min}°C. ' +
  'Der Wind weht mit {wind} km/h. ' +
  'Tipp: {tip}';

function buildWeatherPrompt(data: WeatherData): string {
  const c = data.current;
  const today = data.daily?.[0];
  return fillTemplate(WEATHER_TEMPLATE, {
    location: data.location.name,
    temp: Math.round(c.temperature),
    condition: c.weatherText.toLowerCase(),
    temp_max: today ? Math.round(today.temperatureMax) : Math.round(c.temperature),
    temp_min: today ? Math.round(today.temperatureMin) : Math.round(c.temperature),
    wind: Math.round(c.windSpeed),
    tip: weatherTip(c.temperature, c.weatherCode, c.windSpeed, c.precipitation),
  });
}

// ---------------------------------------------------------------------------
// Air Quality-Prompt
// ---------------------------------------------------------------------------

const AIR_TEMPLATE =
  'Der Europäische Luftqualitätsindex (EAQI) liegt bei {aqi} ({level}). ' +
  'Feinstaub (PM2.5): {pm25} µg/m³, Feinstaub (PM10): {pm10} µg/m³, ' +
  'Stickstoffdioxid: {no2} µg/m³, Ozon: {o3} µg/m³. ' +
  'Sport-Tipp: {sport_tipp}';

function sportTip(aqi: number | null): string {
  if (aqi === null || aqi === undefined) return 'Daten nicht verfügbar.';
  if (aqi < 20) return 'Heute ist ideales Wetter für Sport an der frischen Luft!';
  if (aqi < 40) return 'Gute Bedingungen für Sport, aber nicht übertreiben.';
  if (aqi < 60) return 'Vorsicht bei anstrengendem Sport — die Luftbelastung ist mäßig.';
  if (aqi < 80) return 'Lieber auf intensiven Ausdauersport verzichten. Ein Spaziergang ist okay.';
  return 'Bei dieser Luftqualität besser drinnen trainieren.';
}

function buildAirQualityPrompt(data: AirQualityData): string {
  const c = data.current;
  return fillTemplate(AIR_TEMPLATE, {
    aqi: c.europeanAqi?.toFixed(0) ?? '—',
    level: c.aqiLevel,
    pm25: c.pm25?.toFixed(1) ?? '—',
    pm10: c.pm10?.toFixed(1) ?? '—',
    no2: c.nitrogenDioxide?.toFixed(1) ?? '—',
    o3: c.ozone?.toFixed(0) ?? '—',
    sport_tipp: sportTip(c.europeanAqi),
  });
}

// ---------------------------------------------------------------------------
// Waste-Prompt
// ---------------------------------------------------------------------------

const WASTE_TEMPLATE =
  '{waste_text}';

// Monatsnamen deutsch
const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return `${d.getDate()}. ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function wasteCategoryTip(category: string | undefined): string {
  const map: Record<string, string> = {
    restmüll: 'Restmüll wird verbrannt — gehört in die graue/schwarze Tonne',
    restmuell: 'Restmüll wird verbrannt — gehört in die graue/schwarze Tonne',
    bio: 'Biomüll wird kompostiert — gehört in die braune Tonne',
    biotonne: 'Biomüll wird kompostiert — gehört in die braune Tonne',
    papier: 'Altpapier wird recycelt — gehört in die blaue Tonne',
    papiertonne: 'Altpapier wird recycelt — gehört in die blaue Tonne',
    'gelbe tonne': 'Verpackungen werden sortiert und recycelt — gehört in die gelbe Tonne',
    gelber_sack: 'Verpackungen werden sortiert und recycelt — gehört in den gelben Sack',
    gelbe_tonne: 'Verpackungen werden sortiert und recycelt — gehört in die gelbe Tonne',
    sperrmüll: 'Sperrmüll wird separat abgeholt — muss angemeldet werden',
    sperrmuell: 'Sperrmüll wird separat abgeholt — muss angemeldet werden',
    schadstoff: 'Schadstoffe gehören zum Wertstoffhof — nicht in den Hausmüll',
    weihnachtsbaum: 'Weihnachtsbäume werden eingesammelt und gehäckselt',
    elektronik: 'Elektroschrott gehört zum Wertstoffhof oder Recyclinghof',
  };
  return map[category?.toLowerCase().trim() ?? ''] ?? 'Trenne Müll nach den lokalen Vorschriften';
}

async function buildWastePrompt(lat: number, lng: number, street?: string, houseNr?: string): Promise<string> {
  try {
    const data = await wasteService.getWasteCalendar(lat, lng, 4, street, houseNr);

    if (data.events.length === 0) {
      return `In ${data.displayName} sind in den nächsten 4 Wochen keine Abfuhrtermine bekannt.`;
    }

    const nextEvent = data.events[0];
    const categoryLabel = nextEvent.category ?? 'Unbekannt';
    const tip = wasteCategoryTip(nextEvent.category);
    const dateFormatted = formatDate(nextEvent.start);

    return fillTemplate(WASTE_TEMPLATE, {
      waste_text:
        `Nächste Abfuhr in ${data.displayName}: **${nextEvent.summary}** ` +
        `am ${dateFormatted}. ` +
        `Kategorie: ${categoryLabel}. ${tip}. ` +
        `Es folgen ${data.events.length - 1} weitere Termine in den nächsten 4 Wochen.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Abfallkalender konnte nicht abgerufen werden: ${msg}`;
  }
}

// ---------------------------------------------------------------------------
// Job-Matching Prompt (Template-based, kein Service-Call)
// ---------------------------------------------------------------------------

const JOB_TEMPLATE =
  'Du suchst nach {query} in {location}. ' +
  'Hier sind passende Job-Matches basierend auf deinen Angaben. ' +
  'Ein erfolgreicher Bewerbungsprozess beginnt mit einem guten ' +
  'Anschreiben und einem aktuellen Lebenslauf.';

interface JobPromptOptions {
  query?: string;
  location?: string;
}

function buildJobPrompt(options: JobPromptOptions): string {
  return fillTemplate(JOB_TEMPLATE, {
    query: options.query ?? 'einem Job',
    location: options.location ?? 'Deutschland',
  });
}

// ---------------------------------------------------------------------------
// Events Prompt (Template-based, kein Service-Call)
// ---------------------------------------------------------------------------

const EVENTS_TEMPLATE =
  'Veranstaltungen in {location}: {events_text}. ' +
  'Nutze die Veranstaltungssuche, um aktuelle Events, Konzerte, ' +
  'Ausstellungen und kulturelle Highlights in deiner Nähe zu entdecken.';

interface EventsPromptOptions {
  location?: string;
  date?: string;
}

function buildEventsPrompt(options: EventsPromptOptions): string {
  const eventsText = options.date
    ? `Am ${options.date} finden verschiedene Veranstaltungen statt`
    : 'Es gibt verschiedene interessante Veranstaltungen in deiner Nähe';
  return fillTemplate(EVENTS_TEMPLATE, {
    location: options.location ?? 'deiner Nähe',
    events_text: eventsText,
  });
}

// ---------------------------------------------------------------------------
// Hotels Prompt (Template-based, kein Service-Call)
// ---------------------------------------------------------------------------

const HOTELS_TEMPLATE =
  'Reise nach {city} vom {checkin} bis {checkout}. ' +
  'Budget: {budget}€. {hotels_text}';

interface HotelsPromptOptions {
  city?: string;
  budget?: number;
  checkin?: string;
  checkout?: string;
}

function buildHotelsPrompt(options: HotelsPromptOptions): string {
  const hotelsText = options.budget
    ? `Mit einem Budget von ${options.budget}€ findest du passende Unterkünfte in ${options.city ?? 'deiner Wunschstadt'}`
    : `Es gibt verschiedene Unterkunftsmöglichkeiten in ${options.city ?? 'deiner Wunschstadt'}`;
  return fillTemplate(HOTELS_TEMPLATE, {
    city: options.city ?? 'deiner Wunschstadt',
    checkin: options.checkin ?? '—',
    checkout: options.checkout ?? '—',
    budget: options.budget?.toString() ?? '—',
    hotels_text: hotelsText,
  });
}

// ---------------------------------------------------------------------------
// Bürgeramt Prompt (Template-based, kein Service-Call)
// ---------------------------------------------------------------------------

const BUERGERAMT_TEMPLATE =
  'Bürgeramt {location}: {buergeramt_text} ' +
  'Für eine Terminbuchung nutze bitte die Bürgeramt-Suche.';

interface BuergeramtPromptOptions {
  location?: string;
  service?: string;
}

function buildBuergeramtPrompt(options: BuergeramtPromptOptions): string {
  const text = options.service
    ? `Informationen zum Service "${options.service}" im Bürgeramt`
    : 'Informationen zu Dienstleistungen und Öffnungszeiten des Bürgeramts';
  return fillTemplate(BUERGERAMT_TEMPLATE, {
    location: options.location ?? 'deiner Stadt',
    buergeramt_text: text,
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const promptService = {
  /**
   * Generiert einen natürlichen deutschen Erklärungstext für den angegebenen
   * Service.
   *
   * @param service  Name des Services ('weather', 'air', 'waste')
   * @param lat      Breitengrad (für Wetter + Luft + Abfall)
   * @param lng      Längengrad (für Wetter + Luft + Abfall)
   * @param options  Optional: street + houseNr (nur für waste)
   */
  async getPrompt(
    service: ServiceName,
    lat: number,
    lng: number,
    options?: {
      street?: string;
      houseNr?: string;
      jobQuery?: string;
      jobLocation?: string;
      eventsLocation?: string;
      eventsDate?: string;
      hotelsCity?: string;
      hotelsBudget?: number;
      buergeramtLocation?: string;
      buergeramtService?: string;
    },
  ): Promise<ServicePromptResult> {
    const fetchedAt = new Date().toISOString();

    switch (service) {
      case 'weather': {
        const data = await weatherService.getWeather(lat, lng);
        return {
          service,
          text: buildWeatherPrompt(data),
          data: {
            location: data.location.name,
            temperature: data.current.temperature,
            condition: data.current.weatherText,
            windSpeed: data.current.windSpeed,
          },
          fetchedAt,
        };
      }

      case 'air': {
        const data = await airQualityService.getAirQuality(lat, lng);
        return {
          service,
          text: buildAirQualityPrompt(data),
          data: {
            location: data.location.name,
            aqi: data.current.europeanAqi,
            level: data.current.aqiLevel,
          },
          fetchedAt,
        };
      }

      case 'waste': {
        const text = await buildWastePrompt(lat, lng, options?.street, options?.houseNr);
        return {
          service,
          text,
          data: { lat, lng },
          fetchedAt,
        };
      }

      case 'job': {
        const text = buildJobPrompt({ query: options?.jobQuery, location: options?.jobLocation });
        return {
          service,
          text,
          data: { query: options?.jobQuery, location: options?.jobLocation },
          fetchedAt,
        };
      }

      case 'events': {
        const text = buildEventsPrompt({ location: options?.eventsLocation, date: options?.eventsDate });
        return {
          service,
          text,
          data: { location: options?.eventsLocation, date: options?.eventsDate },
          fetchedAt,
        };
      }

      case 'hotels': {
        const text = buildHotelsPrompt({ city: options?.hotelsCity, budget: options?.hotelsBudget });
        return {
          service,
          text,
          data: { city: options?.hotelsCity, budget: options?.hotelsBudget },
          fetchedAt,
        };
      }

      case 'buergeramt': {
        const text = buildBuergeramtPrompt({ location: options?.buergeramtLocation, service: options?.buergeramtService });
        return {
          service,
          text,
          data: { location: options?.buergeramtLocation, service: options?.buergeramtService },
          fetchedAt,
        };
      }

      default:
        throw new Error(`Unbekannter Service: ${String(service)}`);
    }
  },

  /**
   * fetchServiceContexts — Holt Prompt-Texte für mehrere Services parallel.
   *
   * Zentraler Cross-Service-Context-Fetcher (Phase AI-4): Holt die aktuellen
   * Daten für alle im context-Objekt angegebenen Services parallel via
   * Promise.all. Die Texte werden als System-Prompt-Erweiterung an Ollama
   * übergeben, sodass der AI-Assistent informierte, quervernetzte Antworten
   * geben kann (z.B. "Heute ist Restmüll und es regnet — stell die Tonne
   * unter" statt nur "Heute ist Restmüll").
   *
   * Wenn ein Service fehlschlägt (z.B. Abfall-API offline), wird nur dieser
   * eine Prompt stumm übersprungen — die anderen Services liefern weiter.
   *
   * @param context  Objekt mit service → params Mapping
   * @returns Array von { service, text } für alle erfolgreich geladenen Services
   */
  async fetchServiceContexts(
    context: ServiceContext,
  ): Promise<Array<{ service: ServiceName; text: string }>> {
    const requests: Array<Promise<{ service: ServiceName; text: string } | null>> = [];

    if (context.weather) {
      requests.push(
        this.getPrompt('weather', context.weather.lat, context.weather.lng)
          .then(r => ({ service: r.service as ServiceName, text: r.text }))
          .catch(() => null),
      );
    }

    if (context.air) {
      requests.push(
        this.getPrompt('air', context.air.lat, context.air.lng)
          .then(r => ({ service: r.service as ServiceName, text: r.text }))
          .catch(() => null),
      );
    }

    if (context.waste) {
      requests.push(
        this.getPrompt('waste', context.waste.lat, context.waste.lng, {
          street: context.waste.street,
          houseNr: context.waste.houseNr,
        })
          .then(r => ({ service: r.service as ServiceName, text: r.text }))
          .catch(() => null),
      );
    }

    if (context.job) {
      requests.push(
        this.getPrompt('job', 0, 0, {
          jobQuery: context.job.query,
          jobLocation: context.job.location,
        })
          .then(r => ({ service: r.service as ServiceName, text: r.text }))
          .catch(() => null),
      );
    }

    if (context.events) {
      requests.push(
        this.getPrompt('events', 0, 0, {
          eventsLocation: context.events.location,
          eventsDate: context.events.date,
        })
          .then(r => ({ service: r.service as ServiceName, text: r.text }))
          .catch(() => null),
      );
    }

    if (context.hotels) {
      requests.push(
        this.getPrompt('hotels', 0, 0, {
          hotelsCity: context.hotels.city,
          hotelsBudget: context.hotels.budget,
        })
          .then(r => ({ service: r.service as ServiceName, text: r.text }))
          .catch(() => null),
      );
    }

    if (context.buergeramt) {
      requests.push(
        this.getPrompt('buergeramt', 0, 0, {
          buergeramtLocation: context.buergeramt.location,
          buergeramtService: context.buergeramt.service,
        })
          .then(r => ({ service: r.service as ServiceName, text: r.text }))
          .catch(() => null),
      );
    }

    const results = await Promise.all(requests);
    return results.filter(
      (r): r is { service: ServiceName; text: string } => r !== null,
    );
  },
};
