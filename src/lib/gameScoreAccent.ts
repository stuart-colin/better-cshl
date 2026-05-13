/**
 * Tailwind class for a team's goal total on a scoreboard row.
 * Win = green, regulation loss = inherit (caller applies muted), tie or OTL = yellow.
 */
export function goalNumberClass(
  side: "home" | "away",
  o: {
    homeScore: number;
    awayScore: number;
    overtime: boolean;
    tie: boolean;
  },
): string | undefined {
  const { homeScore, awayScore, overtime, tie } = o;
  if (tie || homeScore === awayScore) return "text-yellow-400";
  if (homeScore > awayScore) {
    return side === "home"
      ? "text-emerald-400"
      : overtime
        ? "text-yellow-400"
        : undefined;
  }
  if (awayScore > homeScore) {
    return side === "away"
      ? "text-emerald-400"
      : overtime
        ? "text-yellow-400"
        : undefined;
  }
  return undefined;
}
