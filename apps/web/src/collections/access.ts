import type { PayloadRequest } from "payload";

/**
 * Shared access predicates.
 *
 * Typed on `{ req }` alone rather than as `Access`, because Payload has three
 * incompatible access signatures — collection `Access` (whose `id` is a number
 * and which may return a `Where`), the `admin` predicate (boolean only), and
 * `FieldAccess` (whose `id` may be a string). A function that reads only `req`
 * structurally satisfies all three, so one helper covers every call site.
 */
export type Role = "admin" | "catalog" | "ops";

/**
 * Roles, and only ever a staff member's.
 *
 * `customers` became an auth collection when Google sign-in landed, so
 * `req.user` is now `User | Customer` and a buyer arrives here as a perfectly
 * valid authenticated user. The collection check is what keeps this honest: a
 * customer has no `roles` field, so without it every `hasRole` call would be
 * reading `undefined` off a buyer and — far worse — any future code that adds
 * a `roles` field to customers would hand them catalogue write access.
 */
export const rolesOf = (user: PayloadRequest["user"]): Role[] => {
  if (!user || user.collection !== "users") return [];
  return (user.roles as Role[] | undefined) ?? [];
};

export const hasRole =
  (...roles: Role[]) =>
  ({ req }: { req: PayloadRequest }) =>
    rolesOf(req.user).some((r) => roles.includes(r));

/** The storefront reads the catalogue without signing in. */
export const anyone = () => true;

export const authenticated = ({ req }: { req: PayloadRequest }) => Boolean(req.user);

/** Catalogue write is the `catalog` role's whole job; admins can do anything. */
export const catalogWrite = hasRole("admin", "catalog");
