export type Locale = "mm" | "en";
export function isLocale(value: string): value is Locale { return value === "mm" || value === "en"; }
