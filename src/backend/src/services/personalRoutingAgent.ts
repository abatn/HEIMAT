import raptorService from './raptorService';
import { logger } from '../utils/logger';
import { errorMessage } from '../utils/error';

export interface PersonalPreferences {
  preferFewerTransfers: boolean;
  preferShorterWalk: boolean;
  wheelchairAccessible: boolean;
  preferQuiet: boolean;
  preferScenic: boolean;
}

interface RouteLeg {
  mode: string;
  distance?: number;
  duration?: number;
}

interface Route {
  legs: RouteLeg[];
  duration?: number;
}

interface RankedRoute extends Route {
  score: number;
}

export async function personalRoutePlanning(
  userRequest: string,
  origin: string,
  destination: string
): Promise<RankedRoute[]> {
  if (!raptorService.isReady()) {
    logger.warn('Personal Routing: RAPTOR nicht ready');
    return [];
  }

  try {
    const preferences = extractPreferences(userRequest);
    const routes = (await raptorService.findJourneys(
      origin,
      destination,
      new Date()
    )) as Route[];

    if (routes.length === 0) return [];

    const ranked = rankRoutes(routes, preferences);
    return ranked.slice(0, 3);
  } catch (err: unknown) {
    logger.error(`Personal route planning failed: ${errorMessage(err)}`);
    // Bei Fehler kein Fallback mit raw Routes — lieber leeres Array,
    // damit der Client konsistente RankedRoute[]-Form erhaelt.
    return [];
  }
}

function extractPreferences(userRequest: string): PersonalPreferences {
  const lower = userRequest.toLowerCase();

  return {
    preferFewerTransfers: /\b(wenig(er|stens?)?\s*(umstieg|umsteigen)|direkt|ohne\s*umstieg)\b/i.test(lower),
    preferShorterWalk: /\b(kurz(er|est)?\s*(weg|gehweg|laufweg|distanz)|nah|wenig\s*(gehen|laufen))\b/i.test(lower),
    wheelchairAccessible: /\b(rollstuhl|behindertengerecht|barrierefrei|aufzug|rampe)\b/i.test(lower),
    preferQuiet: /\b(ruhig|leise|nicht\s*voll|wenig\s*los)\b/i.test(lower),
    preferScenic: /\b(schön(er?|st)?\s*(aussicht|route|weg)|sehenswürdigkeit|landschaft)\b/i.test(lower),
  };
}

function rankRoutes(routes: Route[], prefs: PersonalPreferences): RankedRoute[] {
  return routes
    .map((route: Route): RankedRoute => {
      let score = 0;
      const legs: RouteLeg[] = route.legs || [];
      const transfers = legs.length - 1;
      const walkDistance = legs
        .filter((l: RouteLeg) => l.mode === 'walk' || l.mode === 'foot')
        .reduce(
          (sum: number, l: RouteLeg) => sum + (l.distance ?? l.duration ?? 0),
          0
        );

      if (prefs.preferFewerTransfers) {
        score += Math.max(0, 10 - transfers * 3);
      }
      if (prefs.preferShorterWalk) {
        score += Math.max(0, 10 - (walkDistance / 100) * 2);
      }
      if (prefs.wheelchairAccessible) {
        score += legs.some((l: RouteLeg) => l.mode === 'bus' || l.mode === 'tram') ? 5 : 0;
      }
      if (prefs.preferQuiet) {
        score += legs.every((l: RouteLeg) => l.mode !== 'bus') ? 3 : 0;
      }
      if (prefs.preferScenic) {
        score += legs.some((l: RouteLeg) => l.mode === 'tram' || l.mode === 'walk') ? 2 : 0;
      }

      score += Math.max(0, 10 - transfers * 2);
      score += Math.max(0, 10 - (route.duration ?? 0) / 60 / 10);

      return { ...route, score };
    })
    .sort((a: RankedRoute, b: RankedRoute) => b.score - a.score);
}
