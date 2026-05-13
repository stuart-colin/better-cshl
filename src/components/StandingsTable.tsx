import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import type {
  DiscrepancyField,
  ScrapedStandingsRow,
  StandingsDiscrepancy,
  StandingsRow,
} from "@shared/types";
import { cn } from "@/lib/utils";
import { TeamLogo } from "@/components/TeamLogo";

interface Props {
  rows: StandingsRow[];
  scraped?: ScrapedStandingsRow[];
  discrepancies?: StandingsDiscrepancy[];
}

type ScalarField = Exclude<DiscrepancyField, "otlT">;

const COLS: Array<{
  key: ScalarField | "otl" | "t";
  label: string;
  hint: string;
}> = [
  { key: "gp", label: "GP", hint: "Games Played" },
  { key: "w", label: "W", hint: "Wins (incl. OT/SO)" },
  { key: "l", label: "L", hint: "Regulation Losses" },
  { key: "otl", label: "OTL", hint: "Overtime Losses (1pt)" },
  { key: "t", label: "T", hint: "Ties (1pt each)" },
  { key: "pts", label: "PTS", hint: "Points: W=2, OTL=1, T=1" },
  { key: "gf", label: "GF", hint: "Goals For" },
  { key: "ga", label: "GA", hint: "Goals Against" },
];

export function StandingsTable({ rows, scraped = [], discrepancies = [] }: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No standings published yet.
      </p>
    );
  }

  const empty = rows.every((r) => r.gp === 0);
  const discByTeamField = new Map<string, StandingsDiscrepancy>();
  for (const d of discrepancies) {
    discByTeamField.set(`${d.slug}:${d.field}`, d);
  }
  const hasScraped = scraped.some((s) => s.gp != null || s.pts != null);

  return (
    <div className="space-y-3">
      {discrepancies.length > 0 && (
        <DiscrepancyBanner discrepancies={discrepancies} />
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="max-w-full min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="text-left font-medium px-4 py-2.5">
                <span className="sr-only">Rank</span>#
              </th>
              <th className="text-left font-medium px-4 py-2.5">Team</th>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  title={c.hint}
                  className="text-right font-medium px-3 py-2.5 last:pr-4"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.slug}
                className={cn(
                  "border-t border-border/60 hover:bg-muted/30 transition-colors",
                  i === 0 && !empty && "bg-emerald-500/5",
                )}
              >
                <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                  {empty ? "—" : i + 1}
                </td>
                <td className="px-4 py-2.5 font-medium">
                  <Link
                    to="/teams/$slug"
                    params={{ slug: r.slug }}
                    className="inline-flex items-center gap-2 hover:underline underline-offset-2 decoration-muted-foreground/40"
                  >
                    <TeamLogo src={r.logoUrl} name={r.team} size="sm" />
                    <span>{r.team}</span>
                  </Link>
                </td>
                {COLS.map((c) => {
                  // OTL/T columns share a single discrepancy entry on the
                  // site (`otlT`). Show the warning on the OTL cell.
                  const disc =
                    c.key === "otl"
                      ? discByTeamField.get(`${r.slug}:otlT`)
                      : c.key === "t"
                        ? undefined
                        : discByTeamField.get(`${r.slug}:${c.key}`);
                  const val = r[c.key];
                  const statAccent =
                    typeof val === "number" && val > 0
                      ? c.key === "w"
                        ? "text-emerald-400"
                        : c.key === "otl" || c.key === "t"
                          ? "text-yellow-400"
                          : undefined
                      : undefined;
                  return (
                    <td
                      key={c.key}
                      className={cn(
                        "px-3 py-2.5 text-right tabular-nums last:pr-4",
                        c.key === "pts" && "font-semibold",
                        disc && "bg-amber-500/10",
                      )}
                      title={
                        disc
                          ? `Site reports ${disc.scraped}, we calculated ${disc.calculated}`
                          : undefined
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        {disc && (
                          <AlertTriangle className="h-3 w-3 text-amber-400" />
                        )}
                        <span className={cn(statAccent)}>{val}</span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
          <span>
            Calculated from {rows[0]?.gp ? "results" : "results (none played yet)"}
          </span>
          {hasScraped && (
            <span className="text-muted-foreground/80">
              · Cross-checked against the site's published standings
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function DiscrepancyBanner({
  discrepancies,
}: {
  discrepancies: StandingsDiscrepancy[];
}) {
  const grouped = new Map<string, StandingsDiscrepancy[]>();
  for (const d of discrepancies) {
    const arr = grouped.get(d.team) ?? [];
    arr.push(d);
    grouped.set(d.team, arr);
  }

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-amber-200">
            Site standings disagree with our calculation
          </p>
          <p className="text-xs text-amber-200/80">
            We computed the table from the published results.
            The CSHL site shows different numbers for{" "}
            {grouped.size === 1
              ? "1 team"
              : `${grouped.size} teams`}:
          </p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {[...grouped.entries()].map(([team, entries]) => (
              <li key={team} className="text-amber-100/90">
                <span className="font-medium">{team}</span>
                <span className="text-amber-200/70">
                  {" — "}
                  {entries
                    .map(
                      (e) =>
                        `${labelFor(e.field)}: site ${e.scraped} / calc ${e.calculated}`,
                    )
                    .join("; ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function labelFor(field: DiscrepancyField): string {
  switch (field) {
    case "otlT":
      return "OTL+T";
    default:
      return field.toUpperCase();
  }
}
