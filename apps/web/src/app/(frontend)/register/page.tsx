import { redirect } from "next/navigation";

/**
 * There is no separate registration any more.
 *
 * This page used to collect a name, email, phone and password, validate that
 * the password was eight characters long, and then call the client-side
 * `signIn()` — creating nothing anywhere and signing in a user who did not
 * exist. With Google as the only sign-in method, first sign-in *is*
 * registration: the callback creates the customer row when it does not find
 * one, from claims Google has already verified.
 *
 * Kept as a redirect rather than deleted because the link is in the footer, in
 * old emails and probably in somebody's bookmarks, and a 404 for "create an
 * account" is a worse answer than the sign-in page.
 */
export default function RegisterPage() {
  redirect("/login");
}
