import type {
  ApiError,
  Division,
  DivisionSummary,
  TeamRoster,
} from "@shared/types";

const API_BASE = "/api";

export class ApiException extends Error {
  readonly status: number;
  readonly payload: ApiError | null;

  constructor(status: number, message: string, payload: ApiError | null) {
    super(message);
    this.name = "ApiException";
    this.status = status;
    this.payload = payload;
  }
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (json as ApiError | null) ?? null;
    throw new ApiException(
      res.status,
      err?.message ?? `HTTP ${res.status}`,
      err,
    );
  }
  return json as T;
}

export interface DivisionsListResponse {
  divisions: Array<Pick<DivisionSummary, "slug" | "name">>;
}

export const api = {
  listDivisions: () => request<DivisionsListResponse>("/divisions"),
  getDivision: (slug: string) => request<Division>(`/divisions/${slug}`),
  getTeam: (slug: string) => request<TeamRoster>(`/teams/${slug}`),
};
