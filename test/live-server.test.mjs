/**
 * Live HTTP smoke test: boots a real node:http server through a tiny stand-in
 * for the DSH web-server service, mounts the plugin's asset route on it, and
 * exercises it over the network (not through fake request objects).
 *
 * Run: node test/live-server.test.mjs
 */
import { strict as assert } from "node:assert";
import { createServer } from "node:http";
import { apply } from "../lib/index.js";

/** Minimal stand-in for @deepseek-ai/dsh-host-webserver's route table. */
function makeWebServer() {
  const exact = new Map();
  const prefixes = [];
  return {
    register(route) {
      if (route.kind === "exact") {
        exact.set(route.path, route.handler);
        return () => exact.delete(route.path);
      }
      prefixes.push(route);
      prefixes.sort((a, b) => b.path.length - a.path.length);
      return () => {
        const i = prefixes.indexOf(route);
        if (i >= 0) prefixes.splice(i, 1);
      };
    },
    /** Same matching order as the real server: exact first, then longest prefix. */
    dispatch(req, res) {
      const pathname = new URL(req.url, "http://dsh.invalid").pathname;
      const hit = exact.get(pathname);
      if (hit) return hit(req, res);
      for (const p of prefixes) {
        if (pathname === p.path || pathname.startsWith(`${p.path}/`)) return p.handler(req, res);
      }
      res.writeHead(404);
      res.end();
    }
  };
}

const webServer = makeWebServer();
const ctx = {
  inject(_names, cb) {
    cb(ctx);
  },
  effect(fn) {
    return fn();
  },
  webServer
};
apply(ctx);

const server = createServer((req, res) => webServer.dispatch(req, res));
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

try {
  // 1. manifest over the wire
  let r = await fetch(`${base}/pet-fuyuko/asset/fuyuko/pet.json`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /application\/json/);
  const manifest = await r.json();
  assert.equal(manifest.id, "fuyuko");
  assert.equal(manifest.assets.base, "fuyuko.png");

  // 2. sprite over the wire — real PNG bytes, correct length header
  r = await fetch(`${base}/pet-fuyuko/asset/fuyuko/fuyuko.png`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "image/png");
  const buf = Buffer.from(await r.arrayBuffer());
  assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(Number(r.headers.get("content-length")), buf.length);
  // 512x512 RGBA PNG: IHDR width/height live at bytes 16..24
  assert.equal(buf.readUInt32BE(16), 512, "width");
  assert.equal(buf.readUInt32BE(20), 512, "height");
  assert.equal(buf[25], 6, "colour type 6 = RGBA");

  // 3. traversal is refused over the wire too
  for (const evil of [
    "/pet-fuyuko/asset/../package.json",
    "/pet-fuyuko/asset/%2e%2e/package.json",
    "/pet-fuyuko/asset/fuyuko/../../../package.json"
  ]) {
    r = await fetch(`${base}${evil}`);
    assert.equal(r.status, 404, `${evil} must 404`);
  }

  // 4. HEAD: headers, no body
  r = await fetch(`${base}/pet-fuyuko/asset/fuyuko/fuyuko.png`, { method: "HEAD" });
  assert.equal(r.status, 200);
  assert.equal((await r.arrayBuffer()).byteLength, 0);

  // 5. non-GET rejected
  r = await fetch(`${base}/pet-fuyuko/asset/fuyuko/pet.json`, { method: "POST" });
  assert.equal(r.status, 405);

  // 6. an expression sprite that has not been drawn yet is a clean 404, not a
  //    crash — the client tolerates it (assets.optional is a soft reference).
  r = await fetch(`${base}/pet-fuyuko/asset/fuyuko/fuyuko-think.png`);
  assert.equal(r.status, 404);

  // 7. the manifest declares the normalized canvas the sprite was built at
  r = await fetch(`${base}/pet-fuyuko/asset/fuyuko/pet.json`);
  assert.equal((await r.json()).canvas, 512);

  console.log("live-server: all checks passed");
} finally {
  server.close();
}
