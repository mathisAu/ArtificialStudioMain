import { Skeleton, TableSkeleton } from "@/components/ui/misc";

/**
 * Wordt direct getoond bij navigatie binnen de interne omgeving, terwijl de
 * pagina zijn gegevens ophaalt. De sidebar blijft staan.
 */
export default function InternalLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Laden">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <TableSkeleton rows={8} cols={5} />
    </div>
  );
}
