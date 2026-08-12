import assert from "node:assert/strict";
import { originValue, packerLabel, NOT_DECLARED } from "./legal.ts";

/**
 * Run: `node src/lib/legal.check.ts` from `apps/web`.
 *
 * Every case here is a wrong declaration rather than a wrong pixel. The failure
 * mode this file exists to prevent is a listing that states an origin nobody
 * verified — which is the offence Rule 6(1) punishes, where an omission is not.
 */

/* a real origin prints as itself */
{
  assert.equal(originValue({ countryOfOrigin: "China" }), "China");
  assert.equal(originValue({ countryOfOrigin: "India" }), "India");
}

/* absent, undefined and empty-string all mean the same thing, and it is not a country */
{
  assert.equal(originValue(undefined), NOT_DECLARED);
  assert.equal(originValue({}), NOT_DECLARED);
  assert.equal(originValue({ countryOfOrigin: "" }), NOT_DECLARED);
}

/* the fallback must never be a country — a default of "India" is the bug this guards */
{
  for (const legal of [undefined, {}, { countryOfOrigin: "" }]) {
    assert.doesNotMatch(originValue(legal), /india|china|taiwan/i);
  }
}

/* the packer label carries the import claim, so it has three cases and not two */
{
  assert.equal(packerLabel("India"), "Packed by");
  assert.equal(packerLabel("China"), "Imported by");
  assert.equal(packerLabel("Germany"), "Imported by");
}

/* unknown origin must not assert "Imported by" — that is the claim we cannot make */
{
  assert.equal(packerLabel(undefined), "Packed / imported by");
  assert.equal(packerLabel(""), "Packed / imported by");
  assert.doesNotMatch(packerLabel(undefined), /^Imported by$|^Packed by$/);
}

console.log("legal.check.ts — ok");
