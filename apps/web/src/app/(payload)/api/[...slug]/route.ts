import config from "@payload-config";
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from "@payloadcms/next/routes";

/*
  Payload's REST API, for consumers outside this process — the eventual mobile
  client, supplier feed callbacks, the search indexer.

  The storefront itself should *not* come through here. It runs in the same
  Node process and reaches Postgres through the Local API, which skips the HTTP
  hop entirely (`docs/06-BACKEND-ARCHITECTURE.md` §1.1). Reaching for `fetch`
  against your own server is the easy mistake and it costs a round trip per
  request on a page that already renders 48 tiles.
*/
export const GET = REST_GET(config);
export const POST = REST_POST(config);
export const DELETE = REST_DELETE(config);
export const PATCH = REST_PATCH(config);
export const PUT = REST_PUT(config);
export const OPTIONS = REST_OPTIONS(config);
