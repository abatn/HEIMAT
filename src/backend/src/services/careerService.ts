// careerService.ts — Karriere-Pfad Service
//
// Features:
// 1. Karriere-Entwicklung: Zeigt logische Weiterentwicklungen pro Beruf
// 2. Fehlende Skills: Welche Skills fehlen für den nächsten Schritt
// 3. Lernpfad: Konkrete Kursvorschläge mit geschätzter Dauer

import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CareerStep {
  currentRole: string;
  nextRoles: string[];
  requiredSkills: string[];
  estimatedDuration: string;
}

export interface LearningPath {
  skill: string;
  course: string;
  duration: string;
  provider: string;
  url?: string;
}

export interface CareerAdvice {
  currentRole: string;
  nextRoles: Array<{
    role: string;
    missingSkills: string[];
    estimatedDuration: string;
    learningPaths: LearningPath[];
  }>;
}

// ---------------------------------------------------------------------------
// Wissensbasis: Berufsgruppen & Karrierepfade (DE)
// ---------------------------------------------------------------------------

const CAREER_DATABASE: Record<string, CareerStep> = {
  // IT
  'entwickler': {
    currentRole: 'Entwickler',
    nextRoles: ['Senior Entwickler', 'Tech Lead', 'Architekt', 'Engineering Manager'],
    requiredSkills: ['Teamführung', 'Architektur', 'Code Review', 'Mentoring'],
    estimatedDuration: '2-4 Jahre',
  },
  'senior entwickler': {
    currentRole: 'Senior Entwickler',
    nextRoles: ['Tech Lead', 'Architekt', 'Engineering Manager', 'CTO'],
    requiredSkills: ['Systemdesign', 'Teamführung', 'Strategische Planung'],
    estimatedDuration: '2-3 Jahre',
  },
  'frontend entwickler': {
    currentRole: 'Frontend Entwickler',
    nextRoles: ['Senior Frontend', 'Full-Stack Entwickler', 'UI/UX Engineer'],
    requiredSkills: ['Backend-Grundlagen', 'UI/UX Design', 'Performance-Optimierung'],
    estimatedDuration: '1-3 Jahre',
  },
  'devops engineer': {
    currentRole: 'DevOps Engineer',
    nextRoles: ['Senior DevOps', 'Platform Engineer', 'SRE', 'Cloud Architect'],
    requiredSkills: ['Cloud Architecture', 'Security', 'Cost Optimization'],
    estimatedDuration: '2-4 Jahre',
  },
  // Gesundheit
  'krankenpfleger': {
    currentRole: 'Krankenpfleger',
    nextRoles: ['Stationsleiter', 'Pflegedienstleitung', 'Qualitätsmanagement'],
    requiredSkills: ['Teamführung', 'Budgetverantwortung', 'Qualitätsmanagement', 'Personalplanung'],
    estimatedDuration: '3-5 Jahre',
  },
  'arzt': {
    currentRole: 'Arzt',
    nextRoles: ['Facharzt', 'Chefarzt', 'Praxisinhaber'],
    requiredSkills: ['Spezialisierung', 'Forschung', 'Administration'],
    estimatedDuration: '5-10 Jahre',
  },
  // Handwerk
  'elektriker': {
    currentRole: 'Elektriker',
    nextRoles: ['Meister', 'Selbstständig', 'Projektleiter'],
    requiredSkills: ['Meisterbrief', 'Unternehmensführung', 'Projektmanagement'],
    estimatedDuration: '2-4 Jahre',
  },
  // Gastro
  'koch': {
    currentRole: 'Koch',
    nextRoles: ['Chefkoch', 'Restaurantleiter', 'Selbstständig'],
    requiredSkills: ['Kreativität', 'Teamführung', 'Kostenkalkulation', 'Hygienemanagement'],
    estimatedDuration: '3-5 Jahre',
  },
  // Bildung
  'lehrer': {
    currentRole: 'Lehrer',
    nextRoles: ['Studienrat', 'Schulleiter', 'Schulberater'],
    requiredSkills: ['Didaktik', 'Schulmanagement', 'Personalentwicklung'],
    estimatedDuration: '5-10 Jahre',
  },
  // Verwaltung
  'sachbearbeiter': {
    currentRole: 'Sachbearbeiter',
    nextRoles: ['Teamleitung', 'Abteilungsleitung', 'Stadtverordneter'],
    requiredSkills: ['Führung', 'Haushaltsplanung', 'Öffentlichkeitsarbeit'],
    estimatedDuration: '3-7 Jahre',
  },
  // Logistik
  'lagerarbeiter': {
    currentRole: 'Lagerarbeiter',
    nextRoles: ['Teamleitung Lager', 'Logistikkoordinator', 'Disponent'],
    requiredSkills: ['Organisation', 'IT-Grundlagen', 'Kommunikation'],
    estimatedDuration: '2-4 Jahre',
  },
};

// Lernpfad-Datenbank
const LEARNING_DATABASE: Record<string, LearningPath[]> = {
  'teamführung': [
    { skill: 'Teamführung', course: 'Führungsgrundkurs', duration: '4 Wochen', provider: 'IHK', url: 'https://www.ihk.de' },
    { skill: 'Teamführung', course: 'Leadership Excellence', duration: '6 Wochen', provider: 'Coursera', url: 'https://www.coursera.org' },
  ],
  'budgetverantwortung': [
    { skill: 'Budgetverantwortung', course: 'Basiswissen Controlling', duration: '3 Wochen', provider: 'Sammac', url: 'https://www.sammac.de' },
    { skill: 'Budgetverantwortung', course: 'Finanzmanagement', duration: '4 Wochen', provider: 'edX', url: 'https://www.edx.org' },
  ],
  'qualitätsmanagement': [
    { skill: 'Qualitätsmanagement', course: 'QM-Grundlagen (ISO 9001)', duration: '2 Wochen', provider: 'TÜV', url: 'https://www.tuv.com' },
    { skill: 'Qualitätsmanagement', course: 'Six Sigma Yellow Belt', duration: '3 Wochen', provider: 'Coursera', url: 'https://www.coursera.org' },
  ],
  'projektmanagement': [
    { skill: 'Projektmanagement', course: 'PRINCE2 Foundation', duration: '3 Wochen', provider: 'Axelos', url: 'https://www.axelos.com' },
    { skill: 'Projektmanagement', course: 'PMP Certification', duration: '6 Wochen', provider: 'PMI', url: 'https://www.pmi.org' },
  ],
  'cloud architecture': [
    { skill: 'Cloud Architecture', course: 'AWS Solutions Architect', duration: '8 Wochen', provider: 'AWS', url: 'https://aws.amazon.com/training' },
    { skill: 'Cloud Architecture', course: 'Azure Architect', duration: '6 Wochen', provider: 'Microsoft', url: 'https://learn.microsoft.com' },
  ],
  'systemdesign': [
    { skill: 'Systemdesign', course: 'System Design Interview Prep', duration: '4 Wochen', provider: 'Educative', url: 'https://www.educative.io' },
    { skill: 'Systemdesign', course: 'Softwarearchitektur', duration: '6 Wochen', provider: 'Coursera', url: 'https://www.coursera.org' },
  ],
  'unternehmensführung': [
    { skill: 'Unternehmensführung', course: 'Gründerkurs', duration: '6 Wochen', provider: 'IHK', url: 'https://www.ihk.de' },
    { skill: 'Unternehmensführung', course: 'Betriebswirtschaft', duration: '8 Wochen', provider: 'Fernstudium', url: 'https://www.fernstudium.de' },
  ],
  'spezialisierung': [
    { skill: 'Spezialisierung', course: 'Facharztweiterbildung', duration: '3-5 Jahre', provider: 'Ärztekammer', url: 'https://www.aerztekammer.de' },
  ],
  'personalplanung': [
    { skill: 'Personalplanung', course: 'HR-Management', duration: '4 Wochen', provider: 'Sammac', url: 'https://www.sammac.de' },
  ],
  'forschung': [
    { skill: 'Forschung', course: 'Wissenschaftliches Arbeiten', duration: '2 Wochen', provider: 'Coursera', url: 'https://www.coursera.org' },
  ],
  'meisterbrief': [
    { skill: 'Meisterbrief', course: 'Meisterkurs (Elektrotechnik)', duration: '6 Monate', provider: 'IHK', url: 'https://www.ihk.de' },
  ],
  'kreativität': [
    { skill: 'Kreativität', course: 'Kreativitätsmanagement', duration: '2 Wochen', provider: 'Coursera', url: 'https://www.coursera.org' },
  ],
  'didaktik': [
    { skill: 'Didaktik', course: 'Hochschuldidaktik', duration: '4 Wochen', provider: 'Hochschule', url: 'https://www.hochschuldidaktik.de' },
  ],
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CareerService {
  /**
   * Karriere-Advice für einen Beruf laden.
   *
   * @param role  Aktueller Beruf (z.B. "Krankenpfleger", "Entwickler")
   * @returns     CareerAdvice mit nächsten Schritten und Lernpfaden
   */
  async getCareerAdvice(role: string): Promise<CareerAdvice> {
    const normalizedRole = role.toLowerCase().trim();
    
    // Suche in Datenbank
    const careerStep = CAREER_DATABASE[normalizedRole];
    
    if (careerStep) {
      return this.buildAdvice(careerStep);
    }
    
    // Versuche teilweises Matching (suche Schlüssel der im Input vorkommt)
    const matchKey = Object.keys(CAREER_DATABASE).find(
      key => normalizedRole.includes(key)
    );
    
    if (matchKey) {
      return this.buildAdvice(CAREER_DATABASE[matchKey]);
    }
    
    // Kein Match — generische Antwort
    return {
      currentRole: role,
      nextRoles: [],
    };
  }

  /**
   * Baut CareerAdvice aus einem CareerStep.
   */
  private buildAdvice(step: CareerStep): CareerAdvice {
    const nextRoles = step.nextRoles.map(nextRole => {
      // Fehlende Skills ermitteln (vereinfacht: alle Required Skills)
      const missingSkills = step.requiredSkills;
      
      // Lernpfade für fehlende Skills
      const learningPaths: LearningPath[] = [];
      for (const skill of missingSkills) {
        const paths = LEARNING_DATABASE[skill.toLowerCase()];
        if (paths) {
          learningPaths.push(...paths);
        }
      }
      
      // Generische Lernpfade wenn keine spezifischen gefunden
      if (learningPaths.length === 0) {
        learningPaths.push({
          skill: missingSkills[0] || 'Allgemeine Weiterbildung',
          course: 'On-the-Job Training',
          duration: '3-6 Monate',
          provider: 'Betriebliche Weiterbildung',
        });
      }
      
      return {
        role: nextRole,
        missingSkills,
        estimatedDuration: step.estimatedDuration,
        learningPaths: learningPaths.slice(0, 3), // Max 3 Kurse
      };
    });
    
    return {
      currentRole: step.currentRole,
      nextRoles,
    };
  }
}

export const careerService = new CareerService();
