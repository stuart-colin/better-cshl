import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Crown, Shield } from "lucide-react";
import type { Player } from "@shared/types";
import { teamQuery } from "@/lib/queries";
import { ApiException } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { TeamLogo } from "@/components/TeamLogo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teams/$slug")({
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(teamQuery(params.slug));
    } catch (err) {
      if (err instanceof ApiException && err.status === 404) throw notFound();
      throw err;
    }
  },
  component: TeamPage,
  errorComponent: TeamErrorBoundary,
  pendingComponent: TeamPending,
});

function TeamPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(teamQuery(slug));

  const goalies = data.players.filter((p) => p.isGoalie);
  const skaters = data.players.filter((p) => !p.isGoalie);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        {data.divisionSlug ? (
          <Link
            to="/divisions/$slug"
            params={{ slug: data.divisionSlug }}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {data.divisionName ?? "Back to division"}
          </Link>
        ) : (
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            All divisions
          </Link>
        )}
      </div>

      <header className="flex flex-wrap items-center gap-5">
        <TeamLogo src={data.logoUrl} name={data.name} size="xl" />
        <div className="space-y-2 min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">{data.name}</h1>
          <p className="text-muted-foreground text-sm">
            {data.divisionName && (
              <>
                <span>{data.divisionName}</span>
                <span className="mx-2">·</span>
              </>
            )}
            {data.players.length} players · {skaters.length} skaters ·{" "}
            {goalies.length} {goalies.length === 1 ? "goalie" : "goalies"}
            {data.fetchedAt && (
              <>
                <span className="mx-2">·</span>
                <span title={new Date(data.fetchedAt).toLocaleString()}>
                  updated {fetchedAgo(data.fetchedAt)}
                </span>
              </>
            )}
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Skaters
        </h2>
        <RosterTable players={skaters} />
      </section>

      {goalies.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Goalies
          </h2>
          <RosterTable players={goalies} />
        </section>
      )}
    </div>
  );
}

function RosterTable({ players }: { players: Player[] }) {
  if (players.length === 0) {
    return <p className="text-sm text-muted-foreground">No players listed.</p>;
  }
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {players.map((p, i) => (
        <li
          key={`${p.number}-${p.name}-${i}`}
          className={cn(
            "flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5",
            p.isCaptain && "border-amber-500/30 bg-amber-500/5",
          )}
        >
          <span
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-md bg-muted text-sm font-mono tabular-nums",
              p.isCaptain && "bg-amber-500/15 text-amber-200",
              p.isGoalie && "bg-sky-500/15 text-sky-200",
            )}
          >
            {p.number || "—"}
          </span>
          <span className="flex-1 truncate text-sm font-medium">{p.name}</span>
          {p.isCaptain && (
            <Badge variant="outline" className="border-amber-500/40 text-amber-200">
              <Crown className="h-3 w-3" /> C
            </Badge>
          )}
          {p.isGoalie && (
            <Badge variant="outline" className="border-sky-500/40 text-sky-200">
              <Shield className="h-3 w-3" /> G
            </Badge>
          )}
        </li>
      ))}
    </ul>
  );
}

function fetchedAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

function TeamPending() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-32 animate-pulse rounded bg-muted" />
      <div className="h-10 w-72 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}

function TeamErrorBoundary({ error }: { error: Error }) {
  return (
    <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
      <h2 className="text-lg font-semibold">Couldn't load that team</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Link to="/" className="text-sm underline">
        Back home
      </Link>
    </div>
  );
}
