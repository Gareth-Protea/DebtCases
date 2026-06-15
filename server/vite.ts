// ┌─────────────────────────────────────────────────────────────┐
// │  COPY THIS FILE VERBATIM FROM Protea-Landlords             │
// │  server/vite.ts                                             │
// │                                                             │
// │  Vite dev middleware integration for Express                │
// └─────────────────────────────────────────────────────────────┘

import type { Express } from "express";
import type { Server } from "http";
import { createServer as createViteServer, type ViteDevServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname =
  typeof import.meta.url === "string"
    ? path.dirname(fileURLToPath(import.meta.url))
    : path.dirname(__filename);

export async function setupVite(app: Express, server: Server) {
  const vite: ViteDevServer = await createViteServer({
    configFile: path.resolve(__dirname, "..", "vite.config.ts"),
    server: {
      middlewareMode: true,
      hmr: { server },
    },
    appType: "spa",
  });

  app.use(vite.middlewares);

  // Fallback: serve index.html for all non-API routes (SPA)
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    if (url.startsWith("/api")) return next();

    try {
      const htmlPath = path.resolve(__dirname, "..", "client", "index.html");
      let html = await vite.transformIndexHtml(
        url,
        await import("fs").then((fs) => fs.readFileSync(htmlPath, "utf-8"))
      );
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
