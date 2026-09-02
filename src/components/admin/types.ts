export type AdminProgramExercise = {
  id: string;
  slug: string;
  nameMm: string;
  nameEn: string;
  cueMm: string;
  cueEn: string;
  equipmentMm: string;
  equipmentEn: string;
  position: number;
};

export type AdminProgramDayItem = {
  id: string;
  exerciseSlug: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  targetKg: number;
  restSeconds: number;
};

export type AdminProgramDay = {
  id: string;
  dayNumber: number;
  dayType: "push" | "pull" | "challenge";
  phase: 1 | 2;
  titleMm: string;
  titleEn: string;
  items: AdminProgramDayItem[];
};

export type AdminProgramStructure = {
  templateId: string;
  versionId: string;
  versionStatus: "draft" | "published" | "archived";
  versionNo: number;
  exercises: AdminProgramExercise[];
  days: AdminProgramDay[];
};

export type AdminActionResult = {
  ok: boolean;
  message: string;
  templateId?: string;
  versionId?: string;
};
