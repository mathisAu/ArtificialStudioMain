import { cn } from "@/lib/utils";

/**
 * Het merkteken: een oneindigheidslus in het verloop uit het logo.
 *
 * Bewust als SVG en niet als afbeelding: het schaalt scherp mee op elk formaat
 * en op retina-schermen, en het verloop gebruikt dezelfde variabelen als de
 * rest van de interface, zodat het in licht en donker klopt.
 *
 * Wil je het originele bestand gebruiken, zet het dan in `public/logo.svg` en
 * vervang de inhoud van `LogoMark` door een <Image>.
 */
export function LogoMark({
  className,
  title = "Artificial Studio",
}: {
  className?: string;
  title?: string;
}) {
  // Elke instantie heeft een eigen verloop-id, anders pakken meerdere logo's
  // op één pagina allemaal de eerste definitie.
  const id = `merk-${title.replace(/\W+/g, "")}`;

  return (
    <svg
      viewBox="0 0 64 34"
      role="img"
      aria-label={title}
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0.35">
          <stop offset="0%" stopColor="var(--brand-1)" />
          <stop offset="52%" stopColor="var(--brand-2)" />
          <stop offset="100%" stopColor="var(--brand-3)" />
        </linearGradient>
      </defs>

      {/*
        Een lemniscaat in één doorlopende lijn: van links omhoog, door het
        midden gekruist, om de rechterlus heen en weer terug.
      */}
      <path
        d="M32 17
           C 26 8, 20 4, 14.5 4
           C 8 4, 4 9.8, 4 17
           C 4 24.2, 8 30, 14.5 30
           C 20 30, 26 26, 32 17
           C 38 8, 44 4, 49.5 4
           C 56 4, 60 9.8, 60 17
           C 60 24.2, 56 30, 49.5 30
           C 44 30, 38 26, 32 17
           Z"
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth="7.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Merkteken plus woordmerk, zoals op het logo. */
export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  /** Compact toont een kleiner woordmerk, voor in de sidebar. */
  compact?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={compact ? "h-6 w-11" : "h-9 w-16"} />

      <span className="min-w-0 leading-none">
        <span
          className={cn(
            "block font-bold uppercase tracking-[0.14em] text-foreground",
            compact ? "text-[12px]" : "text-base",
          )}
        >
          Artificial
        </span>
        <span
          className={cn(
            "text-brand block font-semibold uppercase",
            compact
              ? "mt-0.5 text-[8px] tracking-[0.3em]"
              : "mt-1 text-[10px] tracking-[0.42em]",
          )}
        >
          Studio
        </span>
      </span>
    </span>
  );
}
