import { logger } from '../utils/logger';

// @ts-ignore - natural package has incomplete TS types
import BayesClassifier from 'natural/lib/natural/classifiers/bayes_classifier';
// @ts-ignore - natural package has incomplete TS types
import PorterStemmerDe from 'natural/lib/natural/stemmers/porter_stemmer_de';

export interface UserIntent {
  type: 'journey' | 'departure' | 'disruption' | 'nearby' | 'info';
  origin?: string;
  destination?: string;
  time?: string;
  lines?: string[];
  preferences?: string[];
}

let classifier: any = null;
let trained = false;

function trainClassifier(): void {
  classifier = new BayesClassifier(PorterStemmerDe);

  const add = (docs: string[], intent: string) => {
    for (const d of docs) classifier.addDocument(d.toLowerCase(), intent);
  };

  add([
    'ich möchte von a nach b',
    'wie komme ich zum hauptbahnhof',
    'verbindung von berlin nach hamburg',
    'route zum flughafen',
    'wie lange brauche ich nach münchen',
    'nächste verbindung nach stuttgart',
    'fahrplan von kreuzberg nach mitte',
    'ich will nach köln reisen',
    'verbindungssuche',
    'wie komme ich von hier zum zoo',
    'route von a nach b',
    'ich brauche eine verbindung',
    'von berlin nach münchen',
    'verbindung von a nach b',
  ], 'journey');

  add([
    'wann fährt die nächste bahn',
    'abfahrtszeiten u2',
    'wann kommt der bus',
    'nächste abfahrt',
    'abfahrten am alexanderplatz',
    'fahrplan u-bahn',
    'wann fährt die s1 ab',
    'abfahrtszeiten',
    'wann geht der nächste zug',
    'abfahrt s-bahn',
    'abfahrt bus 100',
    'fahrplan',
    'abfahrtszeit u2',
    'abfahrt u2',
    'wann fährt u2',
    'fahrplan der u2',
    'wann geht u2',
    'abfahrtszeiten der s1',
  ], 'departure');

  add([
    'gibt es störungen',
    'warum fährt die bahn nicht',
    'verspätung',
    'ausfall u2',
    'bauarbeiten',
    'streik aktuell',
    'störungsmeldung',
    'sperrung',
    'zug ausgefallen',
    'störung auf der linie',
    'verkehrsstörung',
    'baustelle',
    'störung u2',
    'störung s1',
    'u2 ausgefallen',
    's1 hat verspätung',
    'u1 fällt aus',
    'bus 100 fällt aus',
    'sperrung u2',
    'bauarbeiten u2',
  ], 'disruption');

  add([
    'haltestellen in der nähe',
    'was ist hier in der nähe',
    'nächste station',
    'bus in der nähe',
    'wo ist die nächste haltestelle',
    'haltestelle um die ecke',
    'nächstgelegene station',
    'haltestelle suchen',
    'station in der nähe',
    'nahverkehr in der nähe',
  ], 'nearby');

  add([
    'hilfe',
    'was kann die app',
    'wie funktioniert das',
    'was ist heimat',
    'erklärung',
    'info',
    'was sind meine möglichkeiten',
    'wie benutze ich die app',
    'funktionen der app',
    'was kann ich hier machen',
    'erklärung der app',
    'hilfe zur app',
    'anleitung',
  ], 'info');

  classifier.train();
  trained = true;
  logger.info('Intent-Classifier trainiert (natural BayesClassifier, de)');
}

export function classifyIntent(userMessage: string): UserIntent | null {
  if (!trained) trainClassifier();

  try {
    const label = classifier.classify(userMessage.toLowerCase());
    const classifications = classifier.getClassifications(userMessage.toLowerCase());

    logger.debug(
      `Intent: "${userMessage}" → ${label} (best: ${(classifications[0]?.value * 100).toFixed(1)}%)`
    );

    const intent: UserIntent = { type: label as UserIntent['type'] };
    const lower = userMessage.toLowerCase();

    const nachMatch = lower.match(/(?:nach|zum|zur)\s+([a-zäöüß][a-zäöüß\s-]{1,30}?)(?:\s|$)/i);
    if (nachMatch) intent.destination = nachMatch[1].trim();

    const vonMatch = lower.match(
      /(?:von|ab)\s+([a-zäöüß][a-zäöüß\s-]{1,30}?)(?:\s+(?:nach|zum|zur)|$)/i
    );
    if (vonMatch) intent.origin = vonMatch[1].trim();

    const lineMatches = lower.match(/\b([usb]\d{1,2})\b/gi);
    if (lineMatches) intent.lines = [...new Set(lineMatches.map((l: string) => l.toUpperCase()))];

    const timeMatch = lower.match(/(\d{1,2})[:.](\d{2})\s*(?:uhr)?/);
    if (timeMatch) intent.time = `${timeMatch[1]}:${timeMatch[2]}`;

    return intent;
  } catch (error: any) {
    logger.error('Intent classification failed', error);
    return null;
  }
}
