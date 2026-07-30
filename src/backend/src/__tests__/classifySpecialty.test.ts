// ---------------------------------------------------------------------------
// classifySpecialty.test.ts — Phase X.10c Unit-Tests
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

  test('Chirurg/Orthopäde aus Namen "Chirurgische Praxis Hofmann"', () => {
    expect(healthService.classifySpecialty({}, 'Chirurgische Praxis Hofmann & Wierth')).toBe('Chirurg/Orthopäde');
  });

  test('Chirurg/Orthopäde aus Namen "Rückenzentrum am Markgrafenpark"', () => {
    expect(healthService.classifySpecialty({}, 'Rückenzentrum am Markgrafenpark')).toBe('Chirurg/Orthopäde');
  });

  test('Chirurg/Orthopäde aus Namen "DocOrtho"', () => {
    expect(healthService.classifySpecialty({}, 'DocOrtho Berlin')).toBe('Chirurg/Orthopäde');
  });

  test('Neurologe aus Namen "Neurologie am Hackeschen Markt"', () => {
    expect(healthService.classifySpecialty({}, 'Neurologie am Hackeschen Markt')).toBe('Neurologe');
  });

  test('Sportmedizin aus Namen "Allgemeinmedizin und Sportarztpraxis"', () => {
    expect(healthService.classifySpecialty({}, 'Allgemeinmedizin und Sportarztpraxis')).toBe('Sportmedizin');
  });

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

  test('Allgemeinmedizin bei Tag healthcare=doctor ohne weitere Keywords', () => {
    expect(healthService.classifySpecialty(
      { healthcare: 'doctor' },
      'Dr. Praxis'
    )).toBe('Allgemeinmedizin');
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
});
