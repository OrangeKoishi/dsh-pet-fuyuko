/**
 * dsh-pet-fuyuko — host half (M3)
 *
 * Responsibilities:
 *   - Serve the pet asset directory and the package-root data files
 *     (`lines.zh.json`, `pricing.json`) so the browser half can load them
 *     without a rebuild.
 *   - Proxy the DeepSeek balance API. The Platform key lives only on this side:
 *     the browser may *write* it and may read whether one is configured, but it
 *     never reads the value back, and no response body or log line ever carries
 *     it.
 *
 * Every route is read-only or narrowly scoped and path-traversal guarded; the
 * asset route only ever serves files from this package's `pets/` directory, and
 * the data routes only the two whitelisted package-root files.
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { request as httpsRequest } from "node:https";

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
const ROOT_FILES = new Map([
  ["/pet-fuyuko/lines.zh.json", "lines.zh.json"],
  ["/pet-fuyuko/pricing.json", "pricing.json"]
]);

/** Balance endpoint, per the DeepSeek API docs. */
const BALANCE_URL = "https://api.deepseek.com/user/balance";
/** How long one successful balance read stays fresh. */
const BALANCE_TTL_MS = 60_000;
/** Give up on an upstream call after this long. */
const BALANCE_TIMEOUT_MS = 8_000;

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

//#region credential store
//
// The Platform key is a secret with a narrow job: authenticate one outbound
// request from this process. It is deliberately NOT stored in the shared
// settings document:
//
//   * `~/.dsh/settings.yaml` is a user-editable document that configuration
//     surfaces read and that users copy between machines or paste into issues.
//     A billing key does not belong in it.
//   * This package is mounted as a `file:` plugin with no `node_modules`, so it
//     cannot import schemastery and therefore cannot register a settings
//     namespace properly.
//
// So it gets its own file, owner-only (0600), written atomically.

/** Directory holding the plugin's private state, under DSH_HOME. */
function stateDir() {
  const home = process.env.DSH_HOME ?? join(homedir(), ".dsh");
  return join(home, "pet-fuyuko");
}

/** Absolute path of the credential file. */
function credentialPath() {
  return join(stateDir(), "credentials.json");
}

/** Read the stored key, or "" when unset/unreadable. Never logged. */
async function readKey() {
  try {
    const raw = await readFile(credentialPath(), "utf8");
    const parsed = JSON.parse(raw);
    const key = parsed?.apiKey;
    return typeof key === "string" ? key.trim() : "";
  } catch {
    return "";
  }
}

/**
 * Persist a key with owner-only permissions. Writes a sibling temp file and
 * renames it, so a crash mid-write cannot leave a half-written secret.
 *
 * Returns an outcome instead of throwing: a filesystem failure here is a
 * recoverable condition the caller must report, not an exception that takes
 * the host process down with it.
 * @param {string} key - the Platform key ("" clears it).
 * @returns {Promise<{ok:true} | {ok:false, code:string}>} the outcome.
 */
async function writeKey(key) {
  try {
    const dir = stateDir();
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const target = credentialPath();
    const temp = `${target}.${process.pid}.tmp`;
    const body = JSON.stringify({ apiKey: key, updatedAt: new Date().toISOString() }, null, 2);
    await writeFile(temp, body, { mode: 0o600 });
    await rename(temp, target);
    // Best-effort: rename preserves the temp file's mode, but be explicit anyway
    // (some filesystems carry the parent's mode instead).
    try {
      await chmod(target, 0o600);
    } catch {}
    return { ok: true };
  } catch {
    return { ok: false, code: "storage" };
  }
}

/**
 * Mask a key for any diagnostic text. Keeps the shape recognisable and nothing
 * else: `sk-abcdef…` becomes `sk-****`.
 * @param {string} key - raw key.
 * @returns {string} masked form.
 */
function maskKey(key) {
  if (typeof key !== "string" || key === "") return "";
  return "sk-****";
}
//#endregion

//#region balance proxy
//
// One upstream call, one cached result. The browser asks; this side answers.
// Response shape is fixed and never echoes the key:
//   { ok, isAvailable, infos: [{currency,total,granted,toppedUp}], fetchedAt }
// or { ok:false, code:'auth'|'rate'|'timeout'|'network'|'nokey' }.

/** Last successful read, or null. */
let cache = { at: 0, payload: null };

/**
 * Perform one balance request against the DeepSeek API.
 * @param {string} key - Platform key.
 * @returns {Promise<{ok:boolean, code?:string, status?:number, body?:any}>} outcome.
 */
function fetchBalance(key) {
  return new Promise((resolvePromise) => {
    const req = httpsRequest(
      BALANCE_URL,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${key}`,
          accept: "application/json",
          "user-agent": "dsh-pet-fuyuko"
        },
        timeout: BALANCE_TIMEOUT_MS
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let body;
          try {
            body = JSON.parse(text);
          } catch {
            body = undefined;
          }
          resolvePromise({ ok: res.statusCode === 200, status: res.statusCode, body });
        });
        res.on("error", () => resolvePromise({ ok: false, code: "network" }));
      }
    );
    req.on("timeout", () => {
      req.destroy();
      resolvePromise({ ok: false, code: "timeout" });
    });
    req.on("error", () => resolvePromise({ ok: false, code: "network" }));
    req.end();
  });
}

/**
 * Map an upstream outcome to the fixed public payload.
 * @param {{ok:boolean, code?:string, status?:number, body?:any}} outcome - upstream result.
 * @returns {{ok:boolean, isAvailable?:boolean, infos?:any[], fetchedAt?:number, code?:string}} payload.
 */
function toPayload(outcome) {
  if (!outcome.ok) {
    if (outcome.code === "timeout") return { ok: false, code: "timeout" };
    if (outcome.code === "network") return { ok: false, code: "network" };
    if (outcome.status === 401 || outcome.status === 403) return { ok: false, code: "auth" };
    if (outcome.status === 429) return { ok: false, code: "rate" };
    // A 200 that is not JSON, or any other status: report it as a network-class
    // failure rather than inventing a reason.
    return { ok: false, code: "network" };
  }
  const body = outcome.body ?? {};
  const rawInfos = Array.isArray(body.balance_infos) ? body.balance_infos : [];
  const infos = [];
  for (const info of rawInfos) {
    if (info === null || typeof info !== "object") continue;
    const total = Number(info.total_balance);
    infos.push({
      currency: typeof info.currency === "string" ? info.currency : "CNY",
      // Keep the provider's string when it is not a number: rounding a currency
      // we cannot parse would be worse than showing what it said.
      total: Number.isFinite(total) ? total : String(info.total_balance ?? ""),
      granted: Number(info.granted_balance),
      toppedUp: Number(info.topped_up_balance)
    });
  }
  return {
    ok: true,
    isAvailable: body.is_available === true,
    infos,
    fetchedAt: Date.now()
  };
}
//#endregion

//#region request helpers

/** Read a JSON request body with a hard size cap. */
function readJsonBody(req, limit = 8 * 1024) {
  return new Promise((resolvePromise) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        resolvePromise({ tooLarge: true });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (text.trim() === "") {
        resolvePromise({ value: {} });
        return;
      }
      try {
        resolvePromise({ value: JSON.parse(text) });
      } catch {
        resolvePromise({ invalid: true });
      }
    });
    req.on("error", () => resolvePromise({ invalid: true }));
  });
}

/** Send one JSON response. */
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(Buffer.byteLength(body)),
    "cache-control": "no-store",
    // The balance payload is per-user: keep it out of shared caches entirely.
    vary: "cookie"
  });
  res.end(body);
}

/**
 * Refuse requests that did not originate from this same origin.
 *
 * The server only binds loopback, but any page in the user's browser can still
 * reach `http://127.0.0.1:<port>`. A cross-site page cannot set `Origin` to our
 * host, and a JSON content-type forces a preflight it will not pass, so
 * checking both closes the drive-by path to the key and to the balance read.
 * @param {import('node:http').IncomingMessage} req - request.
 * @returns {boolean} true when the request is same-origin (or a non-browser caller).
 */
function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin !== "" && origin !== "null") {
    const host = req.headers.host;
    try {
      const parsed = new URL(origin);
      return parsed.host === host;
    } catch {
      return false;
    }
  }
  // No Origin: a same-origin GET/fetch from the app, or a local tool. Browsers
  // always attach Origin to cross-origin requests, so this is safe.
  return true;
}
//#endregion

/**
 * Plugin body: register routes once a web server exists. Compositions without a
 * web server (headless, ACP) simply never run the callback.
 * @param {import('@deepseek-ai/cordis').Context} ctx - host context.
 */
export function apply(ctx) {
  ctx.inject(["webServer"], (scope) => {
    /**
     * Shared GET/HEAD file responder for the asset and data routes.
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
        // Assets and data are edited on disk during iteration: never cache hard.
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

    for (const [path, label] of [
      ["/pet-fuyuko/lines.zh.json", "lines route"],
      ["/pet-fuyuko/pricing.json", "pricing route"]
    ]) {
      scope.effect(() => {
        const dispose = scope.webServer.register({
          kind: "exact",
          path,
          handler: (req, res) => serve(req, res, resolveRootFile(req.url ?? ""))
        });
        return dispose;
      }, `pet-fuyuko: ${label}`);
    }

    /**
     * Wrap an async route handler so no rejection can escape.
     *
     * A route handler owns the response, so a throw inside one leaves the
     * request hanging — and an unhandled rejection in this process takes the
     * whole host down. Every async handler goes through here, and the catch
     * answers with the fixed failure shape instead.
     * @param {(req: any, res: any) => Promise<void>} handler - the real handler.
     * @returns {(req: any, res: any) => Promise<void>} a non-throwing wrapper.
     */
    const guard = (handler) => async (req, res) => {
      try {
        await handler(req, res);
      } catch {
        // Never include the error text: it could quote request data.
        if (!res.headersSent) {
          sendJson(res, 500, { ok: false, code: "internal" });
        } else {
          try {
            res.end();
          } catch {}
        }
      }
    };

    // ── balance: GET /pet-fuyuko/balance ────────────────────────────────
    // Cached for 60s. `?force=1` bypasses the cache (the "再查一次" button).
    scope.effect(() => {
      const dispose = scope.webServer.register({
        kind: "exact",
        path: "/pet-fuyuko/balance",
        handler: guard(async (req, res) => {
          if (req.method !== "GET" && req.method !== "HEAD") {
            res.writeHead(405, { allow: "GET, HEAD" });
            res.end();
            return;
          }
          if (!isSameOrigin(req)) {
            sendJson(res, 403, { ok: false, code: "forbidden" });
            return;
          }
          const url = new URL(req.url ?? "/", "http://localhost");
          const force = url.searchParams.get("force") === "1";

          const key = await readKey();
          if (key === "") {
            sendJson(res, 200, { ok: false, code: "nokey" });
            return;
          }

          const now = Date.now();
          if (!force && cache.payload !== null && now - cache.at < BALANCE_TTL_MS) {
            sendJson(res, 200, cache.payload);
            return;
          }

          const payload = toPayload(await fetchBalance(key));
          if (payload.ok) {
            cache = { at: now, payload };
          } else if (payload.code === "auth") {
            // A rejected key must not keep answering from a stale success.
            cache = { at: 0, payload: null };
          }
          // Diagnostics never include the key or the provider's raw body.
          ctx.logger?.debug?.(
            `pet-fuyuko: balance ${payload.ok ? "ok" : payload.code} key=${maskKey(key)}`
          );
          sendJson(res, 200, payload);
        })
      });
      return dispose;
    }, "pet-fuyuko: balance route");

    // ── key status: GET /pet-fuyuko/key ─────────────────────────────────
    // Reports only whether a key exists, never the value.
    scope.effect(() => {
      const dispose = scope.webServer.register({
        kind: "exact",
        path: "/pet-fuyuko/key",
        handler: guard(async (req, res) => {
          if (!isSameOrigin(req)) {
            sendJson(res, 403, { ok: false, code: "forbidden" });
            return;
          }
          if (req.method === "GET" || req.method === "HEAD") {
            const key = await readKey();
            sendJson(res, 200, { ok: true, configured: key !== "" });
            return;
          }
          if (req.method === "DELETE") {
            await writeKey("");
            cache = { at: 0, payload: null };
            // Trust the file, not the write: if the credential directory is
            // read-only the old key is still there, and claiming otherwise
            // would be a lie the user acts on.
            const remaining = await readKey();
            sendJson(res, 200, { ok: true, configured: remaining !== "" });
            return;
          }
          if (req.method !== "POST") {
            res.writeHead(405, { allow: "GET, HEAD, POST, DELETE" });
            res.end();
            return;
          }
          // A JSON content-type forces a CORS preflight for cross-site callers,
          // which this route never answers.
          if (!String(req.headers["content-type"] ?? "").includes("application/json")) {
            sendJson(res, 415, { ok: false, code: "content-type" });
            return;
          }
          const body = await readJsonBody(req);
          if (body.tooLarge) {
            sendJson(res, 413, { ok: false, code: "too-large" });
            return;
          }
          if (body.invalid) {
            sendJson(res, 400, { ok: false, code: "invalid" });
            return;
          }
          const raw = body.value?.apiKey;
          const key = typeof raw === "string" ? raw.trim() : "";
          // Validate the shape before storing: a typo should fail here, not as a
          // confusing 401 on the first balance read.
          if (key !== "" && !/^sk-[A-Za-z0-9_-]{8,}$/.test(key)) {
            sendJson(res, 400, { ok: false, code: "format" });
            return;
          }
          const saved = await writeKey(key);
          if (!saved.ok) {
            // A read-only or sandboxed DSH_HOME is a real possibility. Say so
            // instead of pretending the key was stored.
            sendJson(res, 500, { ok: false, code: saved.code });
            return;
          }
          cache = { at: 0, payload: null };
          ctx.logger?.info?.(`pet-fuyuko: key ${key === "" ? "cleared" : "updated"} key=${maskKey(key)}`);
          sendJson(res, 200, { ok: true, configured: key !== "" });
        })
      });
      return dispose;
    }, "pet-fuyuko: key route");
  });
}

// Test-only face for the pure helpers (not part of the plugin contract).
export const __test = {
  resolveAsset,
  resolveRootFile,
  toPayload,
  isSameOrigin,
  maskKey,
  readKey,
  writeKey,
  credentialPath,
  stateDir,
  ROOT_FILES,
  BALANCE_TTL_MS
};
