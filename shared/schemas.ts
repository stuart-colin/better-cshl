import { z } from "zod";

export const TeamSchema = z.object({
  number: z.number().int().min(1).max(12),
  name: z.string().min(1),
  slug: z.string().min(1),
  logoUrl: z.string().url().nullable(),
});
export type Team = z.infer<typeof TeamSchema>;

/**
 * Calculated standings. We compute these from the results blob so they're
 * always fully populated (zeros preseason). OTL and T are tracked separately
 * here, unlike the site which collapses them into a single "OTL/T" column.
 */
export const StandingsRowSchema = z.object({
  team: z.string(),
  slug: z.string(),
  logoUrl: z.string().url().nullable(),
  gp: z.number().int(),
  w: z.number().int(),
  l: z.number().int(),
  otl: z.number().int(),
  t: z.number().int(),
  pts: z.number().int(),
  gf: z.number().int(),
  ga: z.number().int(),
});
export type StandingsRow = z.infer<typeof StandingsRowSchema>;

/**
 * Standings as scraped from the CSHL site. Cells are nullable because the
 * site frequently leaves rows blank (preseason or just outright stale). OTL
 * and T share one column on the site, so we surface them as `otlT`.
 */
export const ScrapedStandingsRowSchema = z.object({
  team: z.string(),
  slug: z.string(),
  gp: z.number().int().nullable(),
  w: z.number().int().nullable(),
  l: z.number().int().nullable(),
  otlT: z.number().int().nullable(),
  pts: z.number().int().nullable(),
  gf: z.number().int().nullable(),
  ga: z.number().int().nullable(),
});
export type ScrapedStandingsRow = z.infer<typeof ScrapedStandingsRowSchema>;

export const DiscrepancyFieldSchema = z.enum([
  "gp",
  "w",
  "l",
  "otlT",
  "pts",
  "gf",
  "ga",
]);
export type DiscrepancyField = z.infer<typeof DiscrepancyFieldSchema>;

/**
 * One mismatch between our calculated row and the site's scraped row. We only
 * emit a discrepancy when the site value is non-null *and* differs from ours.
 */
export const StandingsDiscrepancySchema = z.object({
  team: z.string(),
  slug: z.string(),
  field: DiscrepancyFieldSchema,
  calculated: z.number().int(),
  scraped: z.number().int(),
});
export type StandingsDiscrepancy = z.infer<typeof StandingsDiscrepancySchema>;

export const ResultSchema = z.object({
  home: z.string(),
  homeSlug: z.string(),
  homeLogoUrl: z.string().url().nullable(),
  homeScore: z.number().int().nonnegative(),
  away: z.string(),
  awaySlug: z.string(),
  awayLogoUrl: z.string().url().nullable(),
  awayScore: z.number().int().nonnegative(),
  overtime: z.boolean(),
  tie: z.boolean(),
});
export type Result = z.infer<typeof ResultSchema>;

export const GameSchema = z.object({
  week: z.number().int(),
  weekLabel: z.string().nullable(),
  homeNumber: z.number().int().min(1).max(12),
  awayNumber: z.number().int().min(1).max(12),
  home: z.string(),
  homeSlug: z.string(),
  homeLogoUrl: z.string().url().nullable(),
  away: z.string(),
  awaySlug: z.string(),
  awayLogoUrl: z.string().url().nullable(),
  date: z.string().nullable(),
  time: z.string().nullable(),
  rinkColor: z.string().nullable(),
  off: z.boolean(),
  ppd: z.boolean(),
});
export type Game = z.infer<typeof GameSchema>;

export const DivisionSummarySchema = z.object({
  slug: z.string(),
  name: z.string(),
  url: z.string(),
});
export type DivisionSummary = z.infer<typeof DivisionSummarySchema>;

export const DivisionSchema = z.object({
  slug: z.string(),
  name: z.string(),
  url: z.string(),
  teams: z.array(TeamSchema),
  standings: z.array(StandingsRowSchema),
  scrapedStandings: z.array(ScrapedStandingsRowSchema),
  discrepancies: z.array(StandingsDiscrepancySchema),
  results: z.array(ResultSchema),
  schedule: z.array(GameSchema),
  fetchedAt: z.string(),
});
export type Division = z.infer<typeof DivisionSchema>;

export const PlayerSchema = z.object({
  number: z.string(),
  name: z.string(),
  isCaptain: z.boolean(),
  isGoalie: z.boolean(),
});
export type Player = z.infer<typeof PlayerSchema>;

export const TeamRosterSchema = z.object({
  slug: z.string(),
  name: z.string(),
  divisionSlug: z.string().nullable(),
  divisionName: z.string().nullable(),
  logoUrl: z.string().url().nullable(),
  players: z.array(PlayerSchema),
  fetchedAt: z.string().optional(),
});
export type TeamRoster = z.infer<typeof TeamRosterSchema>;

export const RostersSchema = z.object({
  fetchedAt: z.string(),
  teams: z.array(TeamRosterSchema),
});
export type Rosters = z.infer<typeof RostersSchema>;
