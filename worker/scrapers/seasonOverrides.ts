import type { StandingsNote, StandingsRow, Team } from "@shared/schemas";
import { sortStandings } from "./computeStandings";

/**
 * TEMPORARY: hand-entered fixes for one-off situations this season.
 *
 * Delete this file and its call in `division.ts` at season end. Entries also
 * stop applying after `expiresOn`, so a forgotten entry can't skew next season.
 */

type StatOffset = Pick<
  StandingsRow,
  "gp" | "w" | "l" | "otl" | "t" | "pts" | "gf" | "ga"
>;

interface SeasonOverride {
  division: string;
  teamSlug: string;
  /** ISO date (YYYY-MM-DD); the entry is ignored from this day on. */
  expiresOn: string;
  note: string;
  add: StatOffset;
}

const SEASON_OVERRIDES: SeasonOverride[] = [
  {
    // Moved from Northern (team 4) to Eastern I at week 7. The site's Eastern I
    // row carries their Northern record; their Northern results are:
    // Raiders 5-4, Scotti's 5-3, Raiders 6-2, Freeway 6-2, Wintergreen 9-2.
    division: "eastern-i",
    teamSlug: "american-trucking",
    expiresOn: "2027-04-01",
    note: "Includes 5 games played in Northern Division before moving to Eastern I.",
    add: { gp: 5, w: 0, l: 5, otl: 0, t: 0, pts: 0, gf: 13, ga: 31 },
  },
];

export function applySeasonOverrides(
  division: string,
  standings: StandingsRow[],
  teams: Team[],
  now: Date = new Date(),
): { standings: StandingsRow[]; notes: StandingsNote[] } {
  const today = now.toISOString().slice(0, 10);
  const notes: StandingsNote[] = [];
  let changed = false;

  const rows = standings.map((row) => {
    const override = SEASON_OVERRIDES.find(
      (o) => o.division === division && o.teamSlug === row.slug,
    );
    if (!override) return row;
    if (today >= override.expiresOn) {
      console.warn(
        `seasonOverrides: entry for ${division}/${row.slug} expired on ${override.expiresOn}; remove it.`,
      );
      return row;
    }

    changed = true;
    notes.push({ team: row.team, slug: row.slug, note: override.note });
    const { add } = override;
    return {
      ...row,
      gp: row.gp + add.gp,
      w: row.w + add.w,
      l: row.l + add.l,
      otl: row.otl + add.otl,
      t: row.t + add.t,
      pts: row.pts + add.pts,
      gf: row.gf + add.gf,
      ga: row.ga + add.ga,
    };
  });

  return { standings: changed ? sortStandings(rows, teams) : rows, notes };
}
