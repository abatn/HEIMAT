import { evaluateTriage, formatTriageForPrompt } from '../services/triageRulesService';

describe('triageRulesService.evaluateTriage', () => {
  // === NOTFALL Tests ===
  it('erkennt Brustschmerz als NOTFALL', () => {
    const result = evaluateTriage('Ich habe starke Brustschmerzen seit 30 Minuten');
    expect(result.level).toBe('NOTFALL');
    expect(result.phoneNumber).toBe('112');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('erkennt Atemnot als NOTFALL', () => {
    const result = evaluateTriage('Ich kann nicht mehr atmen, Atemnot');
    expect(result.level).toBe('NOTFALL');
    expect(result.phoneNumber).toBe('112');
  });

  it('erkennt Bewusstlosigkeit als NOTFALL', () => {
    const result = evaluateTriage('Mein Partner ist bewusstlos und reagiert nicht');
    expect(result.level).toBe('NOTFALL');
    expect(result.phoneNumber).toBe('112');
  });

  it('erkennt Schlaganfall als NOTFALL', () => {
    const result = evaluateTriage('Meine Mutter hat halbseitige Lähmung und Sprachstörung');
    expect(result.level).toBe('NOTFALL');
    expect(result.phoneNumber).toBe('112');
  });

  it('erkennt Anaphylaxie als NOTFALL', () => {
    const result = evaluateTriage('Nach Bienenstich Schwellung im Hals und Atemnot');
    expect(result.level).toBe('NOTFALL');
    expect(result.phoneNumber).toBe('112');
  });

  // === BEREITSCHAFT Tests ===
  it('erkennt hohes Fieber als BEREITSCHAFT', () => {
    const result = evaluateTriage('Ich habe Fieber seit 3 Tagen, Temperatur 39.5');
    expect(result.level).toBe('BEREITSCHAFT');
    expect(result.phoneNumber).toBe('116117');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('erkennt starke Kopfschmerzen als BEREITSCHAFT', () => {
    const result = evaluateTriage('Starken Kopfschmerz seit gestern, Schmerzen 8 von 10');
    expect(result.level).toBe('BEREITSCHAFT');
    expect(result.phoneNumber).toBe('116117');
  });

  it('erkennt blutigen Durchfall als BEREITSCHAFT', () => {
    const result = evaluateTriage('Schwerer blutiger Durchfall seit gestern Abend');
    expect(result.level).toBe('BEREITSCHAFT');
    expect(result.phoneNumber).toBe('116117');
  });

  // === ROUTINE Tests ===
  it('erkennt leichte Erkältung als ROUTINE', () => {
    const result = evaluateTriage('Ich habe Schnupfen und Halsschmerzen seit 2 Tagen');
    expect(result.level).toBe('ROUTINE');
    expect(result.phoneNumber).toBe('Hausarzt');
  });

  it('erkennt leichten Hautausschlag als ROUTINE', () => {
    const result = evaluateTriage('Leichter Hautausschlag am Arm, juckt ein wenig');
    expect(result.level).toBe('ROUTINE');
    expect(result.phoneNumber).toBe('Hausarzt');
  });

  // === ICD-11 Code Tests ===
  it('verwendet ICD-11 Code fuer NOTFALL', () => {
    const result = evaluateTriage('Schmerzen in der Brust', ['R07.9']);
    expect(result.level).toBe('NOTFALL');
    expect(result.icdCodes).toContain('R07.9');
  });

  it('verwendet ICD-11 Code fuer BEREITSCHAFT', () => {
    const result = evaluateTriage('Kopfschmerzen', ['R51']);
    expect(result.level).toBe('BEREITSCHAFT');
    expect(result.icdCodes).toContain('R51');
  });

  it('ICD-11 Code hat hoehere Konfidenz als Keywords', () => {
    const resultWithKeywords = evaluateTriage('Kopfschmerzen mild');
    const resultWithICD = evaluateTriage('Kopfschmerzen mild', ['R51']);
    expect(resultWithICD.confidence).toBeGreaterThanOrEqual(resultWithKeywords.confidence);
  });

  // === Edge Cases ===
  it('leerer String ergibt ROUTINE', () => {
    const result = evaluateTriage('');
    expect(result.level).toBe('ROUTINE');
  });

  it('unbekanntes Symptom ergibt ROUTINE', () => {
    const result = evaluateTriage('Mir geht es irgendwie komisch');
    expect(result.level).toBe('ROUTINE');
  });
});

describe('triageRulesService.formatTriageForPrompt', () => {
  it('formatiert NOTFALL korrekt', () => {
    const result = evaluateTriage('Brustschmerz');
    const text = formatTriageForPrompt(result);
    expect(text).toContain('NOTFALL');
    expect(text).toContain('112');
    expect(text).toContain('🔴');
  });

  it('formatiert BEREITSCHAFT korrekt', () => {
    const result = evaluateTriage('Fieber 39.5 Grad');
    const text = formatTriageForPrompt(result);
    expect(text).toContain('BEREITSCHAFT');
    expect(text).toContain('116117');
    expect(text).toContain('🟡');
  });

  it('formatiert ROUTINE korrekt', () => {
    const result = evaluateTriage('Schnupfen');
    const text = formatTriageForPrompt(result);
    expect(text).toContain('ROUTINE');
    expect(text).toContain('🟢');
  });
});
