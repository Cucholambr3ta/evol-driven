import { UserError } from "./errors.js";

/** The nine disciplines every project starts with unless a profile says otherwise. */
export const BASE_DISCIPLINES = [
  "SDD",
  "FDD",
  "DDD",
  "THREAT",
  "BDD",
  "ATDD",
  "TDD",
  "STDD",
  "SecDD",
] as const;

export interface Profile {
  resumen: string;
  disciplinas: string[];
}

/** Disciplines by kind of project. `base` is the default. */
export const PROFILES: Record<string, Profile> = {
  base: { resumen: "las 9 disciplinas base", disciplinas: [...BASE_DISCIPLINES] },
  api: {
    resumen: "servicio con API pública: base + contrato, versionado, observabilidad y rendimiento",
    disciplinas: [
      ...BASE_DISCIPLINES,
      "ODD_API",
      "APIVDD",
      "CCDD",
      "ODD_OBS",
      "DeprecationDD",
      "PDD",
    ],
  },
  web: {
    resumen: "aplicación web: base + experiencia de usuario, accesibilidad y casos de uso",
    disciplinas: [...BASE_DISCIPLINES, "UXDD", "A11yDD", "UDD", "PDD"],
  },
  erp: {
    resumen:
      "sistema de gestión con datos sensibles: base + migraciones, cumplimiento y privacidad",
    disciplinas: [...BASE_DISCIPLINES, "MDD", "COMPLIANCE", "PrivacyDD", "ODD_API", "DebtBudgetDD"],
  },
  lib: {
    resumen: "librería: sin features ni aceptación; añade versionado y deprecaciones",
    disciplinas: ["SDD", "DDD", "THREAT", "BDD", "TDD", "STDD", "SecDD", "APIVDD", "DeprecationDD"],
  },
  script: {
    resumen:
      "un script suelto: sin features de persona ni pruebas de aceptación; el briefing solo pide un escenario de BDD",
    disciplinas: ["SDD", "BDD", "TDD", "SecDD", "THREAT"],
  },
};

export function profileNames(): string[] {
  return Object.keys(PROFILES);
}

export function getProfile(name: string): Profile {
  const profile = PROFILES[name];
  if (!profile) {
    throw new UserError(`Perfil desconocido «${name}». Perfiles: ${profileNames().join(", ")}.`);
  }
  return profile;
}
