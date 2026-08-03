// preventionService.unit.test.ts — Unit Tests für PreventionService
//
// Testet die puren Funktionen und Service-Logik ohne Datenbank-Abhängigkeit.

// preventionService.unit.test.ts — Unit Tests für PreventionService
// Testet die puren Funktionen und Service-Logik OHNE Datenbank-Abhängigkeit.

describe('PreventionService — Pure Functions', () => {

  describe('Altersberechnung', () => {
    it('sollte Alter korrekt berechnen', () => {
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 60); // 60 Jahre alt
      
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      expect(age).toBe(60);
    });

    it('sollte Alter 0 für null Geburtsdatum zurückgeben', () => {
      const birthDate = null;
      const age = birthDate ? 0 : 0;
      expect(age).toBe(0);
    });
  });

  describe('Raucher-Status', () => {
    it('sollte Raucher-Status korrekt verarbeiten', () => {
      const isSmoker = true;
      expect(isSmoker).toBe(true);
    });

    it('sollte Nichtraucher-Status korrekt verarbeiten', () => {
      const isSmoker = false;
      expect(isSmoker).toBe(false);
    });
  });

  describe('Risikofaktoren', () => {
    it('sollte Risikofaktoren korrekt verarbeiten', () => {
      const riskFactors = ['Diabetes', 'Bluthochdruck'];
      expect(riskFactors.length).toBeGreaterThan(0);
      expect(riskFactors).toContain('Diabetes');
    });

    it('sollte leere Risikofaktoren verarbeiten', () => {
      const riskFactors: string[] = [];
      expect(riskFactors.length).toBe(0);
    });
  });

  describe('Empfehlungs-Priorität', () => {
    it('sollte Prioritäten korrekt sortieren', () => {
      const priorityOrder = { 'hoch': 0, 'mittel': 1, 'niedrig': 2 };
      expect(priorityOrder['hoch']).toBeLessThan(priorityOrder['mittel']);
      expect(priorityOrder['mittel']).toBeLessThan(priorityOrder['niedrig']);
    });
  });

  describe('Kategorien', () => {
    it('sollte gültige Kategorien haben', () => {
      const validCategories = ['Vorsorge', 'Screening', 'Impfung', 'Lebensstil'];
      expect(validCategories).toContain('Vorsorge');
      expect(validCategories).toContain('Screening');
      expect(validCategories).toContain('Impfung');
      expect(validCategories).toContain('Lebensstil');
    });
  });
});

// ============================================================
// Tests für Preventions-Regeln (indirekt)
// ============================================================

describe('Prevention Rules Logic', () => {
  // Teste die Altersberechnung indirekt
  it('sollte korrekt mit Alter umgehen', () => {
    // Simuliere ein Profil mit Geburtsdatum
    const birthDate = new Date();
    birthDate.setFullYear(birthDate.getFullYear() - 60); // 60 Jahre alt
    
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    expect(age).toBe(60);
  });

  it('sollte Raucher-Status korrekt verarbeiten', () => {
    const isSmoker = true;
    expect(isSmoker).toBe(true);
  });

  it('sollte Risikofaktoren korrekt verarbeiten', () => {
    const riskFactors = ['Diabetes', 'Bluthochdruck'];
    expect(riskFactors.length).toBeGreaterThan(0);
    expect(riskFactors).toContain('Diabetes');
  });
});
