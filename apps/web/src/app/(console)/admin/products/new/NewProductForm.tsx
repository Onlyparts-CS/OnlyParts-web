"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Halftone } from "@/components/Halftone";
import { PLATE_FOR_GLYPH } from "@/lib/plates";
import { createProduct, templateFor, type TemplateField } from "./actions";

/* ============================================================
   New product — the form, not the audit.
   ------------------------------------------------------------
   Modelled on Shopify's product form on purpose: one page, top
   to bottom, in the order the thing appears on the storefront,
   with a live preview of what a buyer will see beside it.

   The enrichment workbench answers "which rows are incomplete".
   This answers "how do I add one", which is the question anybody
   new actually has, and which the workbench could not answer at
   all — it could only link you into the CMS.

   The rigour survives, invisibly. The **Specs** section is
   generated from the chosen category's attribute template, so
   filling it in populates typed columns that the facet rail can
   range-query. Nobody has to learn the words "attribute
   definition" to get that right; they see "Thread" and "Length
   (mm)" and fill them in.
   ============================================================ */

export type Leaf = { id: number | string; name: string; path: string; trail: string };
export type BrandOpt = { id: number | string; name: string };

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);

export function NewProductForm({ leaves, brands }: { leaves: Leaf[]; brands: BrandOpt[] }) {
  const [f, setF] = useState({
    title: "", slug: "", description: "", categoryId: "", brandId: "",
    hsnCode: "", gstRate: "18", price: "", compareAt: "",
    sku: "", stock: "0", weightG: "",
  });
  const [specs, setSpecs] = useState<Record<string, string>>({});
  // Held per category rather than cleared in an effect: clearing it there is a
  // synchronous setState inside the effect body, which React 19 flags, and the
  // empty case is derivable anyway.
  const [fetched, setFetched] = useState<TemplateField[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ slug: string } | null>(null);
  const [pending, start] = useTransition();
  // the slug follows the title until somebody edits it by hand
  const [slugTouched, setSlugTouched] = useState(false);

  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const category = useMemo(() => leaves.find((l) => String(l.id) === f.categoryId), [leaves, f.categoryId]);

  useEffect(() => {
    if (!category) return;
    let live = true;
    templateFor(category.path).then((t) => { if (live) setFetched(t); });
    return () => { live = false; };
  }, [category]);

  const template = category ? fetched : [];

  const submit = (publish: boolean) => {
    setErrors({});
    start(async () => {
      const res = await createProduct({
        ...f,
        categoryPath: category?.path ?? "",
        specs,
        publish,
      });
      if (res.ok) setDone({ slug: res.slug });
      else setErrors(res.errors);
    });
  };

  if (done) {
    return (
      <div className="mx-auto max-w-lg border border-success/30 bg-success-bg p-8 text-center">
        <p className="bin mb-3 text-success">Saved</p>
        <h2 className="monumental text-[clamp(1.5rem,3vw,2rem)]">{f.title}</h2>
        <p className="mt-3 text-[0.875rem] text-muted">
          Filed under {category?.trail}. Its page is <span className="font-mono text-spot-700">/p/{done.slug}</span>.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href={`/p/${done.slug}`} className="btn btn-primary btn-sm">View it</Link>
          <button onClick={() => { setDone(null); setF({ ...f, title: "", slug: "", sku: "", price: "" }); setSpecs({}); }}
            className="btn btn-secondary btn-sm">Add another</button>
          <Link href="/admin/products" className="btn btn-ghost btn-sm">All products</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid gap-6">
        {errors._ && (
          <p role="alert" className="border border-danger/40 bg-danger-bg p-3 text-[0.875rem] text-danger">{errors._}</p>
        )}

        <Card title="What it is" note="This is the heading and the first paragraph on the product page.">
          <Field label="Product name" error={errors.title}
            hint="How an engineer says it out loud: thread × length, type, material.">
            <input value={f.title} placeholder="M3 × 10mm Hex Socket Head Cap Screw, SS 304"
              onChange={(e) => {
                set("title")(e.target.value);
                if (!slugTouched) set("slug")(slugify(e.target.value));
              }}
              className={input(errors.title)} />
          </Field>

          <Field label="Web address" error={errors.slug} hint="Where the page lives. Changing it later breaks old links.">
            <div className="flex items-center gap-0">
              <span className="flex h-10 items-center border border-r-0 border-line bg-sunken px-2.5 font-mono text-[0.75rem] text-faint">/p/</span>
              <input value={f.slug} onChange={(e) => { setSlugTouched(true); set("slug")(slugify(e.target.value)); }}
                className={input(errors.slug) + " font-mono"} />
            </div>
          </Field>

          <Field label="Short description" hint="One or two lines under the title. Say what it is for, not what it is.">
            <textarea value={f.description} onChange={(e) => set("description")(e.target.value)} rows={3}
              placeholder="Hex drive, full thread, A2 stainless. The default fastener for 2020 extrusion and printer frames."
              className={input() + " h-auto py-2"} />
          </Field>
        </Card>

        <Card title="Where it lives" note="Decides the breadcrumb, the facet rail, and which specs we ask you for.">
          <Field label="Shelf" error={errors.categoryId} hint="Products file on leaves — the deepest level.">
            <select value={f.categoryId} onChange={(e) => { set("categoryId")(e.target.value); setSpecs({}); }}
              className={input(errors.categoryId)}>
              <option value="">Choose a shelf…</option>
              {leaves.map((l) => <option key={String(l.id)} value={String(l.id)}>{l.trail}</option>)}
            </select>
          </Field>
          <Field label="Brand" hint="Leave as Unbranded for commodity stock — most fasteners.">
            <select value={f.brandId} onChange={(e) => set("brandId")(e.target.value)} className={input()}>
              <option value="">Unbranded</option>
              {brands.map((b) => <option key={String(b.id)} value={String(b.id)}>{b.name}</option>)}
            </select>
          </Field>
        </Card>

        <Card
          title="Specs"
          note={category
            ? `These are the specs buyers filter ${category.name} by. Filling them is what makes this part findable.`
            : "Pick a shelf first — each one asks for different specs."}
        >
          {!category ? (
            <p className="text-[0.8125rem] text-faint">Nothing to fill in yet.</p>
          ) : template.length === 0 ? (
            <p className="text-[0.8125rem] text-faint">
              This shelf has no spec template yet. You can still save the product.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {template.map((t) => (
                <Field key={t.key}
                  label={`${t.label}${t.unit ? ` (${t.unit})` : ""}${t.isRequired ? " *" : ""}`}
                  error={errors[`spec.${t.key}`]}>
                  {t.enumValues.length > 0 ? (
                    <select value={specs[t.key] ?? ""} onChange={(e) => setSpecs((p) => ({ ...p, [t.key]: e.target.value }))}
                      className={input(errors[`spec.${t.key}`])}>
                      <option value="">—</option>
                      {t.enumValues.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  ) : (
                    <input value={specs[t.key] ?? ""}
                      inputMode={t.type === "number" || t.type === "dimension" ? "decimal" : "text"}
                      onChange={(e) => setSpecs((p) => ({ ...p, [t.key]: e.target.value }))}
                      className={input(errors[`spec.${t.key}`])} />
                  )}
                </Field>
              ))}
            </div>
          )}
        </Card>

        <Card title="Price" note="Type rupees. We store paise, so nothing ever rounds against the invoice.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price for one (₹, incl. GST)" error={errors.price} hint="Bulk breaks are added after saving.">
              <input value={f.price} inputMode="decimal" placeholder="3.10"
                onChange={(e) => set("price")(e.target.value)} className={input(errors.price) + " font-mono"} />
            </Field>
            <Field label="Was (₹)" hint="Only for a genuine former price. Shown struck through.">
              <input value={f.compareAt} inputMode="decimal" onChange={(e) => set("compareAt")(e.target.value)}
                className={input() + " font-mono"} />
            </Field>
            <Field label="HSN code" error={errors.hsnCode} hint="Eight digits. It prints on every GST invoice line.">
              <input value={f.hsnCode} inputMode="numeric" placeholder="73181500"
                onChange={(e) => set("hsnCode")(e.target.value)} className={input(errors.hsnCode) + " font-mono"} />
            </Field>
            <Field label="GST rate">
              <select value={f.gstRate} onChange={(e) => set("gstRate")(e.target.value)} className={input() + " font-mono"}>
                {["0", "5", "12", "18", "28"].map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            </Field>
          </div>
        </Card>

        <Card title="Stock and shipping" note="Opening stock is recorded as a dated movement, not a number you can quietly edit later.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="SKU" error={errors.sku} hint="What buyers paste into search and BOMs.">
              <input value={f.sku} placeholder="FS-SHC-M3-010-SS304"
                onChange={(e) => set("sku")(e.target.value.toUpperCase())} className={input(errors.sku) + " font-mono"} />
            </Field>
            <Field label="Opening stock" error={errors.stock} hint="Zero means made to order, not hidden.">
              <input value={f.stock} inputMode="numeric" onChange={(e) => set("stock")(e.target.value)}
                className={input(errors.stock) + " font-mono"} />
            </Field>
            <Field label="Weight (g)" error={errors.weightG} hint="Decides the shipping charge.">
              <input value={f.weightG} inputMode="decimal" onChange={(e) => set("weightG")(e.target.value)}
                className={input(errors.weightG) + " font-mono"} />
            </Field>
          </div>
        </Card>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => submit(true)} disabled={pending} className="btn btn-primary">
            {pending ? "Saving…" : "Save and publish"}
          </button>
          <button onClick={() => submit(false)} disabled={pending} className="btn btn-secondary">
            Save as draft
          </button>
        </div>
      </div>

      {/* ---------- what the buyer sees ---------- */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <p className="overline mb-2">Buyer&rsquo;s view</p>
        <div className="card-index flex flex-col">
          <span aria-hidden className="tab tab-sm" />
          <div className="border-b border-line">
            <span className="block aspect-square w-full overflow-hidden bg-bg">
              <Halftone plate={PLATE_FOR_GLYPH.hex ?? "screw"} cell={5} className="h-full w-full" />
            </span>
          </div>
          <div className="flex flex-1 flex-col p-3">
            <h3 className="line-clamp-2 text-[0.8125rem] font-medium leading-snug text-heading">
              {f.title || "Your product name appears here"}
            </h3>
            <div className="bin mt-1.5 truncate">⌗ {f.sku || "SKU-PENDING"}</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-lg font-bold tnum text-heading">
                ₹{f.price || "0.00"}
              </span>
              {f.compareAt && (
                <span className="font-mono text-[0.6875rem] text-disabled line-through tnum">₹{f.compareAt}</span>
              )}
            </div>
            <span className="bin mt-2">
              {Number(f.stock) > 0 ? `${f.stock} in stock` : "Made to order"}
            </span>
          </div>
        </div>

        <ul className="mt-4 grid gap-1.5 text-[0.75rem] leading-relaxed text-faint">
          <li>Breadcrumb · {category?.trail ?? "— pick a shelf"}</li>
          <li>Page · /p/{f.slug || "…"}</li>
          <li>
            Specs filled · {template.filter((t) => (specs[t.key] ?? "").trim()).length} of {template.length}
            {template.some((t) => t.isRequired) && ` (${template.filter((t) => t.isRequired).length} required)`}
          </li>
        </ul>
      </aside>
    </div>
  );
}

const input = (err?: string) =>
  `h-10 w-full rounded-sm border bg-surface px-3 text-[0.875rem] text-heading outline-none transition-colors placeholder:text-disabled focus:border-spot-600 ${
    err ? "border-danger" : "border-line"
  }`;

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-line bg-surface p-5 shadow-e1">
      <h2 className="text-[1.0625rem] text-heading">{title}</h2>
      {note && <p className="mb-4 mt-1 text-[0.8125rem] leading-relaxed text-muted">{note}</p>}
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, error, children }: {
  label: string; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.8125rem] font-medium text-heading">{label}</span>
      {children}
      {error
        ? <span className="mt-1 block text-[0.75rem] text-danger">{error}</span>
        : hint && <span className="mt-1 block text-[0.75rem] text-faint">{hint}</span>}
    </label>
  );
}
