"use client";

import { Logo } from "@/components/Logo";
import { AuthCanvas } from "@/components/auth/AuthCanvas";

/**
 * Shared shell for sign-in, registration and the signed-out account state.
 *
 * It used to be a 384px card centred in a full viewport, which left most of the
 * screen empty and the supporting copy stranded in the middle of nothing. The
 * form is now a column of its own with the copy left-aligned beside it, and the
 * space that was empty carries a pointer-reactive panel. Below `lg` the panel
 * drops out entirely and the form takes the width — nothing on a phone should
 * pay for a decoration.
 *
 * Lifted out of `login/page.tsx`, which used to export it. That page became a
 * server component when Google sign-in replaced the prototype form, and a
 * server component cannot hand a client component to other client components.
 */
export function Shell({ title, lead, children }: {
  title: string; lead?: string; children: React.ReactNode;
}) {
  return (
    <div className="container-page py-12 lg:py-16">
      <div className="mx-auto grid max-w-6xl items-stretch gap-8 lg:grid-cols-[28rem_minmax(0,1fr)] lg:gap-14">
        <div className="mx-auto flex flex-col justify-center w-full max-w-md lg:mx-0">
          <Logo />
          <h1 className="mt-6 text-[clamp(1.75rem,3vw,2.25rem)] font-bold tracking-tight text-heading">{title}</h1>
          {lead && <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-muted">{lead}</p>}
          <div className="mt-6 rounded-lg border border-line bg-surface p-6 shadow-e2">{children}</div>
        </div>

        <AuthCanvas />
      </div>
    </div>
  );
}

export function Field({
  label, value, onChange, type = "text", prefix, inputMode, mono, disabled, autoComplete,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
  prefix?: string; inputMode?: "text" | "numeric" | "email"; mono?: boolean;
  disabled?: boolean; autoComplete?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-faint">{label}</label>
      <div className={`flex h-11 items-center rounded-sm border border-line bg-surface focus-within:border-spot-600 ${disabled ? "opacity-60" : ""}`}>
        {prefix && <span className="pl-3 font-mono text-[0.8125rem] text-disabled">{prefix}</span>}
        <input
          type={type} value={value} inputMode={inputMode} disabled={disabled} autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className={`h-full w-full bg-transparent px-3 text-[0.9375rem] text-heading outline-none ${mono ? "font-mono tracking-[0.2em]" : ""}`}
        />
      </div>
    </div>
  );
}
