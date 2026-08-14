import { actionStaff } from "@/lib/actionAuth";
import { analyseImport, commitImport } from "../actions";

/**
 * The importer's transport, because a Server Action cannot carry the sheet.
 *
 * React's Flight decoder budgets every request it parses at 1,000,000 "array
 * slots", and a string sitting inside an array — which is exactly what an
 * action's argument list is — spends its own `.length` from that budget:
 *
 *   react-server-dom-webpack-server.node.development.js
 *     5577:  null !== arrayRoot && bumpArrayCount(arrayRoot, value.length, response);
 *     4761:  (arrayContext.count += slots) > response._arraySizeLimit && throw
 *     5590:  arraySizeLimit = ... : 1e6
 *
 * `demo-sample.csv` is 1,149,629 characters. Every import of it therefore died
 * on "Maximum array nesting exceeded" before a single row was read — a message
 * about nesting for a limit that is really about size, which is why it kept
 * pointing at the page rather than at the file.
 *
 * The limit is not configurable: `arraySizeLimit` appears nowhere in
 * `next/dist/server`, so Next never threads an option through to it. Raising
 * `serverActions.bodySizeLimit` does not help either — that is a separate
 * check, which is why lifting it to 4mb fixed the earlier 1 MB error and left
 * this one standing.
 *
 * A Route Handler reads the body itself and no Flight decoding happens, so the
 * budget never applies. Auth is unchanged: both functions call `actionStaff`
 * internally, so this adds a door, not a way around one.
 */

/** Refuse a body before reading it. Unbounded `req.text()` is a memory DoS. */
const MAX_BYTES = 16 * 1024 * 1024;

export async function POST(req: Request) {
  /*
    Checked here as well as inside the two functions, and before the body is
    read rather than after.

    Not redundancy for its own sake: an unauthenticated caller should be
    refused with 403 and a reason, not answered 200 with `ok:false` — a status
    code is what a proxy, a WAF and a log aggregator can act on. Refusing
    first also means an anonymous request never gets 16 MB of this process's
    memory to play with.
  */
  const { user } = await actionStaff("admin", "catalog");
  if (!user) {
    return Response.json(
      { ok: false, error: "Sign in as catalogue staff to import." },
      { status: 403 },
    );
  }

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) {
    return Response.json(
      { ok: false, error: `That file is larger than ${MAX_BYTES / 1024 / 1024} MB.` },
      { status: 413 },
    );
  }

  const url = new URL(req.url);
  const csv = await req.text();
  if (csv.length > MAX_BYTES) {
    return Response.json({ ok: false, error: "That file is too large." }, { status: 413 });
  }

  if (url.searchParams.get("mode") === "commit") {
    return Response.json(
      await commitImport(
        csv,
        url.searchParams.get("filename") ?? "",
        url.searchParams.get("confirm") === "1",
      ),
    );
  }

  return Response.json(await analyseImport(csv));
}
