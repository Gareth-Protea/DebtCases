// ┌─────────────────────────────────────────────────────────────┐
// │  COPY THIS FILE VERBATIM FROM Protea-Landlords             │
// │  server/static.ts                                           │
// │                                                             │
// │  Production static file serving                             │
// └─────────────────────────────────────────────────────────────┘

import express, { type Express } from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname =
  typeof import.meta.url === "string"
    ? path.dirname(fileURLToPath(import.meta.url))
    : path.dirname(__filename);

export function serveStatic(app: Express) {
  const publicDir = path.resolve(__dirname, "..", "dist", "public");

  if (!fs.existsSync(publicDir)) {
    console.warn(
      `Static directory not found: ${publicDir}. Run 'npm run build' first.`
    );
    return;
  }

  app.use(express.static(publicDir, { maxAge: "1d" }));

  // SPA fallback — serve index.html for all non-API routes
  app.use("*", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}
