import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dist = path.join(root, "frontend", "dist");
const outAssets = path.join(root, "assets");

if (!fs.existsSync(dist)) {
  console.error("Missing frontend/dist — run `npm run build` in frontend first.");
  process.exit(1);
}

/**
 * Vite writes hashed chunks to `dist/assets/*` and `index.html` references `/assets/...`.
 * Cloudflare Pages serves from repo root, so we need `./assets/<chunk>.js` — NOT `./assets/assets/...`
 * (copying all of `dist/` into `./assets/` nested bundles one level too deep and breaks production).
 */
fs.rmSync(outAssets, { recursive: true, force: true });
fs.mkdirSync(outAssets, { recursive: true });

const distAssets = path.join(dist, "assets");
if (fs.existsSync(distAssets)) {
  fs.cpSync(distAssets, outAssets, { recursive: true });
}

fs.copyFileSync(path.join(dist, "index.html"), path.join(root, "index.html"));

// Static files Vite emits next to index.html (from `public/`)
for (const name of fs.readdirSync(dist)) {
  if (name === "assets" || name === "index.html") continue;
  const src = path.join(dist, name);
  const dest = path.join(root, name);
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(src, dest, { recursive: true });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log("Synced frontend/dist → ./assets/ (flat), root index.html, and public files.");
