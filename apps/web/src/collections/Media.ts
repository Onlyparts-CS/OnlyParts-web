import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CollectionConfig } from "payload";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Uploaded imagery.
 *
 * Two constraints here are not stylistic, and both will break silently if
 * someone changes them without reading this:
 *
 * 1. **Files must be served same-origin.** Every image on this site is drawn
 *    into a canvas and read back with `getImageData` by the halftone engine.
 *    A cross-origin bitmap taints the canvas and that call throws — so an S3
 *    or CDN origin has to be proxied under this domain, or served with CORS
 *    headers and fetched with `crossOrigin`.
 *
 *    Payload serves uploads from its own route — measured, an upload comes
 *    back as `/api/media/file/<name>.jpg`, not the `staticDir` path — which is
 *    same-origin and therefore safe. Moving to S3 later must preserve that.
 *
 * 2. **Licence is required and share-alike is not offered.** The screen turns
 *    every image into a derivative work, so a CC BY-SA source would attach
 *    share-alike to the storefront's own imagery. That was a live trap while
 *    sourcing placeholders (`public/parts/CREDITS.md`), and a markdown file is
 *    not a control. Making it a required enum means the trap cannot be walked
 *    into by whoever uploads next year.
 */
export const Media: CollectionConfig = {
  slug: "media",
  admin: {
    useAsTitle: "alt",
    defaultColumns: ["filename", "alt", "licence", "updatedAt"],
    group: "Catalogue",
  },
  access: {
    // Public read: these are storefront images.
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  upload: {
    staticDir: path.resolve(dirname, "../../public/media"),
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
    /*
      `face` is the size the drawer rack and the product hero actually screen.
      Measured: a halftoned photograph is legible from about 300 × 224 and
      becomes noise below that, so `thumb` exists for lists and admin tables
      and is deliberately never handed to the screen at full duotone.
    */
    imageSizes: [
      { name: "thumb", width: 400, height: undefined, position: "centre" },
      { name: "face", width: 1200, height: undefined, position: "centre" },
      { name: "hero", width: 1800, height: undefined, position: "centre" },
    ],
    adminThumbnail: "thumb",
    focalPoint: true,
  },
  fields: [
    {
      name: "alt",
      type: "text",
      required: true,
      admin: {
        description:
          "What the image shows, for someone who cannot see it. Describe the part, not the photograph.",
      },
    },
    {
      name: "licence",
      type: "select",
      required: true,
      defaultValue: "owned",
      options: [
        { label: "OnlyParts original — shot or commissioned by us", value: "owned" },
        { label: "Supplier-supplied, cleared for resale listing", value: "supplier" },
        { label: "Public domain", value: "pd" },
        { label: "CC0", value: "cc0" },
      ],
      admin: {
        description:
          "Share-alike licences (CC BY-SA) are not listed on purpose: the halftone screen makes every image here a derivative work, so share-alike would attach to our own imagery.",
      },
    },
    {
      name: "credit",
      type: "text",
      admin: {
        description: "Attribution line, where the licence requires one.",
        condition: (data) => data?.licence === "pd" || data?.licence === "cc0",
      },
    },
    {
      name: "source",
      type: "text",
      admin: {
        description: "Where it came from — a URL, a shoot reference, a supplier name.",
      },
    },
  ],
};
