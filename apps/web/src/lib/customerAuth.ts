import { getPayload } from "payload";
import config from "@payload-config";
import type { Customer } from "@/payload-types";
import { currentCustomerId } from "./customerSession";

/**
 * The signed-in buyer, resolved.
 *
 * Separate from `customerSession.ts` only because that file is imported by
 * `collections/Customers.ts`, and importing `@payload-config` from there would
 * close a cycle through `payload.config.ts`. The split is a build constraint,
 * not a design statement.
 */
export async function currentCustomer(): Promise<Customer | null> {
  try {
    const id = await currentCustomerId();
    if (!id) return null;

    const payload = await getPayload({ config });
    /*
      `overrideAccess` because `customers.access.read` scopes a customer to
      their own row via `req.user`, and `req.user` is precisely what this
      function is in the middle of establishing. The signed cookie is the
      narrower check that stands in for it — the same trade `orderRead.ts`
      documents.
    */
    return (await payload.findByID({
      collection: "customers",
      id,
      depth: 0,
      overrideAccess: true,
    })) as Customer;
  } catch {
    // No database, no cookie, or a customer deleted since — all "not signed in".
    return null;
  }
}

export { startCustomerSession, endCustomerSession, currentCustomerId } from "./customerSession";
