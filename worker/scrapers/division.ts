import { DivisionSchema, type Division } from "@shared/schemas";
import { ParseError } from "../lib/errors";
import { fetchCshl } from "../lib/fetchCshl";
import { computeStandings, reconcileStandings } from "./computeStandings";
import { parseTeamLogos } from "./parsers/logos";
import { parseResults } from "./parsers/results";
import { parseSchedule } from "./parsers/schedule";
import { parseSeedList } from "./parsers/seedList";
import { parseScrapedStandings } from "./parsers/standings";

export const DIVISIONS = [
  {
    slug: "northern",
    name: "Northern Division",
    path: "/northern-division.html",
  },
  {
    slug: "eastern-i",
    name: "Eastern Division I",
    path: "/eastern-division-i.html",
  },
  {
    slug: "eastern-ii",
    name: "Eastern Division II",
    path: "/eastern-division-ii.html",
  },
  {
    slug: "central",
    name: "Central Division",
    path: "/central-division.html",
  },
  {
    slug: "western",
    name: "Western Division",
    path: "/western-division.html",
  },
  {
    slug: "southern",
    name: "Southern Division",
    path: "/southern-division.html",
  },
] as const;

export type DivisionSlug = (typeof DIVISIONS)[number]["slug"];

export function getDivisionMeta(slug: string) {
  return DIVISIONS.find((d) => d.slug === slug) ?? null;
}

export async function scrapeDivision(slug: DivisionSlug): Promise<Division> {
  const meta = getDivisionMeta(slug);
  if (!meta) {
    throw new ParseError(`unknown division slug: ${slug}`, "divisionSlug");
  }

  const { html, url, fetchedAt } = await fetchCshl(meta.path);
  const seedTeams = parseSeedList(html);
  const logos = parseTeamLogos(html, seedTeams.length);
  const teams = seedTeams.map((team, i) => ({
    ...team,
    logoUrl: logos[i] ?? null,
  }));
  const scrapedStandings = parseScrapedStandings(html, teams);
  const results = parseResults(html, teams);
  const schedule = parseSchedule(html, teams);
  const standings = computeStandings(teams, results);
  const discrepancies = reconcileStandings(standings, scrapedStandings);

  return DivisionSchema.parse({
    slug: meta.slug,
    name: meta.name,
    url,
    teams,
    standings,
    scrapedStandings,
    discrepancies,
    results,
    schedule,
    fetchedAt,
  });
}
