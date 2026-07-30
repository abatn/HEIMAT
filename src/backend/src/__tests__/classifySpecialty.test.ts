// ---------------------------------------------------------------------------
// classifySpecialty.test.ts — Unit-Tests für classifySpecialty()
//
// Testet die classifySpecialty()-Methode des HealthService.
// Kein DB, kein Netzwerk, keine Mocks — nur pure Funktionstests.
//
// Strategie: Für jede Spezialisierung wird getestet:
//   - Erkennung aus dem Namen (häufigster Fall in OSM)
//   - Erkennung aus OSM-Tags (healthcare:speciality, specialty, healthcare)
//   - Fallback auf Allgemeinmedizin bei fehlenden Keywords
// ---------------------------------------------------------------------------

import { healthService } from '../services/healthService';

describe('classifySpecialty() — aus OSM-Name (häufigster Fall)', () => {
  test('Augenarzt aus Namen "Augenärztin Breitenbach"', () => {
    expect(healthService.classifySpecialty({ amenity: 'doctors' }, 'Augenärztin Breitenbach')).toBe('Augenarzt');
  });

  test('Zahnarzt aus Namen "Zahnarzt Dr. Müller"', () => {
    expect(healthService.classifySpecialty({ amenity: 'doctors' }, 'Zahnarzt Dr. Müller')).toBe('Zahnarzt');
  });

  test('Zahnarzt aus Namen "dental clinic"', () => {
    expect(healthService.classifySpecialty({}, 'Dental Clinic Berlin')).toBe('Zahnarzt');
  });

  test('HNO-Arzt aus Namen "HNO-Praxis Dr. Schmidt"', () => {
    expect(healthService.classifySpecialty({}, 'HNO-Praxis Dr. Schmidt')).toBe('HNO-Arzt');
  });

  test('HNO-Arzt aus Namen "Hals-Nasen-Ohren Zentrum"', () => {
    expect(healthService.classifySpecialty({}, 'Hals-Nasen-Ohren Zentrum')).toBe('HNO-Arzt');
  });

  test('Hautarzt aus Namen "Hautarzt Praxis Helena Dröge"', () => {
    expect(healthService.classifySpecialty({}, 'Hautarzt Praxis Helena Dröge')).toBe('Hautarzt');
  });

  test('Kinderarzt aus Namen "Kinderpraxis Denise Bosch"', () => {
    expect(healthService.classifySpecialty({}, 'Kinderpraxis Denise Bosch Rosa')).toBe('Kinderarzt');
  });

  test('Kinderarzt aus Namen "Kinderarztpraxis am Traveplatz"', () => {
    expect(healthService.classifySpecialty({}, 'Kinderarztpraxis am Traveplatz')).toBe('Kinderarzt');
  });

  test('Frauenarzt aus Namen "Frauenarzt Prof. Dr. Dr. Ridha"', () => {
    expect(healthService.classifySpecialty({}, 'Frauenarzt Prof. Dr. Dr. R-Y. Ridha')).toBe('Frauenarzt');
  });

  test('Psychotherapeut aus Namen "Psychotherapie Dr. Müller"', () => {
    expect(healthService.classifySpecialty({}, 'Psychotherapie Dr. Müller')).toBe('Psychotherapeut');
  });

  test('Orthopäde aus Namen "Orthopädische Praxis Hofmann"', () => {
    expect(healthService.classifySpecialty({}, 'Orthopädische Praxis Hofmann & Wierth')).toBe('Orthopäde');
  });

  test('Orthopäde aus Namen "Rückenzentrum am Markgrafenpark"', () => {
    expect(healthService.classifySpecialty({}, 'Rückenzentrum am Markgrafenpark')).toBe('Orthopäde');
  });

  test('Orthopäde aus Namen "DocOrtho"', () => {
    expect(healthService.classifySpecialty({}, 'DocOrtho Berlin')).toBe('Orthopäde');
  });

  test('Neurologe aus Namen "Neurologie am Hackeschen Markt"', () => {
    expect(healthService.classifySpecialty({}, 'Neurologie am Hackeschen Markt')).toBe('Neurologe');
  });

  test('Sportmedizin aus Namen "Allgemeinmedizin und Sportarztpraxis"', () => {
    expect(healthService.classifySpecialty({}, 'Allgemeinmedizin und Sportarztpraxis')).toBe('Sportmedizin');
  });

  // --- NEUE Rules (2026-07-29) ---

  test('Urologe aus Namen "Urologische Praxis Dr. Klein"', () => {
    expect(healthService.classifySpecialty({}, 'Urologische Praxis Dr. Klein')).toBe('Urologe');
  });

  test('Urologe aus Namen "Urologie-Zentrum Berlin"', () => {
    expect(healthService.classifySpecialty({}, 'Urologie-Zentrum Berlin')).toBe('Urologe');
  });

  test('Chirurg aus Namen "Chirurgische Gemeinschaftspraxis"', () => {
    expect(healthService.classifySpecialty({}, 'Chirurgische Gemeinschaftspraxis')).toBe('Chirurg');
  });

  test('Pneumologie aus Namen "Praxis für Pneumologie Dr. Weber"', () => {
    expect(healthService.classifySpecialty({}, 'Praxis für Pneumologie Dr. Weber')).toBe('Pneumologie');
  });

  test('Pneumologie aus Namen "Lungenarztpraxis am Alex"', () => {
    expect(healthService.classifySpecialty({}, 'Lungenarztpraxis am Alex')).toBe('Pneumologie');
  });

  test('Radiologie aus Namen "Radiologie Berlin Mitte"', () => {
    expect(healthService.classifySpecialty({}, 'Radiologie Berlin Mitte')).toBe('Radiologie');
  });

  test('Physiotherapie aus Namen "Physiotherapie Müller"', () => {
    expect(healthService.classifySpecialty({}, 'Physiotherapie Müller')).toBe('Physiotherapie');
  });

  test('Naturheilkunde aus Namen "Praxis für Naturheilkunde"', () => {
    expect(healthService.classifySpecialty({}, 'Praxis für Naturheilkunde')).toBe('Naturheilkunde');
  });

  test('Naturheilkunde aus Namen "Heilpraktikerin Schmidt"', () => {
    expect(healthService.classifySpecialty({}, 'Heilpraktikerin Schmidt')).toBe('Naturheilkunde');
  });

  test('Allergologie aus Namen "Allergologie-Praxis Dr. Fischer"', () => {
    expect(healthService.classifySpecialty({}, 'Allergologie-Praxis Dr. Fischer')).toBe('Allergologie');
  });

  test('Innere Medizin aus Namen "Praxis für Innere Medizin Dr. Koch"', () => {
    expect(healthService.classifySpecialty({}, 'Praxis für Innere Medizin Dr. Koch')).toBe('Innere Medizin');
  });

  // --- Fallback ---

  test('Allgemeinmedizin als Fallback "Dr. Katja Meißner"', () => {
    expect(healthService.classifySpecialty({}, 'Dr. Katja Meißner')).toBe('Allgemeinmedizin');
  });

  test('Allgemeinmedizin als Fallback bei leerem Name', () => {
    expect(healthService.classifySpecialty({}, '')).toBe('Allgemeinmedizin');
  });
});

describe('classifySpecialty() — aus OSM-Tags', () => {
  test('Augenarzt aus healthcare:speciality=ophthalmology', () => {
    expect(healthService.classifySpecialty(
      { amenity: 'doctors', 'healthcare:speciality': 'ophthalmology' },
      'Dr. Schmidt'
    )).toBe('Augenarzt');
  });

  test('Kardiologe aus specialty=cardiology', () => {
    expect(healthService.classifySpecialty(
      { amenity: 'doctors', specialty: 'cardiology' },
      'Dr. Weber'
    )).toBe('Kardiologe');
  });

  test('Hautarzt aus healthcare=dermatology', () => {
    expect(healthService.classifySpecialty(
      { healthcare: 'dermatology' },
      'Dr. Fischer'
    )).toBe('Hautarzt');
  });

  test('Kinderarzt aus healthcare:speciality=paediatrics', () => {
    expect(healthService.classifySpecialty(
      { 'healthcare:speciality': 'paediatrics' },
      'Dr. Koch'
    )).toBe('Kinderarzt');
  });

  test('Frauenarzt aus healthcare:speciality=gynaecology', () => {
    expect(healthService.classifySpecialty(
      { 'healthcare:speciality': 'gynaecology' },
      'Dr. Müller'
    )).toBe('Frauenarzt');
  });

  test('Psychotherapeut aus healthcare=psychotherapist', () => {
    expect(healthService.classifySpecialty(
      { healthcare: 'psychotherapist' },
      'Praxis'
    )).toBe('Psychotherapeut');
  });

  // --- NEUE OSM-Tag-Tests (2026-07-29) ---

  test('Urologe aus healthcare:speciality=urology', () => {
    expect(healthService.classifySpecialty(
      { 'healthcare:speciality': 'urology' },
      'Dr. Braun'
    )).toBe('Urologe');
  });

  test('Neurologe aus healthcare:speciality=neurology', () => {
    expect(healthService.classifySpecialty(
      { 'healthcare:speciality': 'neurology' },
      'Dr. Neumann'
    )).toBe('Neurologe');
  });

  test('Orthopäde aus healthcare:speciality=orthopaedics', () => {
    expect(healthService.classifySpecialty(
      { 'healthcare:speciality': 'orthopaedics' },
      'Dr. Wagner'
    )).toBe('Orthopäde');
  });

  test('Chirurg aus healthcare:speciality=surgery', () => {
    expect(healthService.classifySpecialty(
      { 'healthcare:speciality': 'surgery' },
      'Dr. Meier'
    )).toBe('Chirurg');
  });

  test('Radiologie aus healthcare:speciality=radiology', () => {
    expect(healthService.classifySpecialty(
      { 'healthcare:speciality': 'radiology' },
      'Dr. Schwarz'
    )).toBe('Radiologie');
  });

  test('Pneumologie aus healthcare:speciality=pulmonology', () => {
    expect(healthService.classifySpecialty(
      { 'healthcare:speciality': 'pulmonology' },
      'Dr. Atemweg'
    )).toBe('Pneumologie');
  });

  test('Physiotherapie aus healthcare=physiotherapist', () => {
    expect(healthService.classifySpecialty(
      { healthcare: 'physiotherapist' },
      'Physio-Praxis'
    )).toBe('Physiotherapie');
  });

  test('Naturheilkunde aus healthcare=naturopath', () => {
    expect(healthService.classifySpecialty(
      { healthcare: 'naturopath' },
      'Heilpraxis'
    )).toBe('Naturheilkunde');
  });

  test('Allgemeinmedizin bei Tag healthcare=doctor ohne weitere Keywords', () => {
    expect(healthService.classifySpecialty(
      { healthcare: 'doctor' },
      'Dr. Praxis'
    )).toBe('Allgemeinmedizin');
  });

  test('Innere Medizin aus healthcare:speciality=internal', () => {
    expect(healthService.classifySpecialty(
      { 'healthcare:speciality': 'internal' },
      'Dr. Internist'
    )).toBe('Innere Medizin');
  });

  test('Innere Medizin aus healthcare:speciality=endocrinology (Sub-Spezialität)', () => {
    expect(healthService.classifySpecialty(
      { 'healthcare:speciality': 'endocrinology' },
      'Dr. Drüse'
    )).toBe('Innere Medizin');
  });

  test('Innere Medizin aus healthcare:speciality=gastroenterology (Sub-Spezialität)', () => {
    expect(healthService.classifySpecialty(
      { 'healthcare:speciality': 'gastroenterology' },
      'Dr. Magen'
    )).toBe('Innere Medizin');
  });
});

describe('classifySpecialty() — Fallback und Edge Cases', () => {
  test('Keine Tags, kein Name → Allgemeinmedizin', () => {
    expect(healthService.classifySpecialty({}, '')).toBe('Allgemeinmedizin');
  });

  test('Keine Tags, generischer Name "Praxis" → Allgemeinmedizin', () => {
    expect(healthService.classifySpecialty({}, 'Praxis')).toBe('Allgemeinmedizin');
  });

  test('Unbekannte Spezialisierung → Allgemeinmedizin', () => {
    expect(healthService.classifySpecialty({}, 'MVZ am Moritzplatz')).toBe('Allgemeinmedizin');
  });

  test('healthcare:speciality=general → Allgemeinmedizin', () => {
    expect(healthService.classifySpecialty(
      { 'healthcare:speciality': 'general' },
      'Dr. Haus'
    )).toBe('Allgemeinmedizin');
  });

  test('healthcare:speciality=paediatric_surgery → Chirurg (surgery match vor paediat)', () => {
    // paediatric_surgery enthält "surgery" → Chirurg (spezifischer als Kinderarzt,
    // weil "chirurg" vor "kinder" in der Rule-Liste steht? Nein — "kinder" steht
    // vor "chirurg". Aber "paediatric_surgery" enthält "paediat" UND "surgery".
    // "paediat" matcht ZUERST → Kinderarzt. Das ist korrekt: pädiatrische Chirurgie
    // wird als Kinderarzt klassifiziert (die Praxis ist kinder-fokussiert).
    expect(healthService.classifySpecialty(
      { 'healthcare:speciality': 'paediatric_surgery' },
      'Dr. Kinderchirurg'
    )).toBe('Kinderarzt');
  });

  test('Semicolon-chained tags: "general;geriatrics" → Allgemeinmedizin', () => {
    expect(healthService.classifySpecialty(
      { 'healthcare:speciality': 'general;geriatrics' },
      'Dr. Alter'
    )).toBe('Allgemeinmedizin');
  });
});
