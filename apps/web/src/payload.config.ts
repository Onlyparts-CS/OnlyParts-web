import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import sharp from "sharp";

import { Users } from "./collections/Users";
import { Media } from "./collections/Media";
import { Brands } from "./collections/Brands";
import { Categories } from "./collections/Categories";
import { AttributeDefinitions } from "./collections/AttributeDefinitions";
import { Products } from "./collections/Products";
import { Variants } from "./collections/Variants";
import { Builds } from "./collections/Builds";
import { Inventory, InventoryMovements, Warehouses } from "./collections/Inventory";
import { Customers } from "./collections/Customers";
import { Orders } from "./collections/Orders";
import { SearchQueries } from "./collections/SearchQueries";
import { PageViews } from "./collections/PageViews";
import { ImportBatches } from "./collections/ImportBatches";
import { ImportExceptions } from "./collections/ImportExceptions";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Payload, mounted inside the Next.js app.
 *
 * Two admin surfaces, deliberately:
 *
 *   /cms    Payload's generated panel — records, fields, uploads, RBAC. This is
 *           the part Payload does better than anything hand-written.
 *   /admin  The bespoke console — the dry-run import diff, the completeness
 *           queue, the zero-result report, the project picker. Those are
 *           judgement surfaces, not CRUD, and Payload does not give them for
 *           free (`docs/06-BACKEND-ARCHITECTURE.md` §v2 decision).
 *
 * Everything here reaches Postgres through the Local API — a direct Drizzle
 * call in the same process, no HTTP hop. At 50,000 SKUs that difference is the
 * whole page budget.
 */
export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: {
      titleSuffix: "— OnlyParts",
    },
  },

  routes: {
    // `/admin` belongs to the bespoke console, which shipped first.
    admin: "/cms",
  },

  collections: [
    // Catalogue, in the order you would actually fill them.
    Categories,
    AttributeDefinitions,
    Brands,
    Products,
    Variants,
    Builds,
    ImportBatches,
    ImportExceptions,
    // Stock
    Warehouses,
    Inventory,
    InventoryMovements,
    // Selling
    Customers,
    Orders,
    SearchQueries,
    PageViews,
    // Platform
    Media,
    Users,
  ],

  editor: lexicalEditor(),

  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URI || "" },
    /*
      Dev pushes schema changes straight to the database; production runs
      migrations. Pushing against a real catalogue is how you lose a column.
    */
    push: process.env.NODE_ENV !== "production",
    migrationDir: path.resolve(dirname, "migrations"),
  }),

  // Uploads are resized on the way in — see `collections/Media`.
  sharp,

  secret: process.env.PAYLOAD_SECRET || "",

  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
});
