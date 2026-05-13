import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays } from "lucide-react";
import { divisionQuery, divisionsListQuery } from "@/lib/queries";
import type { Division, Game } from "@shared/types";
import { LeagueLogo } from "@/components/LeagueLogo";
import { TeamLogo } from "@/components/TeamLogo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(divisionsListQuery()),
  component: HomeComponent,
});

function HomeComponent() {
  const { data } = useSuspenseQuery(divisionsListQuery());

  const divisionQueries = useQueries({
    queries: data.divisions.map((d) => divisionQuery(d.slug)),
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:justify-between sm:text-left">
        <div className="space-y-2 max-w-xl">
          <h1 className="text-3xl font-semibold tracking-tight">Divisions</h1>
          <p className="text-muted-foreground">
            Live standings, schedules and results — scraped from{" "}
            <a
              href="https://www.thecshl.com/"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              thecshl.com
            </a>
            , re-organized to be actually readable.
          </p>
        </div>
        <LeagueLogo
          variant="wordmark"
          className="h-28 w-auto sm:h-32 drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
        />
      </header>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.divisions.map((d, i) => (
          <li key={d.slug}>
            <DivisionCard
              slug={d.slug}
              name={d.name}
              index={i}
              data={divisionQueries[i]?.data}
              isLoading={divisionQueries[i]?.isLoading ?? false}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function DivisionCard({
  slug,
  name,
  index,
  data,
  isLoading,
}: {
  slug: string;
  name: string;
  index: number;
  data: Division | undefined;
  isLoading: boolean;
}) {
  const next = data ? findNextGame(data.schedule) : null;
  const leader = data && data.standings.length > 0 ? data.standings[0] : null;
  const hasStats = leader !== null && leader.gp > 0;

  return (
    <Link
      to="/divisions/$slug"
      params={{ slug }}
      className={cn(
        "group block h-full rounded-xl border border-border bg-card p-5 transition-all",
        "hover:border-foreground/30 hover:bg-card/80 hover:-translate-y-0.5",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Division {index + 1}
          </p>
          <h2 className="mt-1 text-lg font-semibold">{name}</h2>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
      </div>

      {data && data.teams.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {data.teams.map((t) => (
            <TeamLogo
              key={t.slug}
              src={t.logoUrl}
              name={t.name}
              size="sm"
            />
          ))}
        </div>
      )}

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground text-xs">Teams</dt>
          <dd className="tabular-nums">
            {isLoading ? <Skel w="2rem" /> : data ? data.teams.length : "—"}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground text-xs">
            {hasStats ? "Leader" : "Played"}
          </dt>
          <dd className="font-medium text-right">
            {isLoading ? (
              <Skel w="5rem" />
            ) : hasStats ? (
              <>
                {leader!.team}
                <span className="text-muted-foreground ml-1 text-xs font-normal">
                  ({leader!.pts}p)
                </span>
              </>
            ) : data ? (
              `${data.results.length} games`
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground text-xs">Next</dt>
          <dd className="text-right text-xs flex items-center gap-1.5">
            {isLoading ? (
              <Skel w="7rem" />
            ) : next ? (
              <>
                <CalendarDays className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">{next.date}</span>
                <span className="font-medium">
                  {abbr(next.home)} vs {abbr(next.away)}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </dd>
        </div>
      </dl>
    </Link>
  );
}

function Skel({ w }: { w: string }) {
  return (
    <span
      className="inline-block h-3 animate-pulse rounded bg-muted align-middle"
      style={{ width: w }}
    />
  );
}

function findNextGame(games: Game[]): Game | null {
  return (
    games.find((g) => !g.off && !g.ppd && g.date) ?? games[0] ?? null
  );
}

function abbr(name: string): string {
  const words = name.split(/\s+/);
  if (words.length === 1) return words[0];
  return words
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
