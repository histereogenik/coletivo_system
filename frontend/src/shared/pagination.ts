import { api } from "./api";

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export const isPaginatedResponse = <T>(data: unknown): data is PaginatedResponse<T> => {
  return (
    typeof data === "object" &&
    data !== null &&
    "results" in data &&
    Array.isArray((data as PaginatedResponse<T>).results)
  );
};

export async function fetchAllPages<T>(
  url: string,
  params?: Record<string, string | number | undefined>
) {
  const first = await api.get<PaginatedResponse<T> | T[]>(url, { params });
  if (!isPaginatedResponse<T>(first.data)) {
    return first.data as T[];
  }
  let results = [...first.data.results];
  let next = first.data.next;
  while (next) {
    const { data } = await api.get<PaginatedResponse<T>>(next);
    results = results.concat(data.results);
    next = data.next;
  }
  return results;
}
