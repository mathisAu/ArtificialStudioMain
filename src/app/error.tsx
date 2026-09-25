"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Er ging iets mis</h1>
      <p className="mt-1.5 max-w-md text-[13px] text-muted-foreground">
        De pagina kon niet worden geladen. Probeer het opnieuw. Blijft dit gebeuren, geef
        dan door wat je deed.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-subtle-foreground">
          Referentie: {error.digest}
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-[var(--radius)] bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
      >
        Opnieuw proberen
      </button>
    </div>
  );
}
