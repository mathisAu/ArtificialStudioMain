import { NextResponse, type NextRequest } from "next/server";

import { processOutbox } from "@/lib/outbox";

/**
 * Leegt de wachtrij met uitgaande berichten (§26, §33).
 *
 * Dit endpoint hoort periodiek aangeroepen te worden, bijvoorbeeld elke vijf
 * minuten door een scheduler (Vercel Cron, GitHub Actions, of pg_cron met
 * pg_net). Het is bewust géén publieke route: zonder het juiste geheim komt er
 * niets binnen.
 *
 *   curl -X POST https://.../api/uitgaand -H "Authorization: Bearer <OUTBOX_SECRET>"
 */
export async function POST(request: NextRequest) {
  const secret = process.env.OUTBOX_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "OUTBOX_SECRET is niet ingesteld; het endpoint staat uit." },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  // Vergelijking met vaste lengte om timingverschillen niet te laten lekken.
  if (token.length !== secret.length || !timingSafeEqual(token, secret)) {
    return NextResponse.json({ error: "Geen toegang." }, { status: 401 });
  }

  try {
    const result = await processOutbox();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Wachtrij verwerken mislukt:", error);
    return NextResponse.json(
      { error: "De wachtrij kon niet worden verwerkt." },
      { status: 500 },
    );
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
