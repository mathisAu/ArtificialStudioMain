import "server-only";

import { revalidatePath } from "next/cache";

/**
 * Cache-invalidatie over beide omgevingen heen.
 *
 * Bijna elk gegeven bestaat op twee plekken: intern op `/feedback` en voor de
 * klant op `/portaal/feedback`. Wordt alleen het interne pad ververst, dan ziet
 * de klant de wijziging pas na een harde refresh — dat is de oorzaak van
 * "status verandert niet" en "de nieuwe update is niet te openen".
 */
const MIRRORED_SEGMENTS = new Set([
  "acties",
  "documenten",
  "facturen",
  "feedback",
  "notificaties",
  "projecten",
  "vragen",
]);

/**
 * Ververst een pad in de interne omgeving én het bijbehorende portaalpad.
 *
 * `paths` zijn interne paden (`/feedback/123`). Lege waarden worden genegeerd,
 * zodat een optionele `project_id` direct doorgegeven kan worden.
 */
export function revalidateShared(...paths: (string | null | undefined)[]) {
  const done = new Set<string>();

  const mark = (path: string) => {
    if (done.has(path)) return;
    done.add(path);
    revalidatePath(path);
  };

  for (const path of paths) {
    if (!path) continue;
    mark(path);

    const segment = path.split("/")[1] ?? "";
    if (MIRRORED_SEGMENTS.has(segment)) mark(`/portaal${path}`);
  }

  // De overzichtstellers op beide startpagina's lopen anders achter.
  mark("/dashboard");
  mark("/portaal");
}
