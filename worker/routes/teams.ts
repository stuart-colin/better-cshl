import { Hono } from "hono";
import { withEdgeCacheJson } from "../lib/cache";
import { errorResponse, ParseError } from "../lib/errors";
import { scrapeRosters } from "../scrapers/rosters";
import { scrapeDivision, type DivisionSlug } from "../scrapers/division";
import type { Rosters, TeamRoster } from "@shared/schemas";

const route = new Hono<{ Bindings: { ASSETS: Fetcher } }>();

const CACHE_VERSION = "v3";
const ROSTERS_KEY = `rosters:${CACHE_VERSION}:all`;
const TTL_SECONDS = 600;

route.get("/", async (c) => {
  try {
    return await withEdgeCacheJson(
      ROSTERS_KEY,
      TTL_SECONDS,
      scrapeRosters,
      c.executionCtx,
    );
  } catch (err) {
    return errorResponse(c, err);
  }
});

route.get("/by-division/:slug", async (c) => {
  const slug = c.req.param("slug");
  try {
    return await withEdgeCacheJson(
      `rosters:${CACHE_VERSION}:division:${slug}`,
      TTL_SECONDS,
      async () => {
        const rosters = await scrapeRosters();
        const filtered = rosters.teams.filter((t) => t.divisionSlug === slug);
        return { fetchedAt: rosters.fetchedAt, teams: filtered };
      },
      c.executionCtx,
    );
  } catch (err) {
    return errorResponse(c, err);
  }
});

route.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  try {
    return await withEdgeCacheJson(
      `team:${CACHE_VERSION}:${slug}`,
      TTL_SECONDS,
      async () => {
        const rosters = await scrapeRosters();
        const team = findTeamBySlug(slug, rosters);
        const logoUrl = team.divisionSlug
          ? await lookupLogo(team.divisionSlug, team.slug)
          : null;
        return { ...team, logoUrl, fetchedAt: rosters.fetchedAt };
      },
      c.executionCtx,
    );
  } catch (err) {
    return errorResponse(c, err);
  }
});

async function lookupLogo(
  divisionSlug: string,
  teamSlug: string,
): Promise<string | null> {
  try {
    const division = await scrapeDivision(divisionSlug as DivisionSlug);
    const exact = division.teams.find((t) => t.slug === teamSlug);
    if (exact?.logoUrl) return exact.logoUrl;
    const target = fuzzyKey(teamSlug);
    const fuzzy = division.teams.find((t) => fuzzyKey(t.slug) === target);
    return fuzzy?.logoUrl ?? null;
  } catch {
    return null;
  }
}

function findTeamBySlug(slug: string, rosters: Rosters): TeamRoster {
  const exact = rosters.teams.find((t) => t.slug === slug);
  if (exact) return exact;

  // Names sometimes drift between the division pages and the rosters page
  // (e.g. "Country Creamers" vs "Country Creamery"). Normalize away the
  // trailing inflection (s/y) and try again.
  const target = fuzzyKey(slug);
  const fuzzy = rosters.teams.find((t) => fuzzyKey(t.slug) === target);
  if (fuzzy) return fuzzy;

  throw new ParseError(`team not found: ${slug}`, "team");
}

function fuzzyKey(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/[-_]/g, "")
    .replace(/(?:ies|es|s|y)$/, "");
}

export default route;
