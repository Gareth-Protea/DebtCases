import "dotenv/config";
import express from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import FileStore from "session-file-store";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const httpServer = createServer(app);

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const FileStoreSession = FileStore(session);

// Works in both ESM (dev with tsx) and CJS (production bundle)
const __dirname =
  typeof import.meta.url === "string"
    ? path.dirname(fileURLToPath(import.meta.url))
    : path.dirname(__filename);

const sessionsDir = path.join(__dirname, "..", ".sessions");

declare module "express-session" {
  interface SessionData {
    adminUserId: number;
    adminUsername: string;
    adminAccessLevel: number;
  }
}

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-this-before-going-live",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
    store: new FileStoreSession({
      path: sessionsDir,
      ttl: 30 * 24 * 60 * 60,
      retries: 3,
      reapInterval: -1, // prevents EPERM errors on Windows/OneDrive
      logFn: () => {},
    }),
  })
);

export function log(message: string, source = "express") {
  const time = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${time} [${source}] ${message}`);
}

(async () => {
  // Ensure the follow‑up status exists in the database before any routes
  // are registered. This call is idempotent and will not duplicate rows.
  try {
    const { ensureStatusExists } = await import("./config/managerSettings.ts");
    await ensureStatusExists("FOLLOW_UP_7D", "7 day follow up wait");
  } catch (err) {
    log(`Failed to ensure status exists: ${err}`, "startup");
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: any, res: any, _next: any) => {
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ message: err.message || "Internal Server Error" });
  });

  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, httpServer);
  } else {
    serveStatic(app);
  }

  const port = 5000;
  httpServer.listen(port, () => {
    log(`serving on port ${port}`);
  });
})();
