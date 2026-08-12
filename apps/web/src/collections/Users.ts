import type { Access, CollectionConfig, PayloadRequest } from "payload";

/**
 * Staff accounts for the admin surfaces.
 *
 * This is *not* the customer account. A buyer signs in with a phone OTP and
 * never sees `/cms`; mixing the two into one collection is how a storefront
 * ends up with a password reset that can escalate to catalogue write access.
 * Customers get their own collection when the storefront auth lands.
 *
 * `docs/06-BACKEND-ARCHITECTURE.md` §9 requires two independent gates in
 * production — Cloudflare Access in front, Payload RBAC behind. This file is
 * the second one. It is not a substitute for the first.
 */

type Role = "admin" | "catalog" | "ops";

// Staff only. `customers` is an auth collection since Google sign-in, so
// `req.user` may be a buyer — who must never satisfy a role check. See the
// longer note in `access.ts`.
const rolesOf = (user: PayloadRequest["user"]): Role[] =>
  user && user.collection === "users" ? ((user.roles as Role[] | undefined) ?? []) : [];

/**
 * Deliberately typed on `{ req }` alone rather than as `Access`.
 *
 * Payload has three access signatures with incompatible argument types —
 * collection `Access` (whose `id` is a number and which may return a `Where`),
 * the `admin` predicate (boolean only), and `FieldAccess` (whose `id` may be a
 * string). A function that only reads `req` structurally satisfies all three,
 * so one helper covers every site instead of three near-identical ones.
 */
const hasRole =
  (...roles: Role[]) =>
  ({ req }: { req: PayloadRequest }) =>
    rolesOf(req.user).some((r) => roles.includes(r));

/** Admins see everyone; everyone else sees only their own record. */
const selfOrAdmin: Access = ({ req: { user } }) => {
  if (!user) return false;
  if (rolesOf(user).includes("admin")) return true;
  return { id: { equals: user.id } };
};

export const Users: CollectionConfig = {
  slug: "users",
  auth: {
    tokenExpiration: 60 * 60 * 8, // a working day, not a fortnight
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
  },
  admin: {
    useAsTitle: "email",
    defaultColumns: ["name", "email", "roles"],
    group: "Access",
  },
  access: {
    read: selfOrAdmin,
    create: hasRole("admin"),
    update: selfOrAdmin,
    delete: hasRole("admin"),
    // Only an admin may hand out roles, and the field below re-checks it.
    admin: hasRole("admin", "catalog", "ops"),
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "roles",
      type: "select",
      hasMany: true,
      required: true,
      defaultValue: ["catalog"],
      /*
        Field-level access, not just collection-level. Without it any user who
        can update their own record — which they must be able to, to change
        their name — can also write `roles: ['admin']` into it.
      */
      access: {
        create: hasRole("admin"),
        update: hasRole("admin"),
      },
      options: [
        { label: "Administrator — full access, manages staff", value: "admin" },
        { label: "Catalogue — products, categories, media, imports", value: "catalog" },
        { label: "Operations — orders, shipments, RFQs, quotes", value: "ops" },
      ],
    },
  ],
};
