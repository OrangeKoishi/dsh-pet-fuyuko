/**
 * Smoke test for the pet plugin's host half: mounts the asset route against a
 * fake web server and exercises it with fake requests. No DSH boot required.
 *
 * Run: node test/asset-route.test.mjs
 */
import { strict as assert } from "node:assert";
import { apply } from "../lib/index.js";

/** Minimal fake of ctx.inject + ctx.effect + ctx.webServer. */
function makeCtx() {
  let route;
  const ctx = {
    inject(_names, cb) {
      cb(ctx);
    },
    effect(fn) {
      return fn();
    },
    webServer: {
      register(r) {
        route = r;
        return () => {
          route = undefined;
        };
      }
    }
  };
  return { ctx, getRoute: () => route };
}

/** Minimal fake ServerResponse collecting status/headers/body. */
function makeRes() {
  const res = {
    status: undefined,
    headers: undefined,
    chunks: [],
    writeHead(status, headers) {
      res.status = status;
      res.headers = headers;
    },
    end(chunk) {
      if (chunk !== undefined) res.chunks.push(Buffer.from(chunk));
      res.ended = true;
    },
    on() {},
    once() {},
    emit() {},
    write(chunk) {
      res.chunks.push(Buffer.from(chunk));
    }
  };
  res.body = () => Buffer.concat(res.chunks);
  return res;
}

/** Drive one request through the registered route and await the stream. */
async function request(route, url, method = "GET") {
  const res = makeRes();
  const req = { method, url, headers: {} };
  await route.handler(req, res);
  if (!res.ended) {
    await new Promise((r) => setTimeout(r, 60));
  }
  return res;
}

const { ctx, getRoute } = makeCtx();
apply(ctx);
const route = getRoute();
assert.ok(route, "route must be registered when a web server is present");
assert.equal(route.kind, "prefix");
assert.equal(route.path, "/pet-fuyuko/asset");

// 1. pet.json is served as JSON
let res = await request(route, "/pet-fuyuko/asset/fuyuko/pet.json");
assert.equal(res.status, 200, "pet.json should be 200");
assert.match(res.headers["content-type"], /application\/json/);
const manifest = JSON.parse(res.body().toString("utf8"));
assert.equal(manifest.id, "fuyuko");

// 2. sprite is served as PNG with the right magic bytes
res = await request(route, "/pet-fuyuko/asset/fuyuko/fuyuko.png");
assert.equal(res.status, 200, "sprite should be 200");
assert.equal(res.headers["content-type"], "image/png");
const png = res.body();
assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "PNG magic");
assert.ok(Number(res.headers["content-length"]) > 1000, "sprite should have real bytes");

// 3. traversal is refused
for (const evil of [
  "/pet-fuyuko/asset/../package.json",
  "/pet-fuyuko/asset/..%2fpackage.json",
  "/pet-fuyuko/asset/fuyuko/../../package.json"
]) {
  res = await request(route, evil);
  assert.equal(res.status, 404, `traversal ${evil} must 404`);
}

// 4. missing file is 404, not a crash
res = await request(route, "/pet-fuyuko/asset/fuyuko/nope.png");
assert.equal(res.status, 404);

// 5. non-GET is rejected
res = await request(route, "/pet-fuyuko/asset/fuyuko/pet.json", "POST");
assert.equal(res.status, 405);
assert.equal(res.headers.allow, "GET, HEAD");

// 6. HEAD returns headers with no body
res = await request(route, "/pet-fuyuko/asset/fuyuko/fuyuko.png", "HEAD");
assert.equal(res.status, 200);
assert.equal(res.body().length, 0, "HEAD must not stream a body");

console.log("asset-route: all checks passed");
