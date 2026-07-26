import { logger } from '../utils/logger';

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
 * Zukünftig: Personalisierung via User-Profile + Nutzungsstatistiken.
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
