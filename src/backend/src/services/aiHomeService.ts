import { logger } from '../utils/logger';
import { classifyIntent } from './aiService';

// ---------------------------------------------------------------------------
// AI Home Dashboard Service — liefert kontextualisierte Dashboard-Daten
// ---------------------------------------------------------------------------

export interface DashboardContext {
  /** Tageszeit: morning / afternoon / evening / night */
  timeOfDay: string;
  /** Deutsche Begrüßung */
  greeting: string;
  /** Wochentag (0=So … 6=Sa) */
  dayOfWeek: number;
  /** Ist Wochenende? */
  isWeekend: boolean;
  /** AI-Vorschläge basierend auf Tageszeit/Wochentag */
  suggestions: Suggestion[];
  /** Quick-Actions die dem User angezeigt werden */
  quickActions: QuickAction[];
}

export interface Suggestion {
  icon: string;
  title: string;
  description: string;
  /** Service-Typ an den die Aktion weiterleitet */
  actionType: 'mobility' | 'finance' | 'health' | 'weather' | 'home';
  actionLabel: string;
}

export interface QuickAction {
  icon: string;
  label: string;
  actionType: 'mobility' | 'finance' | 'health' | 'home';
  /** Optional: Route-Name für die Navigation */
  route?: string;
}

function getTimeOfDay(): { timeOfDay: string; greeting: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return { timeOfDay: 'morning', greeting: 'Guten Morgen' };
  } else if (hour >= 12 && hour < 17) {
    return { timeOfDay: 'afternoon', greeting: 'Guten Tag' };
  } else if (hour >= 17 && hour < 22) {
    return { timeOfDay: 'evening', greeting: 'Guten Abend' };
  } else {
    return { timeOfDay: 'night', greeting: 'Gute Nacht' };
  }
}

function getDayContext(): { dayOfWeek: number; isWeekend: boolean } {
  const day = new Date().getDay();
  return { dayOfWeek: day, isWeekend: day === 0 || day === 6 };
}

function getSuggestions(timeOfDay: string, isWeekend: boolean): Suggestion[] {
  const suggestions: Suggestion[] = [];

  if (isWeekend) {
    suggestions.push({
      icon: '🎪',
      title: 'Wochenend-Ausflug',
      description: 'Perfekt für einen Ausflug! Prüfe Verbindungen und das Wetter.',
      actionType: 'mobility',
      actionLabel: 'Route planen',
    });
    suggestions.push({
      icon: '🌤️',
      title: 'Wetter-Check',
      description: 'Sieh nach ob das Wochenend-Wetter mitspielt.',
      actionType: 'weather',
      actionLabel: 'Wetter ansehen',
    });
  } else if (timeOfDay === 'morning') {
    suggestions.push({
      icon: '🚇',
      title: 'Pendler-Info',
      description: 'Prüfe deine Pendler-Route auf Verspätungen und Störungen.',
      actionType: 'mobility',
      actionLabel: 'Abfahrten prüfen',
    });
    suggestions.push({
      icon: '📅',
      title: 'Heutiger Tag',
      description: 'Ein guter Tag für Arzttermine oder neue Verbindungen zu entdecken.',
      actionType: 'home',
      actionLabel: 'Zum Dashboard',
    });
  } else if (timeOfDay === 'afternoon') {
    suggestions.push({
      icon: '💰',
      title: 'KUDOS-Bilanz',
      description: 'Mittagszeit für eine schnelle Finanz-Übersicht.',
      actionType: 'finance',
      actionLabel: 'Zum Wallet',
    });
    suggestions.push({
      icon: '🥗',
      title: 'Mittagspause',
      description: 'Finde Restaurants und Orte in deiner Nähe.',
      actionType: 'mobility',
      actionLabel: 'In der Nähe',
    });
  } else {
    // evening / night
    suggestions.push({
      icon: '🏥',
      title: 'Arzttermine',
      description: 'Morgen früh einen Arzttermin planen oder für die nächste Woche vorsorgen.',
      actionType: 'health',
      actionLabel: 'Ärzte suchen',
    });
    suggestions.push({
      icon: '🌙',
      title: 'Feierabend',
      description: 'Entspanne und plane deine morgige Route.',
      actionType: 'mobility',
      actionLabel: 'Route planen',
    });
  }

  return suggestions;
}

function getQuickActions(): QuickAction[] {
  return [
    { icon: '🚇', label: 'Route', actionType: 'mobility', route: 'mobility' },
    { icon: '🏥', label: 'Arzt', actionType: 'health', route: 'health' },
    { icon: '💰', label: 'KUDOS', actionType: 'finance', route: 'finance' },
    { icon: '📍', label: 'Nähe', actionType: 'mobility', route: 'nearby' },
  ];
}

/**
 * Generiert den Dashboard-Context für die AI-Startseite.
 * Diese Daten werden im Backend pro Request berechnet (stateless).
 */
export function getDashboardContext(): DashboardContext {
  const { timeOfDay, greeting } = getTimeOfDay();
  const { dayOfWeek, isWeekend } = getDayContext();

  logger.debug(`AI Dashboard: ${greeting}, day=${dayOfWeek}, weekend=${isWeekend}`);

  return {
    timeOfDay,
    greeting,
    dayOfWeek,
    isWeekend,
    suggestions: getSuggestions(timeOfDay, isWeekend),
    quickActions: getQuickActions(),
  };
}

/**
 * Intent-spezifische Vorschläge — aktiviert nur wenn BayesClassifier
 * einen bestimmten User-Intent erkennt.
 */
const intentSuggestions: Record<string, Suggestion[]> = {
  journey: [
    { icon: '🗺️', title: 'Reiseplanung', description: 'Du planst oft Routen — hier sind die aktuell besten Verbindungen.', actionType: 'mobility', actionLabel: 'Route planen' },
    { icon: '🚄', title: 'Fernverkehr', description: 'ICE-Verbindungen ab deinem Standort — prüfe Verspätungen.', actionType: 'mobility', actionLabel: 'Fernverkehr prüfen' },
  ],
  departure: [
    { icon: '🚇', title: 'Nächste Abfahrten', description: 'Du checkst oft Abfahrten — hier sind die aktuellen.', actionType: 'mobility', actionLabel: 'Abfahrten' },
    { icon: '⏱️', title: 'Echtzeit-Status', description: 'Live-Verspätungen deiner letzten Linien.', actionType: 'mobility', actionLabel: 'Echtzeit prüfen' },
  ],
  disruption: [
    { icon: '⚠️', title: 'Störungsalarm', description: 'Aktuelle Störungen auf deinen Strecken — bleib informiert!', actionType: 'mobility', actionLabel: 'Störungen anzeigen' },
  ],
  nearby: [
    { icon: '📍', title: 'In deiner Nähe', description: 'Du suchst oft nach Dingen in der Nähe — hier sind Haltestellen und Ärzte um dich herum.', actionType: 'mobility', actionLabel: 'Nähe erkunden' },
    { icon: '🏥', title: 'Ärzte um die Ecke', description: 'Ärzte und Praxen in deiner Nähe.', actionType: 'health', actionLabel: 'Ärzte suchen' },
  ],
  info: [
    { icon: '💡', title: 'HEIMAT-Tipps', description: 'Wusstest du schon? HEIMAT kann mehr — entdecke alle Funktionen.', actionType: 'home', actionLabel: 'Entdecken' },
  ],
};

/** Intent-spezifische Quick-Actions */
const intentQuickActions: Record<string, QuickAction[]> = {
  journey: [
    { icon: '🗺️', label: 'Route', actionType: 'mobility' },
    { icon: '📍', label: 'Ziele', actionType: 'mobility' },
  ],
  departure: [
    { icon: '🚇', label: 'Abfahrten', actionType: 'mobility' },
    { icon: '⏱️', label: 'Echtzeit', actionType: 'mobility' },
  ],
  disruption: [
    { icon: '⚠️', label: 'Störungen', actionType: 'mobility' },
    { icon: '🔄', label: 'Alternativ', actionType: 'mobility' },
  ],
  nearby: [
    { icon: '📍', label: 'Nähe', actionType: 'mobility' },
    { icon: '🏥', label: 'Ärzte', actionType: 'health' },
  ],
  info: [
    { icon: '💡', label: 'Tipps', actionType: 'home' },
    { icon: '❓', label: 'Hilfe', actionType: 'home' },
  ],
};

/**
 * Personalisierter Dashboard-Context — nutzt BayesClassifier aus aiService.ts
 * um User-Intents aus aktuellen Aktionen zu erkennen und die Vorschläge
 * entsprechend anzupassen.
 *
 * @param recentActions Liste der letzten User-Aktionen (z.B. "route geplant", "arzt gesucht")
 */
export function getPersonalizedContext(recentActions: string[]): DashboardContext {
  const base = getDashboardContext();

  if (!recentActions || recentActions.length === 0) {
    return base;
  }

  // Jede Aktion durch den BayesClassifier schicken und Intents sammeln
  const intentCounts: Record<string, number> = {};
  for (const action of recentActions) {
    const intent = classifyIntent(action);
    if (intent && intent.type) {
      intentCounts[intent.type] = (intentCounts[intent.type] || 0) + 1;
    }
  }

  // Dominantesten Intent ermitteln
  let dominantIntent: string | null = null;
  let maxCount = 0;
  for (const [intent, count] of Object.entries(intentCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantIntent = intent;
    }
  }

  if (!dominantIntent || maxCount === 0) {
    return base;
  }

  // Personalisierte Vorschläge: Zeit-basierte + Intent-spezifische Vorschläge mischen
  const timeSuggestions = getSuggestions(base.timeOfDay, base.isWeekend);
  const intentSpecific = intentSuggestions[dominantIntent];

  const personalizedSuggestions: Suggestion[] = [];

  // Intent-spezifische Vorschläge zuerst (sind relevanter)
  if (intentSpecific) {
    // Maximale 2 Intent-Vorschläge nehmen (wenn vorhanden)
    // Markiere sie als personalisiert via actionType=home + speziellem Titel
    personalizedSuggestions.push(...intentSpecific.slice(0, 2));
  }

  // Zeit-basierte Vorschläge danach (aber nicht duplizieren)
  for (const ts of timeSuggestions) {
    if (!personalizedSuggestions.some(s => s.title === ts.title)) {
      personalizedSuggestions.push(ts);
    }
  }

  // Personalisierte Quick-Actions
  const personalizedQuickActions = intentQuickActions[dominantIntent] || getQuickActions();

  logger.info(
    `AI Dashboard personalized: dominantIntent=${dominantIntent} ` +
    `(${maxCount}/${recentActions.length} actions), ` +
    `${personalizedSuggestions.length} suggestions`
  );

  return {
    ...base,
    suggestions: personalizedSuggestions,
    quickActions: personalizedQuickActions,
  };
}
