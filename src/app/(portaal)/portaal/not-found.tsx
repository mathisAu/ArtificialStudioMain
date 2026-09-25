import { SearchX } from "lucide-react";
import Link from "next/link";

import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";

/**
 * Verschijnt wanneer een portaalpagina `notFound()` aanroept — meestal omdat
 * het item inmiddels is verwijderd. Anders dan de algemene 404 blijft de klant
 * hier binnen het portaal, met het menu erbij.
 */
export default function PortalNotFound() {
  return (
    <Card>
      <EmptyState
        title="Dit item is niet meer beschikbaar"
        description="Het is mogelijk verwijderd of verplaatst. Uw overige projecten, vragen en documenten vindt u gewoon via het menu."
        icon={<SearchX className="h-5 w-5" />}
      />
      <div className="flex justify-center pb-8">
        <Link href="/portaal" className={buttonClass("secondary", "sm")}>
          Naar het dashboard
        </Link>
      </div>
    </Card>
  );
}
