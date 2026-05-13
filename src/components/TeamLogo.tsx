import { useState } from "react";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_STYLES: Record<Size, string> = {
  xs: "h-6 w-6 text-[9px]",
  sm: "h-8 w-8 text-[10px]",
  md: "h-12 w-12 text-xs",
  lg: "h-20 w-20 text-sm",
  xl: "h-28 w-28 text-base",
};

interface TeamLogoProps {
  src?: string | null;
  name: string;
  size?: Size;
  className?: string;
}

export function TeamLogo({ src, name, size = "sm", className }: TeamLogoProps) {
  const [errored, setErrored] = useState(false);
  const showImage = !!src && !errored;
  const initials = abbreviate(name);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        !showImage &&
          "rounded-md bg-muted/60 ring-1 ring-border/30 overflow-hidden",
        SIZE_STYLES[size],
        className,
      )}
      title={name}
      aria-label={name}
    >
      {showImage ? (
        <img
          src={src!}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
          onError={() => setErrored(true)}
        />
      ) : (
        <span className="font-semibold text-muted-foreground leading-none">
          {initials}
        </span>
      )}
    </span>
  );
}

function abbreviate(name: string): string {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
