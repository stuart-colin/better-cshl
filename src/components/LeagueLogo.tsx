import { cn } from "@/lib/utils";

/**
 * The CSHL ships two logo files on their Weebly:
 *   - `wordmark`: the full "Cranston Senior Hockey League" banner with
 *     stylized cyan/white CRANSTON wordmark wrapped around the shield.
 *     Use this for hero / large-format placement.
 *   - `shield`:   the standalone shield mark (black border, white fill,
 *     cyan slash). Reads cleanly down to ~24px, ideal for nav chrome.
 *
 * The file is named "white-logo" upstream but the strokes are actually
 * black — "white" refers to the shield's interior fill.
 */
const WORDMARK_SRC =
  "https://www.thecshl.com/uploads/1/2/4/6/124656697/2025-26-cshl-logo-2-orig_orig.png";
const SHIELD_DARK_SRC =
  "https://www.thecshl.com/uploads/1/2/4/6/124656697/cshl-logo-png-2022_orig.png";

interface LeagueLogoProps {
  variant?: "wordmark" | "shield";
  className?: string;
}

export function LeagueLogo({
  variant = "shield",
  className,
}: LeagueLogoProps) {
  const src = variant === "wordmark" ? WORDMARK_SRC : SHIELD_DARK_SRC;
  return (
    <img
      src={src}
      alt="CSHL"
      className={cn("object-contain", className)}
      loading="lazy"
    />
  );
}
