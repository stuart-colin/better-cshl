import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { divisionQuery } from "@/lib/queries";
import { StandingsTable } from "@/components/StandingsTable";

export const Route = createFileRoute("/divisions/$slug/")({
  component: DivisionStandingsPage,
});

function DivisionStandingsPage() {
  const { slug } = Route.useParams();
  const { data: division } = useSuspenseQuery(divisionQuery(slug));

  return (
    <StandingsTable
      rows={division.standings}
      scraped={division.scrapedStandings}
      discrepancies={division.discrepancies}
    />
  );
}
