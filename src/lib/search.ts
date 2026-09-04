export function matchesSearch(query: string, values: Array<string | number | null | undefined>) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;

  return values.some((value) => String(value ?? "").toLocaleLowerCase().includes(needle));
}
