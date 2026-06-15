// ┌─────────────────────────────────────────────────────────────┐
// │  COPY THIS FILE VERBATIM FROM Protea-Landlords             │
// │  script/build.ts                                            │
// │                                                             │
// │  Production build: Vite (client) + ESBuild (server)        │
// └─────────────────────────────────────────────────────────────┘

import { execSync } from "child_process";
import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

async function build() {
  console.log("Building client with Vite...");
  execSync("npx vite build", { cwd: rootDir, stdio: "inherit" });

  console.log("Building server with ESBuild...");
  await esbuild.build({
    entryPoints: [path.join(rootDir, "server", "index.ts")],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile: path.join(rootDir, "dist", "index.cjs"),
    external: [
      "express",
      "express-session",
      "session-file-store",
      "xml2js",
      "bcryptjs",
      "drizzle-orm",
      "dotenv",
    ],
    sourcemap: true,
    tsconfig: path.join(rootDir, "tsconfig.json"),
  });

  console.log("Build complete! Output in dist/");
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
