import Link from "next/link";
import { ROLE_LABEL, type Staff, type StaffRole } from "@/lib/adminAuth";

/**
 * The wall a staff member hits at a door their roles do not open.
 *
 * Two states, because they are two different problems. Signed out is a task —
 * go and sign in. Wrong role is not: there is nothing the person can do about
 * it themselves, so the screen names who to ask instead of offering a button
 * that will fail again.
 *
 * This used to be unreachable code, in the sense that it did not exist: the
 * console gated on *having a session* and nothing else, so `ops` saw every
 * catalogue screen and only discovered the truth when a save failed.
 */
export function Denied({ staff, needed }: { staff: Staff | null; needed: readonly StaffRole[] }) {
  const roles = needed.map((r) => ROLE_LABEL[r]);
  const list = roles.length > 1 ? `${roles.slice(0, -1).join(", ")} or ${roles.at(-1)}` : roles[0];

  if (!staff) {
    return (
      <Panel label="Restricted" title="Staff only">
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">
          This console writes to the live catalogue, so it sits behind the same sign-in
          as the CMS. No customer account reaches it.
        </p>
        {/*
          `redirect` is Payload's own login param. Without it, signing in from
          here lands on the CMS dashboard and you have to find your way back —
          which is the wrong end of the building from the door you knocked on.
        */}
        <Link href="/cms/login?redirect=%2Fadmin" className="btn btn-primary mt-6">Sign in</Link>
      </Panel>
    );
  }

  return (
    <Panel label="Not your desk" title="Different role needed">
      <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">
        This screen is for the <span className="font-medium text-heading">{list}</span> role.
        You are signed in as <span className="font-mono text-[0.875rem] text-spot-700">{staff.email}</span>
        {staff.roles.length > 0 && (
          <> with {staff.roles.map((r) => ROLE_LABEL[r]).join(" and ")}</>
        )}.
      </p>
      <p className="mt-3 text-[0.8125rem] leading-relaxed text-faint">
        An administrator can change this under Access → Users in the CMS.
      </p>
      <Link href="/admin" className="btn btn-secondary mt-6">Back to overview</Link>
    </Panel>
  );
}

function Panel({ label, title, children }: {
  label: string; title: string; children: React.ReactNode;
}) {
  return (
    <div className="container-page page-shell">
      <div className="mx-auto max-w-lg border border-line bg-surface p-8 text-center shadow-e1">
        <p className="bin mb-3">{label}</p>
        <h1 className="monumental text-[clamp(1.5rem,3vw,2.25rem)]">{title}</h1>
        {children}
      </div>
    </div>
  );
}
