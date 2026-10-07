/** Read ordered query pages so the API row limit cannot hide child records. */
export async function readAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const pageSize = 500;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    if (!data) throw new Error("Query returned no data; refusing to display an incomplete result");
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}
