import type {
  DiscrepancyField,
  Result,
  ScrapedStandingsRow,
  StandingsDiscrepancy,
  StandingsRow,
  Team,
} from "@shared/schemas";

/**
 * Compute standings from the results list.
 *
 * Scoring (standard rec-league rules, matches what the CSHL site uses):
 *   - Regulation Win:  W +1, PTS +2
 *   - Regulation Loss: L +1, PTS +0
 *   - OT/SO Win:       W +1, PTS +2
 *   - OT/SO Loss:      OTL +1, PTS +1
 *   - Tie:             T +1, PTS +1 (both teams)
 *
 * If a tied score arrives without a `(T)` tag we treat it as a tie anyway
 * since a non-tied non-OT game can't end equal; this is more forgiving than
 * dropping the result.
 *
 * Final order is points-then-tiebreakers, falling back to seed order so the
 * preseason (all zeros) renders in the same order as the seed list.
 */
export function computeStandings(
  teams: Team[],
  results: Result[],
): StandingsRow[] {
  const rowsBySlug = new Map<string, StandingsRow>();
  const teamBySlug = new Map<string, Team>(teams.map((t) => [t.slug, t]));

  for (const t of teams) {
    rowsBySlug.set(t.slug, {
      team: t.name,
      slug: t.slug,
      logoUrl: t.logoUrl,
      gp: 0,
      w: 0,
      l: 0,
      otl: 0,
      t: 0,
      pts: 0,
      gf: 0,
      ga: 0,
    });
  }

  for (const r of results) {
    const a = rowsBySlug.get(r.homeSlug);
    const b = rowsBySlug.get(r.awaySlug);
    if (!a || !b) continue;

    a.gp += 1;
    b.gp += 1;
    a.gf += r.homeScore;
    a.ga += r.awayScore;
    b.gf += r.awayScore;
    b.ga += r.homeScore;

    const treatAsTie =
      r.tie || (!r.overtime && r.homeScore === r.awayScore);

    if (treatAsTie) {
      a.t += 1;
      b.t += 1;
      a.pts += 1;
      b.pts += 1;
      continue;
    }

    const aWon = r.homeScore > r.awayScore;
    const winner = aWon ? a : b;
    const loser = aWon ? b : a;
    winner.w += 1;
    winner.pts += 2;
    if (r.overtime) {
      loser.otl += 1;
      loser.pts += 1;
    } else {
      loser.l += 1;
    }
  }

  const rows = [...rowsBySlug.values()];

  rows.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.w !== a.w) return b.w - a.w;
    const diffA = a.gf - a.ga;
    const diffB = b.gf - b.ga;
    if (diffB !== diffA) return diffB - diffA;
    if (b.gf !== a.gf) return b.gf - a.gf;
    const ta = teamBySlug.get(a.slug)?.number ?? 99;
    const tb = teamBySlug.get(b.slug)?.number ?? 99;
    return ta - tb;
  });

  return rows;
}

type ScalarField = Exclude<DiscrepancyField, "otlT">;
const COMPARABLE: ScalarField[] = ["gp", "w", "l", "pts", "gf", "ga"];

/**
 * Compare our calculated rows to the scraped rows and emit discrepancies for
 * every numeric field the site has filled in that disagrees with us. The
 * scraped `otlT` column is compared against `calculated.otl + calculated.t`.
 */
export function reconcileStandings(
  calculated: StandingsRow[],
  scraped: ScrapedStandingsRow[],
): StandingsDiscrepancy[] {
  const calcBySlug = new Map(calculated.map((r) => [r.slug, r]));
  const scrapedByFuzzy = new Map(
    scraped.map((r) => [fuzzyKey(r.slug), r]),
  );

  const discrepancies: StandingsDiscrepancy[] = [];

  for (const calc of calculated) {
    const scrapedRow =
      scraped.find((s) => s.slug === calc.slug) ??
      scrapedByFuzzy.get(fuzzyKey(calc.slug)) ??
      null;
    if (!scrapedRow) continue;

    for (const field of COMPARABLE) {
      const scrapedVal = scrapedRow[field];
      const calculatedVal = calc[field];
      if (scrapedVal == null) continue;
      if (scrapedVal !== calculatedVal) {
        discrepancies.push({
          team: calc.team,
          slug: calc.slug,
          field,
          calculated: calculatedVal,
          scraped: scrapedVal,
        });
      }
    }

    if (scrapedRow.otlT != null) {
      const calcCombined = calc.otl + calc.t;
      if (scrapedRow.otlT !== calcCombined) {
        discrepancies.push({
          team: calc.team,
          slug: calc.slug,
          field: "otlT",
          calculated: calcCombined,
          scraped: scrapedRow.otlT,
        });
      }
    }
  }

  // Surface teams that appear in scraped standings but not in seeds
  // (historical precedent — sometimes renamed teams linger).
  for (const sc of scraped) {
    const exact = calcBySlug.get(sc.slug);
    const fuzzy = [...calcBySlug.values()].find(
      (c) => fuzzyKey(c.slug) === fuzzyKey(sc.slug),
    );
    if (!exact && !fuzzy && sc.pts != null) {
      discrepancies.push({
        team: sc.team,
        slug: sc.slug,
        field: "pts",
        calculated: 0,
        scraped: sc.pts,
      });
    }
  }

  return discrepancies;
}

function fuzzyKey(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/[-_]/g, "")
    .replace(/(?:ies|es|s|y)$/, "");
}
