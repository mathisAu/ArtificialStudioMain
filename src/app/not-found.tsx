import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-medium text-accent">404</p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">Pagina niet gevonden</h1>
      <p className="mt-1.5 max-w-sm text-[13px] text-muted-foreground">
        Deze pagina bestaat niet (meer) of is verwijderd, of je hebt er geen toegang toe.
      </p>
      <Link
        href="/"
        className="mt-5 rounded-[var(--radius)] bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
      >
        Terug naar start
      </Link>
    </div>
  );
}
