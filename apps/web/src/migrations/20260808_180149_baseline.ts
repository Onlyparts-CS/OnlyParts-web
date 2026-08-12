import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_attribute_definitions_type" AS ENUM('text', 'number', 'boolean', 'enum', 'dimension');
  CREATE TYPE "public"."enum_attribute_definitions_facet_style" AS ENUM('checkbox', 'range', 'swatch');
  CREATE TYPE "public"."enum_products_variant_axes" AS ENUM('thread', 'length_mm', 'material', 'head_type', 'drive_type', 'finish', 'bore_id_mm', 'outer_od_mm', 'voltage_v', 'capacity_mah', 'size', 'colour');
  CREATE TYPE "public"."enum_products_media_role" AS ENUM('hero', 'gallery', 'scale', 'drawing', 'datasheet');
  CREATE TYPE "public"."enum_products_status" AS ENUM('draft', 'active', 'archived');
  CREATE TYPE "public"."enum_products_gst_rate" AS ENUM('0', '5', '12', '18', '28');
  CREATE TYPE "public"."enum_products_country_of_origin" AS ENUM('India', 'China', 'Taiwan', 'Hong Kong', 'Japan', 'South Korea', 'Vietnam', 'Malaysia', 'Thailand', 'Singapore', 'Indonesia', 'Philippines', 'Germany', 'Italy', 'France', 'United Kingdom', 'Switzerland', 'Netherlands', 'Czech Republic', 'Poland', 'Turkey', 'Israel', 'United States', 'Canada', 'Mexico', 'Brazil', 'Australia');
  CREATE TYPE "public"."enum_variants_price_tiers_customer_group" AS ENUM('', 'b2b', 'institution');
  CREATE TYPE "public"."enum_import_batches_rows_kind" AS ENUM('create', 'update');
  CREATE TYPE "public"."enum_import_batches_status" AS ENUM('applied', 'reverted');
  CREATE TYPE "public"."enum_import_exceptions_status" AS ENUM('open', 'resolved', 'ignored');
  CREATE TYPE "public"."enum_inventory_movements_reason" AS ENUM('purchase', 'sale', 'return', 'adjustment', 'damage', 'transfer', 'count', 'production');
  CREATE TYPE "public"."enum_customers_tier" AS ENUM('retail', 'b2b', 'institution');
  CREATE TYPE "public"."enum_orders_channel" AS ENUM('web', 'manual', 'rfq');
  CREATE TYPE "public"."enum_orders_status" AS ENUM('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned');
  CREATE TYPE "public"."enum_orders_payment_status" AS ENUM('pending', 'authorized', 'paid', 'failed', 'refunded', 'partially_refunded');
  CREATE TYPE "public"."enum_orders_payment_method" AS ENUM('upi', 'card', 'netbanking', 'cod', 'neft');
  CREATE TYPE "public"."enum_search_queries_triage" AS ENUM('untriaged', 'missing_product', 'missing_synonym', 'parser_gap', 'noise');
  CREATE TYPE "public"."enum_media_licence" AS ENUM('owned', 'supplier', 'pd', 'cc0');
  CREATE TYPE "public"."enum_users_roles" AS ENUM('admin', 'catalog', 'ops');
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"parent_id" integer,
  	"depth" numeric,
  	"path" varchar,
  	"blurb" varchar,
  	"glyph" varchar,
  	"hero_image_id" integer,
  	"position" numeric DEFAULT 0,
  	"is_active" boolean DEFAULT true,
  	"product_count" numeric DEFAULT 0,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "attribute_definitions_enum_values" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar
  );
  
  CREATE TABLE "attribute_definitions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"category_id" integer NOT NULL,
  	"key" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"type" "enum_attribute_definitions_type" DEFAULT 'text' NOT NULL,
  	"unit" varchar,
  	"is_variant_axis" boolean DEFAULT false,
  	"is_facet" boolean DEFAULT true,
  	"is_searchable" boolean DEFAULT true,
  	"is_required" boolean DEFAULT false,
  	"facet_style" "enum_attribute_definitions_facet_style" DEFAULT 'checkbox',
  	"position" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "brands" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"logo_id" integer,
  	"is_generic" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_variant_axes" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_products_variant_axes",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "products_media" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"role" "enum_products_media_role" DEFAULT 'gallery'
  );
  
  CREATE TABLE "products" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"subtitle" varchar,
  	"description" jsonb,
  	"status" "enum_products_status" DEFAULT 'draft' NOT NULL,
  	"published_at" timestamp(3) with time zone,
  	"brand_id" integer,
  	"primary_category_id" integer NOT NULL,
  	"hsn_code" varchar NOT NULL,
  	"gst_rate" "enum_products_gst_rate" DEFAULT '18' NOT NULL,
  	"country_of_origin" "enum_products_country_of_origin",
  	"mrp" numeric,
  	"net_quantity" varchar,
  	"importer_name" varchar,
  	"importer_address" varchar,
  	"is_made_to_order" boolean DEFAULT false,
  	"lead_time_days" numeric,
  	"search_boost" numeric DEFAULT 1,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"rating_avg" numeric,
  	"rating_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer
  );
  
  CREATE TABLE "variants_price_tiers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"min_qty" numeric NOT NULL,
  	"unit_price" numeric NOT NULL,
  	"customer_group" "enum_variants_price_tiers_customer_group"
  );
  
  CREATE TABLE "variants_attributes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"definition_id" integer NOT NULL,
  	"value_text" varchar,
  	"value_number" numeric,
  	"value_bool" boolean
  );
  
  CREATE TABLE "variants" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"sku" varchar NOT NULL,
  	"title_suffix" varchar,
  	"mpn" varchar,
  	"barcode" varchar,
  	"base_price" numeric NOT NULL,
  	"compare_at" numeric,
  	"cost_price" numeric,
  	"weight_g" numeric NOT NULL,
  	"length_mm" numeric,
  	"width_mm" numeric,
  	"height_mm" numeric,
  	"pack_size" numeric DEFAULT 1,
  	"moq" numeric DEFAULT 1,
  	"qty_increment" numeric DEFAULT 1,
  	"position" numeric DEFAULT 0,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "builds_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"note" varchar,
  	"position" numeric DEFAULT 0
  );
  
  CREATE TABLE "builds" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"blurb" varchar,
  	"glyph" varchar,
  	"hero_image_id" integer,
  	"position" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "import_batches_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"kind" "enum_import_batches_rows_kind" NOT NULL,
  	"sku" varchar NOT NULL,
  	"variant_id" integer,
  	"product_id" integer,
  	"before" jsonb,
  	"builds_added" varchar
  );
  
  CREATE TABLE "import_batches" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"filename" varchar NOT NULL,
  	"at" timestamp(3) with time zone NOT NULL,
  	"actor" varchar,
  	"created" numeric DEFAULT 0 NOT NULL,
  	"updated" numeric DEFAULT 0 NOT NULL,
  	"status" "enum_import_batches_status" DEFAULT 'applied' NOT NULL,
  	"reverted_at" timestamp(3) with time zone,
  	"reverted_by" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "import_exceptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"sku" varchar NOT NULL,
  	"source" varchar NOT NULL,
  	"at" timestamp(3) with time zone NOT NULL,
  	"batch_id" integer,
  	"reasons" varchar NOT NULL,
  	"row" jsonb,
  	"status" "enum_import_exceptions_status" DEFAULT 'open' NOT NULL,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "warehouses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"state_code" varchar NOT NULL,
  	"pincode" varchar NOT NULL,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "inventory" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"variant_id" integer NOT NULL,
  	"warehouse_id" integer NOT NULL,
  	"on_hand" numeric DEFAULT 0,
  	"allocated" numeric DEFAULT 0,
  	"reserved" numeric DEFAULT 0,
  	"reorder_point" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "inventory_movements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"variant_id" integer NOT NULL,
  	"warehouse_id" integer NOT NULL,
  	"delta" numeric NOT NULL,
  	"reason" "enum_inventory_movements_reason" NOT NULL,
  	"reference_type" varchar,
  	"reference_id" varchar,
  	"note" varchar,
  	"actor_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "customers_addresses" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"name" varchar NOT NULL,
  	"phone" varchar NOT NULL,
  	"line1" varchar NOT NULL,
  	"line2" varchar,
  	"city" varchar NOT NULL,
  	"state_code" varchar NOT NULL,
  	"pincode" varchar NOT NULL,
  	"is_default" boolean
  );
  
  CREATE TABLE "customers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"phone" varchar,
  	"google_sub" varchar,
  	"email_verified" boolean DEFAULT false,
  	"name" varchar NOT NULL,
  	"email" varchar,
  	"company" varchar,
  	"gstin" varchar,
  	"tier" "enum_customers_tier" DEFAULT 'retail',
  	"order_count" numeric DEFAULT 0,
  	"lifetime_value" numeric DEFAULT 0,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "orders_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"variant_id" integer,
  	"sku" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"qty" numeric NOT NULL,
  	"unit_price" numeric NOT NULL,
  	"line_total" numeric NOT NULL,
  	"hsn_code" varchar NOT NULL,
  	"gst_rate" numeric NOT NULL,
  	"taxable" numeric NOT NULL,
  	"cgst" numeric DEFAULT 0,
  	"sgst" numeric DEFAULT 0,
  	"igst" numeric DEFAULT 0
  );
  
  CREATE TABLE "orders_events" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"at" timestamp(3) with time zone NOT NULL,
  	"kind" varchar NOT NULL,
  	"actor" varchar,
  	"detail" varchar NOT NULL
  );
  
  CREATE TABLE "orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" varchar,
  	"placed_at" timestamp(3) with time zone,
  	"channel" "enum_orders_channel" DEFAULT 'web',
  	"status" "enum_orders_status" DEFAULT 'pending' NOT NULL,
  	"payment_status" "enum_orders_payment_status" DEFAULT 'pending' NOT NULL,
  	"customer_id" integer,
  	"customer_name" varchar NOT NULL,
  	"customer_phone" varchar NOT NULL,
  	"customer_email" varchar,
  	"gstin" varchar,
  	"place_of_supply" varchar NOT NULL,
  	"ship_to_name" varchar NOT NULL,
  	"ship_to_phone" varchar NOT NULL,
  	"ship_to_line1" varchar NOT NULL,
  	"ship_to_line2" varchar,
  	"ship_to_city" varchar NOT NULL,
  	"ship_to_state_code" varchar NOT NULL,
  	"ship_to_pincode" varchar NOT NULL,
  	"subtotal" numeric NOT NULL,
  	"shipping" numeric DEFAULT 0 NOT NULL,
  	"taxable" numeric NOT NULL,
  	"grand_total" numeric NOT NULL,
  	"cgst" numeric DEFAULT 0,
  	"sgst" numeric DEFAULT 0,
  	"igst" numeric DEFAULT 0,
  	"invoice_number" varchar,
  	"invoice_date" timestamp(3) with time zone,
  	"payment_method" "enum_orders_payment_method",
  	"gateway_order_id" varchar,
  	"gateway_payment_id" varchar,
  	"staff_notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "search_queries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"q" varchar NOT NULL,
  	"result_count" numeric NOT NULL,
  	"count" numeric DEFAULT 1 NOT NULL,
  	"last_seen" timestamp(3) with time zone NOT NULL,
  	"triage" "enum_search_queries_triage" DEFAULT 'untriaged' NOT NULL,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"licence" "enum_media_licence" DEFAULT 'owned' NOT NULL,
  	"credit" varchar,
  	"source" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumb_url" varchar,
  	"sizes_thumb_width" numeric,
  	"sizes_thumb_height" numeric,
  	"sizes_thumb_mime_type" varchar,
  	"sizes_thumb_filesize" numeric,
  	"sizes_thumb_filename" varchar,
  	"sizes_face_url" varchar,
  	"sizes_face_width" numeric,
  	"sizes_face_height" numeric,
  	"sizes_face_mime_type" varchar,
  	"sizes_face_filesize" numeric,
  	"sizes_face_filename" varchar,
  	"sizes_hero_url" varchar,
  	"sizes_hero_width" numeric,
  	"sizes_hero_height" numeric,
  	"sizes_hero_mime_type" varchar,
  	"sizes_hero_filesize" numeric,
  	"sizes_hero_filename" varchar
  );
  
  CREATE TABLE "users_roles" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_roles",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer,
  	"attribute_definitions_id" integer,
  	"brands_id" integer,
  	"products_id" integer,
  	"variants_id" integer,
  	"builds_id" integer,
  	"import_batches_id" integer,
  	"import_exceptions_id" integer,
  	"warehouses_id" integer,
  	"inventory_id" integer,
  	"inventory_movements_id" integer,
  	"customers_id" integer,
  	"orders_id" integer,
  	"search_queries_id" integer,
  	"media_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"customers_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "attribute_definitions_enum_values" ADD CONSTRAINT "attribute_definitions_enum_values_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."attribute_definitions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "attribute_definitions" ADD CONSTRAINT "attribute_definitions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "brands" ADD CONSTRAINT "brands_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_variant_axes" ADD CONSTRAINT "products_variant_axes_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_media" ADD CONSTRAINT "products_media_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_media" ADD CONSTRAINT "products_media_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_primary_category_id_categories_id_fk" FOREIGN KEY ("primary_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "variants_price_tiers" ADD CONSTRAINT "variants_price_tiers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "variants_attributes" ADD CONSTRAINT "variants_attributes_definition_id_attribute_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."attribute_definitions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "variants_attributes" ADD CONSTRAINT "variants_attributes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "variants" ADD CONSTRAINT "variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "builds_items" ADD CONSTRAINT "builds_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "builds_items" ADD CONSTRAINT "builds_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."builds"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "builds" ADD CONSTRAINT "builds_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "import_batches_rows" ADD CONSTRAINT "import_batches_rows_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "import_batches_rows" ADD CONSTRAINT "import_batches_rows_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "import_batches_rows" ADD CONSTRAINT "import_batches_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "import_exceptions" ADD CONSTRAINT "import_exceptions_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inventory" ADD CONSTRAINT "inventory_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inventory" ADD CONSTRAINT "inventory_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "customers_addresses" ADD CONSTRAINT "customers_addresses_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_lines" ADD CONSTRAINT "orders_lines_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders_lines" ADD CONSTRAINT "orders_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_events" ADD CONSTRAINT "orders_events_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_attribute_definitions_fk" FOREIGN KEY ("attribute_definitions_id") REFERENCES "public"."attribute_definitions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_brands_fk" FOREIGN KEY ("brands_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_variants_fk" FOREIGN KEY ("variants_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_builds_fk" FOREIGN KEY ("builds_id") REFERENCES "public"."builds"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_import_batches_fk" FOREIGN KEY ("import_batches_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_import_exceptions_fk" FOREIGN KEY ("import_exceptions_id") REFERENCES "public"."import_exceptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_warehouses_fk" FOREIGN KEY ("warehouses_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inventory_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_inventory_movements_fk" FOREIGN KEY ("inventory_movements_id") REFERENCES "public"."inventory_movements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_orders_fk" FOREIGN KEY ("orders_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_search_queries_fk" FOREIGN KEY ("search_queries_id") REFERENCES "public"."search_queries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");
  CREATE INDEX "categories_depth_idx" ON "categories" USING btree ("depth");
  CREATE UNIQUE INDEX "categories_path_idx" ON "categories" USING btree ("path");
  CREATE INDEX "categories_hero_image_idx" ON "categories" USING btree ("hero_image_id");
  CREATE INDEX "categories_position_idx" ON "categories" USING btree ("position");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE UNIQUE INDEX "parent_slug_idx" ON "categories" USING btree ("parent_id","slug");
  CREATE INDEX "attribute_definitions_enum_values_order_idx" ON "attribute_definitions_enum_values" USING btree ("_order");
  CREATE INDEX "attribute_definitions_enum_values_parent_id_idx" ON "attribute_definitions_enum_values" USING btree ("_parent_id");
  CREATE INDEX "attribute_definitions_category_idx" ON "attribute_definitions" USING btree ("category_id");
  CREATE INDEX "attribute_definitions_key_idx" ON "attribute_definitions" USING btree ("key");
  CREATE INDEX "attribute_definitions_updated_at_idx" ON "attribute_definitions" USING btree ("updated_at");
  CREATE INDEX "attribute_definitions_created_at_idx" ON "attribute_definitions" USING btree ("created_at");
  CREATE UNIQUE INDEX "category_key_idx" ON "attribute_definitions" USING btree ("category_id","key");
  CREATE UNIQUE INDEX "brands_slug_idx" ON "brands" USING btree ("slug");
  CREATE INDEX "brands_logo_idx" ON "brands" USING btree ("logo_id");
  CREATE INDEX "brands_updated_at_idx" ON "brands" USING btree ("updated_at");
  CREATE INDEX "brands_created_at_idx" ON "brands" USING btree ("created_at");
  CREATE INDEX "products_variant_axes_order_idx" ON "products_variant_axes" USING btree ("order");
  CREATE INDEX "products_variant_axes_parent_idx" ON "products_variant_axes" USING btree ("parent_id");
  CREATE INDEX "products_media_order_idx" ON "products_media" USING btree ("_order");
  CREATE INDEX "products_media_parent_id_idx" ON "products_media" USING btree ("_parent_id");
  CREATE INDEX "products_media_image_idx" ON "products_media" USING btree ("image_id");
  CREATE INDEX "products_title_idx" ON "products" USING btree ("title");
  CREATE UNIQUE INDEX "products_slug_idx" ON "products" USING btree ("slug");
  CREATE INDEX "products_status_idx" ON "products" USING btree ("status");
  CREATE INDEX "products_brand_idx" ON "products" USING btree ("brand_id");
  CREATE INDEX "products_primary_category_idx" ON "products" USING btree ("primary_category_id");
  CREATE INDEX "products_hsn_code_idx" ON "products" USING btree ("hsn_code");
  CREATE INDEX "products_country_of_origin_idx" ON "products" USING btree ("country_of_origin");
  CREATE INDEX "products_updated_at_idx" ON "products" USING btree ("updated_at");
  CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");
  CREATE INDEX "products_rels_order_idx" ON "products_rels" USING btree ("order");
  CREATE INDEX "products_rels_parent_idx" ON "products_rels" USING btree ("parent_id");
  CREATE INDEX "products_rels_path_idx" ON "products_rels" USING btree ("path");
  CREATE INDEX "products_rels_categories_id_idx" ON "products_rels" USING btree ("categories_id");
  CREATE INDEX "variants_price_tiers_order_idx" ON "variants_price_tiers" USING btree ("_order");
  CREATE INDEX "variants_price_tiers_parent_id_idx" ON "variants_price_tiers" USING btree ("_parent_id");
  CREATE INDEX "variants_attributes_order_idx" ON "variants_attributes" USING btree ("_order");
  CREATE INDEX "variants_attributes_parent_id_idx" ON "variants_attributes" USING btree ("_parent_id");
  CREATE INDEX "variants_attributes_definition_idx" ON "variants_attributes" USING btree ("definition_id");
  CREATE INDEX "variants_product_idx" ON "variants" USING btree ("product_id");
  CREATE UNIQUE INDEX "variants_sku_idx" ON "variants" USING btree ("sku");
  CREATE INDEX "variants_updated_at_idx" ON "variants" USING btree ("updated_at");
  CREATE INDEX "variants_created_at_idx" ON "variants" USING btree ("created_at");
  CREATE INDEX "builds_items_order_idx" ON "builds_items" USING btree ("_order");
  CREATE INDEX "builds_items_parent_id_idx" ON "builds_items" USING btree ("_parent_id");
  CREATE INDEX "builds_items_product_idx" ON "builds_items" USING btree ("product_id");
  CREATE UNIQUE INDEX "builds_slug_idx" ON "builds" USING btree ("slug");
  CREATE INDEX "builds_hero_image_idx" ON "builds" USING btree ("hero_image_id");
  CREATE INDEX "builds_updated_at_idx" ON "builds" USING btree ("updated_at");
  CREATE INDEX "builds_created_at_idx" ON "builds" USING btree ("created_at");
  CREATE INDEX "import_batches_rows_order_idx" ON "import_batches_rows" USING btree ("_order");
  CREATE INDEX "import_batches_rows_parent_id_idx" ON "import_batches_rows" USING btree ("_parent_id");
  CREATE INDEX "import_batches_rows_variant_idx" ON "import_batches_rows" USING btree ("variant_id");
  CREATE INDEX "import_batches_rows_product_idx" ON "import_batches_rows" USING btree ("product_id");
  CREATE INDEX "import_batches_status_idx" ON "import_batches" USING btree ("status");
  CREATE INDEX "import_batches_updated_at_idx" ON "import_batches" USING btree ("updated_at");
  CREATE INDEX "import_batches_created_at_idx" ON "import_batches" USING btree ("created_at");
  CREATE INDEX "status_at_idx" ON "import_batches" USING btree ("status","at");
  CREATE INDEX "import_exceptions_sku_idx" ON "import_exceptions" USING btree ("sku");
  CREATE INDEX "import_exceptions_batch_idx" ON "import_exceptions" USING btree ("batch_id");
  CREATE INDEX "import_exceptions_status_idx" ON "import_exceptions" USING btree ("status");
  CREATE INDEX "import_exceptions_updated_at_idx" ON "import_exceptions" USING btree ("updated_at");
  CREATE INDEX "import_exceptions_created_at_idx" ON "import_exceptions" USING btree ("created_at");
  CREATE INDEX "status_at_1_idx" ON "import_exceptions" USING btree ("status","at");
  CREATE UNIQUE INDEX "warehouses_code_idx" ON "warehouses" USING btree ("code");
  CREATE INDEX "warehouses_updated_at_idx" ON "warehouses" USING btree ("updated_at");
  CREATE INDEX "warehouses_created_at_idx" ON "warehouses" USING btree ("created_at");
  CREATE INDEX "inventory_variant_idx" ON "inventory" USING btree ("variant_id");
  CREATE INDEX "inventory_warehouse_idx" ON "inventory" USING btree ("warehouse_id");
  CREATE INDEX "inventory_updated_at_idx" ON "inventory" USING btree ("updated_at");
  CREATE INDEX "inventory_created_at_idx" ON "inventory" USING btree ("created_at");
  CREATE UNIQUE INDEX "variant_warehouse_idx" ON "inventory" USING btree ("variant_id","warehouse_id");
  CREATE INDEX "inventory_movements_variant_idx" ON "inventory_movements" USING btree ("variant_id");
  CREATE INDEX "inventory_movements_warehouse_idx" ON "inventory_movements" USING btree ("warehouse_id");
  CREATE INDEX "inventory_movements_actor_idx" ON "inventory_movements" USING btree ("actor_id");
  CREATE INDEX "inventory_movements_updated_at_idx" ON "inventory_movements" USING btree ("updated_at");
  CREATE INDEX "inventory_movements_created_at_idx" ON "inventory_movements" USING btree ("created_at");
  CREATE INDEX "customers_addresses_order_idx" ON "customers_addresses" USING btree ("_order");
  CREATE INDEX "customers_addresses_parent_id_idx" ON "customers_addresses" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");
  CREATE UNIQUE INDEX "customers_google_sub_idx" ON "customers" USING btree ("google_sub");
  CREATE INDEX "customers_updated_at_idx" ON "customers" USING btree ("updated_at");
  CREATE INDEX "customers_created_at_idx" ON "customers" USING btree ("created_at");
  CREATE INDEX "orders_lines_order_idx" ON "orders_lines" USING btree ("_order");
  CREATE INDEX "orders_lines_parent_id_idx" ON "orders_lines" USING btree ("_parent_id");
  CREATE INDEX "orders_lines_variant_idx" ON "orders_lines" USING btree ("variant_id");
  CREATE INDEX "orders_events_order_idx" ON "orders_events" USING btree ("_order");
  CREATE INDEX "orders_events_parent_id_idx" ON "orders_events" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "orders_number_idx" ON "orders" USING btree ("number");
  CREATE INDEX "orders_placed_at_idx" ON "orders" USING btree ("placed_at");
  CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");
  CREATE INDEX "orders_payment_status_idx" ON "orders" USING btree ("payment_status");
  CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");
  CREATE INDEX "orders_customer_phone_idx" ON "orders" USING btree ("customer_phone");
  CREATE UNIQUE INDEX "orders_invoice_number_idx" ON "orders" USING btree ("invoice_number");
  CREATE INDEX "orders_gateway_order_id_idx" ON "orders" USING btree ("gateway_order_id");
  CREATE INDEX "orders_gateway_payment_id_idx" ON "orders" USING btree ("gateway_payment_id");
  CREATE INDEX "orders_updated_at_idx" ON "orders" USING btree ("updated_at");
  CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");
  CREATE INDEX "status_placedAt_idx" ON "orders" USING btree ("status","placed_at");
  CREATE INDEX "paymentStatus_placedAt_idx" ON "orders" USING btree ("payment_status","placed_at");
  CREATE UNIQUE INDEX "search_queries_q_idx" ON "search_queries" USING btree ("q");
  CREATE INDEX "search_queries_result_count_idx" ON "search_queries" USING btree ("result_count");
  CREATE INDEX "search_queries_last_seen_idx" ON "search_queries" USING btree ("last_seen");
  CREATE INDEX "search_queries_triage_idx" ON "search_queries" USING btree ("triage");
  CREATE INDEX "search_queries_updated_at_idx" ON "search_queries" USING btree ("updated_at");
  CREATE INDEX "search_queries_created_at_idx" ON "search_queries" USING btree ("created_at");
  CREATE INDEX "resultCount_count_idx" ON "search_queries" USING btree ("result_count","count");
  CREATE INDEX "triage_count_idx" ON "search_queries" USING btree ("triage","count");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumb_sizes_thumb_filename_idx" ON "media" USING btree ("sizes_thumb_filename");
  CREATE INDEX "media_sizes_face_sizes_face_filename_idx" ON "media" USING btree ("sizes_face_filename");
  CREATE INDEX "media_sizes_hero_sizes_hero_filename_idx" ON "media" USING btree ("sizes_hero_filename");
  CREATE INDEX "users_roles_order_idx" ON "users_roles" USING btree ("order");
  CREATE INDEX "users_roles_parent_idx" ON "users_roles" USING btree ("parent_id");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_attribute_definitions_id_idx" ON "payload_locked_documents_rels" USING btree ("attribute_definitions_id");
  CREATE INDEX "payload_locked_documents_rels_brands_id_idx" ON "payload_locked_documents_rels" USING btree ("brands_id");
  CREATE INDEX "payload_locked_documents_rels_products_id_idx" ON "payload_locked_documents_rels" USING btree ("products_id");
  CREATE INDEX "payload_locked_documents_rels_variants_id_idx" ON "payload_locked_documents_rels" USING btree ("variants_id");
  CREATE INDEX "payload_locked_documents_rels_builds_id_idx" ON "payload_locked_documents_rels" USING btree ("builds_id");
  CREATE INDEX "payload_locked_documents_rels_import_batches_id_idx" ON "payload_locked_documents_rels" USING btree ("import_batches_id");
  CREATE INDEX "payload_locked_documents_rels_import_exceptions_id_idx" ON "payload_locked_documents_rels" USING btree ("import_exceptions_id");
  CREATE INDEX "payload_locked_documents_rels_warehouses_id_idx" ON "payload_locked_documents_rels" USING btree ("warehouses_id");
  CREATE INDEX "payload_locked_documents_rels_inventory_id_idx" ON "payload_locked_documents_rels" USING btree ("inventory_id");
  CREATE INDEX "payload_locked_documents_rels_inventory_movements_id_idx" ON "payload_locked_documents_rels" USING btree ("inventory_movements_id");
  CREATE INDEX "payload_locked_documents_rels_customers_id_idx" ON "payload_locked_documents_rels" USING btree ("customers_id");
  CREATE INDEX "payload_locked_documents_rels_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("orders_id");
  CREATE INDEX "payload_locked_documents_rels_search_queries_id_idx" ON "payload_locked_documents_rels" USING btree ("search_queries_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_customers_id_idx" ON "payload_preferences_rels" USING btree ("customers_id");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "categories" CASCADE;
  DROP TABLE "attribute_definitions_enum_values" CASCADE;
  DROP TABLE "attribute_definitions" CASCADE;
  DROP TABLE "brands" CASCADE;
  DROP TABLE "products_variant_axes" CASCADE;
  DROP TABLE "products_media" CASCADE;
  DROP TABLE "products" CASCADE;
  DROP TABLE "products_rels" CASCADE;
  DROP TABLE "variants_price_tiers" CASCADE;
  DROP TABLE "variants_attributes" CASCADE;
  DROP TABLE "variants" CASCADE;
  DROP TABLE "builds_items" CASCADE;
  DROP TABLE "builds" CASCADE;
  DROP TABLE "import_batches_rows" CASCADE;
  DROP TABLE "import_batches" CASCADE;
  DROP TABLE "import_exceptions" CASCADE;
  DROP TABLE "warehouses" CASCADE;
  DROP TABLE "inventory" CASCADE;
  DROP TABLE "inventory_movements" CASCADE;
  DROP TABLE "customers_addresses" CASCADE;
  DROP TABLE "customers" CASCADE;
  DROP TABLE "orders_lines" CASCADE;
  DROP TABLE "orders_events" CASCADE;
  DROP TABLE "orders" CASCADE;
  DROP TABLE "search_queries" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "users_roles" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_attribute_definitions_type";
  DROP TYPE "public"."enum_attribute_definitions_facet_style";
  DROP TYPE "public"."enum_products_variant_axes";
  DROP TYPE "public"."enum_products_media_role";
  DROP TYPE "public"."enum_products_status";
  DROP TYPE "public"."enum_products_gst_rate";
  DROP TYPE "public"."enum_products_country_of_origin";
  DROP TYPE "public"."enum_variants_price_tiers_customer_group";
  DROP TYPE "public"."enum_import_batches_rows_kind";
  DROP TYPE "public"."enum_import_batches_status";
  DROP TYPE "public"."enum_import_exceptions_status";
  DROP TYPE "public"."enum_inventory_movements_reason";
  DROP TYPE "public"."enum_customers_tier";
  DROP TYPE "public"."enum_orders_channel";
  DROP TYPE "public"."enum_orders_status";
  DROP TYPE "public"."enum_orders_payment_status";
  DROP TYPE "public"."enum_orders_payment_method";
  DROP TYPE "public"."enum_search_queries_triage";
  DROP TYPE "public"."enum_media_licence";
  DROP TYPE "public"."enum_users_roles";`)
}
