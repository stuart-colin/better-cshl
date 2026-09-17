import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { divisionQuery } from "@/lib/queries";
import { ScheduleList } from "@/components/ScheduleList";

export const Route = createFileRoute("/divisions/$slug/schedule")({
  component: DivisionSchedulePage,
});

function DivisionSchedulePage() {
  const { slug } = Route.useParams();
  const { data: division } = useSuspenseQuery(divisionQuery(slug));

  return (
    <ScheduleList games={division.schedule} results={division.results} />
  );
}
