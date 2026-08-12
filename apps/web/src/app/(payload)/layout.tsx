import type { ServerFunctionClient } from "payload";
import config from "@payload-config";
import "@payloadcms/next/css";
import { handleServerFunctions, RootLayout } from "@payloadcms/next/layouts";
import React from "react";

import { importMap } from "./cms/importMap.js";

/**
 * Payload's root layout — a *second* root layout, beside `(frontend)`.
 *
 * Both render their own `<html>` and `<body>`, which is only legal because
 * there is no `app/layout.tsx` above them (Next: "any layout without a
 * layout.js above it is a root layout"). The storefront's typography, tokens
 * and paper ground stop at this boundary and Payload's own stylesheet takes
 * over — which is correct. The admin panel is a tool, not a shopfront, and
 * dressing it in the cabinet world would cost legibility for nothing.
 *
 * Crossing between the two is a full page load. That is fine: nobody walks
 * from a product page into the CMS mid-task.
 */
const serverFunction: ServerFunctionClient = async function (args) {
  "use server";
  return handleServerFunctions({ ...args, config, importMap });
};

export default function PayloadLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
      {children}
    </RootLayout>
  );
}
