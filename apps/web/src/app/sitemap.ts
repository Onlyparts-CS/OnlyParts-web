import type { MetadataRoute } from "next";
import { allPaths } from "@/lib/taxonomy";
import { dbAllSkus } from "@/lib/catalogDb";
import { POLICIES, GUIDES } from "@/lib/content";
import { PROJECTS } from "@/lib/catalog";

const BASE = "https://onlyparts.in";

/**
 * Every indexable URL. Faceted category URLs are deliberately absent — they are
 * noindex,follow except for a curated allowlist (docs/05 §9), and that allowlist
 * is managed in the admin rather than generated here.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const statics: MetadataRoute.Sitemap = ([
    { url: BASE, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/c`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/make`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/make/rfq`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/contact`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/faq`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/guides`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/bulk-orders`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/careers`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/track`, changeFrequency: "yearly", priority: 0.3 },
  ] satisfies MetadataRoute.Sitemap).map((e) => ({ ...e, lastModified: now }));

  const categories: MetadataRoute.Sitemap = allPaths().map((p) => ({
    url: `${BASE}/c/${p.join("/")}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: p.length === 1 ? 0.9 : p.length === 2 ? 0.8 : 0.7,
  }));

  const products: MetadataRoute.Sitemap = (await dbAllSkus()).map((s) => ({
    url: `${BASE}/p/${s.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const content: MetadataRoute.Sitemap = [
    ...GUIDES.map((g) => ({ url: `${BASE}/guides/${g.slug}`, priority: 0.7 })),
    ...POLICIES.map((p) => ({ url: `${BASE}/policies/${p.slug}`, priority: 0.4 })),
    ...PROJECTS.map((p) => ({ url: `${BASE}/projects/${p.slug}`, priority: 0.8 })),
  ].map((e) => ({ ...e, lastModified: now, changeFrequency: "monthly" as const }));

  return [...statics, ...categories, ...content, ...products];
}
