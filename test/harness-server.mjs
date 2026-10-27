/**
 * Serves the visual harness + the real bundle + the real assets on one origin,
 * so a headless browser can mount the component exactly as the app would.
 *
 * Run: node test/harness-server.mjs [port]
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, createReadStream } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const PORT = Number(process.argv[2] ?? 4599);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".css": "text/css; charset=utf-8"
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  let file;

  if (url.pathname === "/" || url.pathname === "/harness") {
    file = join(here, "visual-harness.html");
  } else if (url.pathname === "/plugins/??dsh-pet-fuyuko/client.js" || url.pathname === "/bundle.js") {
    file = join(root, "lib", "client.js");
  } else if (url.pathname.startsWith("/pet-fuyuko/asset/")) {
    file = join(root, "pets", url.pathname.slice("/pet-fuyuko/asset/".length));
  }

  if (file === undefined || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }
  res.writeHead(200, {
    "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
    "cache-control": "no-store"
  });
  createReadStream(file).pipe(res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`harness: http://127.0.0.1:${PORT}/`);
});
