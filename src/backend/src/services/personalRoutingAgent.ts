import raptorService from './raptorService';
import { logger } from '../utils/logger';

export interface PersonalPreferences {
  preferFewerTransfers: boolean;
  preferShorterWalk: boolean;
  wheelchairAccessible: boolean;
  preferQuiet: boolean;
  preferScenic: boolean;
}

export async function personalRoutePlanning(
  userRequest: string,
  origin: string,
  destination: string
): Promise<any[]> {
  if (!raptorService.isReady()) {
    logger.warn('Personal Routing: RAPTOR nicht ready');
    return [];
  }

  try {
    const preferences = extractPreferences(userRequest);
    const routes = await raptorService.findJourneys(origin, destination, new Date());

    if (routes.length === 0) return [];

    const ranked = rankRoutes(routes, preferences);
    return ranked.slice(0, 3);
  } catch (error: any) {
    logger.error('Personal route planning failed', error);
    return raptorService.findJourneys(origin, destination, new Date());
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

function rankRoutes(routes: any[], prefs: PersonalPreferences): any[] {
  return routes
    .map((route) => {
      let score = 0;
      const legs = route.legs || [];
      const transfers = legs.length - 1;
      const walkDistance = legs
        .filter((l: any) => l.mode === 'walk' || l.mode === 'foot')
        .reduce((sum: number, l: any) => sum + (l.distance || l.duration || 0), 0);

      if (prefs.preferFewerTransfers) {
        score += Math.max(0, 10 - transfers * 3);
      }
      if (prefs.preferShorterWalk) {
        score += Math.max(0, 10 - (walkDistance / 100) * 2);
      }
      if (prefs.wheelchairAccessible) {
        score += legs.some((l: any) => l.mode === 'bus' || l.mode === 'tram') ? 5 : 0;
      }
      if (prefs.preferQuiet) {
        score += legs.every((l: any) => l.mode !== 'bus') ? 3 : 0;
      }
      if (prefs.preferScenic) {
        score += legs.some((l: any) => l.mode === 'tram' || l.mode === 'walk') ? 2 : 0;
      }

      score += Math.max(0, 10 - transfers * 2);
      score += Math.max(0, 10 - (route.duration || 0) / 60 / 10);

      return { ...route, _score: score };
    })
    .sort((a: any, b: any) => b._score - a._score);
}
