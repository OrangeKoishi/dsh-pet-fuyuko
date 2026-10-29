/**
 * Live HTTP smoke test: boots a real node:http server through a tiny stand-in
 * for the DSH web-server service, mounts the plugin's asset route on it, and
 * exercises it over the network (not through fake request objects).
 *
 * Run: node test/live-server.test.mjs
 */
import { strict as assert } from "node:assert";
import { createServer } from "node:http";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  // 8. the price table is served, and is a real table
  r = await fetch(`${base}/pet-fuyuko/pricing.json`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /application\/json/);
  const pricing = await r.json();
  assert.ok(pricing.models && Object.keys(pricing.models).length >= 2, "pricing carries models");
  assert.ok(pricing.periods?.peak, "pricing declares the peak window");

  // 9. the key endpoint reports status without ever returning the value
  r = await fetch(`${base}/pet-fuyuko/key`);
  assert.equal(r.status, 200);
  const keyStatus = await r.json();
  assert.equal(typeof keyStatus.configured, "boolean");
  assert.equal(keyStatus.apiKey, undefined, "the key must never appear in a response");

  // 10. writing a malformed key is refused (shape check happens before storage)
  r = await fetch(`${base}/pet-fuyuko/key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey: "not-a-key" })
  });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).code, "format");

  // 11. a non-JSON content type is refused (forces a CORS preflight cross-site)
  r = await fetch(`${base}/pet-fuyuko/key`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ apiKey: "sk-abcdefgh12345" })
  });
  assert.equal(r.status, 415);

  // 12. a cross-origin write is refused
  r = await fetch(`${base}/pet-fuyuko/key`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://evil.example" },
    body: JSON.stringify({ apiKey: "sk-abcdefgh12345" })
  });
  assert.equal(r.status, 403, "a foreign Origin cannot write the key");

  // 13. the balance route answers with the fixed shape, and never a key
  r = await fetch(`${base}/pet-fuyuko/balance`);
  assert.equal(r.status, 200);
  const balance = await r.json();
  assert.equal(typeof balance.ok, "boolean");
  assert.ok(!/sk-/.test(JSON.stringify(balance)), "no key material in the balance payload");
  // With no key configured it must say so rather than guessing a balance.
  assert.ok(balance.ok === false, "no key configured in this environment");
  assert.ok(["nokey", "auth", "network", "timeout", "rate"].includes(balance.code), `code is from the fixed set: ${balance.code}`);

  // 14. the balance route is read-only
  r = await fetch(`${base}/pet-fuyuko/balance`, { method: "POST" });
  assert.equal(r.status, 405);

  // 15. a cross-origin balance read is refused (drive-by protection)
  r = await fetch(`${base}/pet-fuyuko/balance`, { headers: { origin: "https://evil.example" } });
  assert.equal(r.status, 403);

  // 16. A key write must never take the server down, even when the credential
  //     directory cannot be created (read-only DSH_HOME, sandbox, full disk).
  //     This was a real crash: the handler rejected, the process died, and the
  //     browser saw a dead socket instead of an error.
  {
    const savedHome = process.env.DSH_HOME;
    // A path that cannot be created: an existing FILE used as a directory
    // component, so mkdir({recursive:true}) fails rather than succeeding.
    const blocker = join(tmpdir(), `dsh-pet-fuyuko-blocked-${process.pid}`);
    writeFileSync(blocker, "not a directory");
    process.env.DSH_HOME = blocker;
    try {
      r = await fetch(`${base}/pet-fuyuko/key`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: "sk-abcdefgh12345678" })
      });
      assert.equal(r.status, 500, "an unstorable key is a 500, not a crash");
      assert.equal((await r.json()).code, "storage");

      // The server must still be alive and answering.
      r = await fetch(`${base}/pet-fuyuko/key`);
      assert.equal(r.status, 200, "the server survived the failed write");
      assert.equal((await r.json()).configured, false, "nothing was stored");
    } finally {
      if (savedHome === undefined) delete process.env.DSH_HOME;
      else process.env.DSH_HOME = savedHome;
      try {
        unlinkSync(blocker);
      } catch {}
    }
  }

  // 17. A DELETE on the key endpoint reports the state it can actually verify.
  r = await fetch(`${base}/pet-fuyuko/key`, { method: "DELETE" });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).configured, false);

  console.log("live-server: all checks passed");
} finally {
  server.close();
}
