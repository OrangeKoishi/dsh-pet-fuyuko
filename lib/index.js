/**
 * dsh-pet-fuyuko — host half (M0)
 *
 * Responsibilities at M0:
 *   - Serve the pet asset directory over HTTP so the browser half can load
 *     sprites, and so replacing a PNG does not require rebuilding the bundle.
 *   - Nothing else. Balance RPC, config and the pet_say tool land in M3/M4.
 *
 * The route is read-only and path-traversal guarded; it only ever serves files
 * from this package's `pets/` directory.
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const name = "dsh-pet-fuyuko";

/** Absolute path of this package root. */
const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** Whitelisted asset root: only `pets/` is exposed. */
const ASSET_ROOT = join(PKG_ROOT, "pets");
/** Public URL prefix. */
const ASSET_PREFIX = "/pet-fuyuko/asset";

/**
 * Package-root files the browser half is allowed to fetch, by URL path. Kept as
 * an explicit whitelist rather than widening ASSET_ROOT: the asset route must
 * never be able to read arbitrary files next to the package.
 */
const ROOT_FILES = new Map([["/pet-fuyuko/lines.zh.json", "lines.zh.json"]]);

const MIME = {
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8"
};

/**
 * Resolve a request path to a file inside ASSET_ROOT, or undefined when the
 * request escapes the root or names a missing file.
 * @param {string} rawUrl - request url (may carry a query string).
 * @returns {string | undefined} absolute file path.
 */
function resolveAsset(rawUrl) {
  const pathname = decodeURIComponent(rawUrl.split("?")[0]);
  if (!pathname.startsWith(`${ASSET_PREFIX}/`)) return undefined;
  const rel = normalize(pathname.slice(ASSET_PREFIX.length + 1));
  if (rel.startsWith("..") || rel.includes(`..${sep}`) || resolve(rel) === rel) return undefined;
  const abs = join(ASSET_ROOT, rel);
  if (!abs.startsWith(ASSET_ROOT + sep)) return undefined;
  if (!existsSync(abs) || !statSync(abs).isFile()) return undefined;
  return abs;
}

/**
 * Resolve a whitelisted package-root file.
 * @param {string} rawUrl - request url (may carry a query string).
 * @returns {string | undefined} absolute file path.
 */
function resolveRootFile(rawUrl) {
  const pathname = decodeURIComponent(rawUrl.split("?")[0]);
  const name = ROOT_FILES.get(pathname);
  if (name === undefined) return undefined;
  const abs = join(PKG_ROOT, name);
  if (!existsSync(abs) || !statSync(abs).isFile()) return undefined;
  return abs;
}

/**
 * Plugin body: register the asset route once a web server exists. Compositions
 * without a web server (headless, ACP) simply never run the callback.
 * @param {import('@deepseek-ai/cordis').Context} ctx - host context.
 */
export function apply(ctx) {
  ctx.inject(["webServer"], (scope) => {
    /**
     * Shared GET/HEAD file responder for both routes.
     * @param {import('node:http').IncomingMessage} req - request.
     * @param {import('node:http').ServerResponse} res - response.
     * @param {string | undefined} file - absolute path, or undefined for 404.
     */
    const serve = (req, res, file) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { allow: "GET, HEAD" });
        res.end();
        return;
      }
      if (file === undefined) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("not found");
        return;
      }
      const type = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
      const size = statSync(file).size;
      res.writeHead(200, {
        "content-type": type,
        "content-length": String(size),
        // Assets and lines are edited on disk during iteration: never cache hard.
        "cache-control": "no-cache"
      });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      createReadStream(file).pipe(res);
    };

    scope.effect(() => {
      const dispose = scope.webServer.register({
        kind: "prefix",
        path: ASSET_PREFIX,
        handler: (req, res) => serve(req, res, resolveAsset(req.url ?? ""))
      });
      return dispose;
    }, "pet-fuyuko: asset route");

    scope.effect(() => {
      const dispose = scope.webServer.register({
        kind: "exact",
        path: "/pet-fuyuko/lines.zh.json",
        handler: (req, res) => serve(req, res, resolveRootFile(req.url ?? ""))
      });
      return dispose;
    }, "pet-fuyuko: lines route");
  });
}
