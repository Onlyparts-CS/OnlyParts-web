import { can, rolesFor, type Staff, type StaffRole } from "../src/lib/adminAuth";

/**
 * The access table, asserted.
 *
 * `can()` and `rolesFor()` decide who reaches which admin surface, and until
 * this file existed nothing exercised them — the roles were declared, the
 * helper was exported, and no call site or test ever ran it. A permission
 * model nobody checks is a permission model that quietly stops matching the
 * nav beside it.
 *
 *   npm run payload -- run scripts/rbac-check.ts
 */

const staff = (...roles: StaffRole[]): Staff => ({
  id: 1, email: "t@onlyparts.local", roles,
});

const admin = staff("admin");
const catalog = staff("catalog");
const ops = staff("ops");
const noRole = staff();

type Case = [label: string, actual: boolean, expected: boolean];

const surface = (path: string, who: Staff | null) => {
  const needed = rolesFor(path);
  return !needed || can(who, ...needed);
};

const cases: Case[] = [
  // Catalogue surfaces — admin and catalog only.
  ["admin    → /admin/pim", surface("/admin/pim", admin), true],
  ["catalog  → /admin/pim", surface("/admin/pim", catalog), true],
  ["ops      → /admin/pim", surface("/admin/pim", ops), false],
  ["no role  → /admin/pim", surface("/admin/pim", noRole), false],
  ["anon     → /admin/pim", surface("/admin/pim", null), false],

  ["catalog  → /admin/products", surface("/admin/products", catalog), true],
  ["ops      → /admin/products", surface("/admin/products", ops), false],
  ["catalog  → /admin/import", surface("/admin/import", catalog), true],
  ["ops      → /admin/import", surface("/admin/import", ops), false],

  // Nested paths inherit their parent's rule — this is the one that would
  // silently open if `rolesFor` matched exactly instead of by prefix.
  ["ops      → /admin/products/new", surface("/admin/products/new", ops), false],
  ["ops      → /admin/products/1/variants", surface("/admin/products/1/variants", ops), false],
  ["catalog  → /admin/products/1/variants", surface("/admin/products/1/variants", catalog), true],

  // Order surfaces — admin and ops only. Not built yet; the table is.
  ["ops      → /admin/orders", surface("/admin/orders", ops), true],
  ["catalog  → /admin/orders", surface("/admin/orders", catalog), false],
  ["ops      → /admin/customers", surface("/admin/customers", ops), true],
  ["catalog  → /admin/customers", surface("/admin/customers", catalog), false],

  // Unlisted surfaces are open to any signed-in staff member by design.
  ["ops      → /admin", surface("/admin", ops), true],
  ["catalog  → /admin/queues", surface("/admin/queues", catalog), true],

  // A path that merely starts with the same letters is not a child.
  ["ops      → /admin/productsomething", surface("/admin/productsomething", ops), true],
];

let failed = 0;
for (const [label, actual, expected] of cases) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}  →  ${actual ? "allow" : "deny"}`);
}

console.log(`\n${cases.length - failed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
