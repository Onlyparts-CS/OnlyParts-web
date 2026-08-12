import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Nothing here is secret; these are simply pages with no crawl value,
        // and faceted URLs would burn crawl budget on near-duplicates.
        // `/cms` is the Payload panel; `/admin` is the bespoke console.
        disallow: ["/admin", "/admin/", "/cms", "/cms/", "/account", "/cart", "/checkout", "/orders/", "/rfqs/", "/search", "/api/"],
      },
    ],
    sitemap: "https://onlyparts.in/sitemap.xml",
  };
}
