export type {
  Team,
  StandingsRow,
  ScrapedStandingsRow,
  StandingsDiscrepancy,
  DiscrepancyField,
  Result,
  Game,
  Division,
  DivisionSummary,
  Player,
  TeamRoster,
  Rosters,
} from "./schemas";

export interface ApiError {
  error: string;
  message: string;
  section?: string;
  sample?: string;
  upstream?: { url: string; status: number };
}
