export const adminBlockTypes = [
  "heading",
  "rich_text",
  "callout",
  "divider",
  "spacer",
  "image",
  "video",
  "timer",
  "checklist",
  "exercise",
  "quiz",
  "button",
] as const;

export type AdminBlockType = (typeof adminBlockTypes)[number];

export type LocalizedBlockContent = {
  text?: string;
  label?: string;
  caption?: string;
  alt?: string;
  items?: string[];
  question?: string;
  options?: string[];
  correctOption?: number;
};

export type AdminTemplateBlock = {
  id: string;
  blockType: AdminBlockType;
  titleMm: string;
  titleEn: string;
  contentMm: LocalizedBlockContent;
  contentEn: LocalizedBlockContent;
  config: Record<string, unknown>;
  visible: boolean;
};

export type AdminTemplateDocument = {
  id: string;
  screenKey: string;
  dayNumber: number | null;
  titleMm: string;
  titleEn: string;
  blocks: AdminTemplateBlock[];
};

export type AdminTemplate = {
  id: string;
  slug: string;
  nameMm: string;
  nameEn: string;
  descriptionMm: string;
  descriptionEn: string;
  versionId: string;
  versionStatus: "draft" | "published" | "archived";
  versionNo: number;
  documents: AdminTemplateDocument[];
};

export type AdminActionResult = {
  ok: boolean;
  message: string;
  templateId?: string;
  versionId?: string;
};

