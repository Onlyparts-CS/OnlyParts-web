import type { CollectionConfig } from "payload";
import { anyone, catalogWrite } from "./access";

/**
 * The category tree. Three levels, no more.
 *
 * `depth` and `path` are derived — never typed by hand — because they are the
 * two fields every read depends on and the two a human will get wrong. `path`
 * is a materialised path (`fasteners.screws_by_head.socket_head`) so a subtree
 * is one prefix scan instead of a recursive CTE.
 *
 * `07-DATA-MODEL.md` §2.1 specifies a Postgres `ltree` column with a GiST
 * index. This stores it as **text** instead, deliberately: Payload's Drizzle
 * adapter has no ltree field type, and at 475 nodes a b-tree prefix scan on
 * text is not the bottleneck — a category read is cached and the catalogue
 * tree changes a few times a year. Converting the column to `ltree` and adding
 * the GiST index is a migration, worth doing when the tree grows or when
 * `<@` semantics are actually needed. It is not worth a custom field type now.
 */

const MAX_DEPTH = 3;

export const Categories: CollectionConfig = {
  slug: "categories",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "path", "depth", "productCount"],
    group: "Catalogue",
  },
  access: { read: anyone, create: catalogWrite, update: catalogWrite, delete: catalogWrite },

  /* Two siblings cannot share a slug; two cousins can. */
  indexes: [{ fields: ["parent", "slug"], unique: true }],

  hooks: {
    beforeChange: [
      async ({ data, req, originalDoc, operation }) => {
        const parentId = data.parent ?? null;

        if (!parentId) {
          data.depth = 1;
          data.path = data.slug;
          return data;
        }

        const parent = await req.payload.findByID({
          collection: "categories",
          id: typeof parentId === "object" ? parentId.id : parentId,
          depth: 0,
          req,
        });

        /*
          A cycle is not merely invalid, it hangs every subtree read. Cheapest
          reliable check: the parent's own path already contains this node.
        */
        const self = originalDoc?.slug ?? data.slug;
        if (operation === "update" && originalDoc) {
          const segs = String(parent.path ?? "").split(".");
          if (segs.includes(String(originalDoc.slug))) {
            throw new Error(
              `"${self}" cannot sit under "${parent.slug}" — that would make the tree a loop.`,
            );
          }
        }

        const depth = (parent.depth ?? 1) + 1;
        if (depth > MAX_DEPTH) {
          throw new Error(
            `Depth ${depth} exceeds the ${MAX_DEPTH}-level limit (02-TAXONOMY.md §1.6). ` +
              `"${parent.name}" is already at level ${parent.depth}.`,
          );
        }

        data.depth = depth;
        data.path = `${parent.path}.${data.slug}`;
        return data;
      },
    ],

    afterChange: [
      /*
        A rename or a move rewrites every descendant's path. Done here rather
        than in a database trigger so the whole thing stays in one language and
        one place — the trees are small and moves are rare.
      */
      async ({ doc, previousDoc, req, operation }) => {
        if (operation !== "update") return;
        if (previousDoc?.path === doc.path) return;

        const descendants = await req.payload.find({
          collection: "categories",
          where: { path: { like: `${previousDoc.path}.%` } },
          limit: 1000,
          depth: 0,
          req,
        });

        for (const child of descendants.docs) {
          const rewritten = String(child.path).replace(previousDoc.path, doc.path);
          await req.payload.update({
            collection: "categories",
            id: child.id,
            data: { path: rewritten, depth: rewritten.split(".").length },
            req,
            // the beforeChange above would recompute from the parent anyway;
            // this keeps the sweep to one write per node
            context: { skipPathRecompute: true },
          });
        }
      },
    ],
  },

  fields: [
    { name: "name", type: "text", required: true },
    {
      /*
        Unique within its parent, not globally — see `indexes` below.

        `07-DATA-MODEL.md` §2.1 specifies a globally unique slug, and the real
        taxonomy will not have it: "Electronics" is a shelf under Motors *and*
        under 3D Printing Supplies; "Stepper Drivers" is a leaf under both.
        Forcing global uniqueness means inventing `electronics-motors`, which
        then leaks into the URL and reads as a workaround.

        Nothing needs it. A category is addressed by its full path — `/c/motors/
        electronics` — so the path is what must be unique, and it is.
      */
      name: "slug",
      type: "text",
      required: true,
      index: true,
      admin: { description: "Lowercase, hyphenated. Unique among its siblings, not globally." },
    },
    {
      name: "parent",
      type: "relationship",
      relationTo: "categories",
      index: true,
      admin: { description: "Empty for a top-level drawer. Maximum three levels." },
    },
    {
      name: "depth",
      type: "number",
      index: true,
      admin: { readOnly: true, description: "Derived. 1 = drawer, 2 = shelf, 3 = leaf." },
    },
    {
      name: "path",
      type: "text",
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: "Derived materialised path, globally unique. Subtree query: path LIKE '<root>.%'.",
      },
    },
    { name: "blurb", type: "textarea", admin: { description: "One line, shown on the drawer face." } },
    {
      name: "glyph",
      type: "text",
      admin: { description: "Key into the drawn plate set — see src/lib/plates.ts." },
    },
    {
      name: "heroImage",
      type: "upload",
      relationTo: "media",
      admin: {
        description:
          "Screened through the halftone engine. Needs ≥1200px: below about 300px wide a screened photograph is noise.",
      },
    },
    { name: "position", type: "number", defaultValue: 0, index: true },
    { name: "isActive", type: "checkbox", defaultValue: true },
    {
      name: "productCount",
      type: "number",
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: "Denormalised, refreshed by a job. Never trust it for correctness.",
      },
    },
    {
      type: "collapsible",
      label: "SEO",
      fields: [
        { name: "seoTitle", type: "text" },
        { name: "seoDescription", type: "textarea" },
      ],
    },
  ],
};
