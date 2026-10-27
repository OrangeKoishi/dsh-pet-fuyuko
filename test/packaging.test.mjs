/**
 * Packaging test: proves the three things the DSH client-plugin pipeline needs
 * before it can ever serve this plugin — without booting a whole DSH process.
 *
 *   1. the Loader can import the host entry from a `file:` URL (CJK path incl.)
 *   2. client-modules' discovery finds `package.json` by walking up from that
 *      module and reads a valid `dsh.client` declaration
 *   3. `exports["./client"]` resolves to a real file, and that file is a plain
 *      script (no ESM syntax) that registers itself under the package name
 *
 * Run: node test/packaging.test.mjs
 */
import { strict as assert } from "node:assert";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");
const entry = join(pkgRoot, "lib", "index.js");
const entryUrl = pathToFileURL(entry).href;

// 1. host entry imports from a file: URL, even though the path has CJK segments
const mod = await import(entryUrl);
assert.equal(typeof mod.apply, "function", "host entry must export apply");
assert.equal(mod.name, "dsh-pet-fuyuko", "host entry must name the plugin");

// 2. walk up from the entry exactly like client-modules.nearestPackage() does
function nearestPackage(moduleUrl) {
  let dir = dirname(fileURLToPath(moduleUrl));
  for (;;) {
    const candidate = join(dir, "package.json");
    if (existsSync(candidate)) {
      const pkg = JSON.parse(readFileSync(candidate, "utf8"));
      if (typeof pkg.name === "string") return { path: candidate, pkg };
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

const found = nearestPackage(entryUrl);
assert.ok(found, "client-modules must be able to locate package.json");
assert.equal(found.pkg.name, "dsh-pet-fuyuko", "package name is the module id");
assert.equal(found.pkg.dsh?.client?.platform, "web", "must declare dsh.client.platform=web");

// 3. exports["./client"] resolves, exists, and is a script (not ESM)
const clientRel = found.pkg.exports["./client"];
assert.equal(typeof clientRel, "string", 'exports["./client"] must be a string');
const clientPath = join(dirname(found.path), clientRel);
assert.ok(existsSync(clientPath), "client bundle must exist on disk");
assert.ok(statSync(clientPath).size > 2000, "client bundle must have real content");

const bundle = readFileSync(clientPath, "utf8");
// Strip strings/comments crudely enough for this check: the bundle must not
// contain a top-level import/export statement, because ModuleLoader evaluates
// it as a classic script through `new Function`.
const withoutBlockComments = bundle.replace(/\/\*[\s\S]*?\*\//g, "");
assert.doesNotMatch(
  withoutBlockComments,
  /^\s*(import|export)\s/m,
  "bundle must be a classic script: ModuleLoader evaluates it with new Function"
);
assert.match(bundle, /window\.__ModuleLoader__\.load\(\{/, "must register through the loader facade");
assert.match(bundle, /id:\s*"dsh-pet-fuyuko"/, "registered id must equal the package name");
assert.match(bundle, /factory:/, "must expose a factory");
assert.match(bundle, /require\("react"\)/, "must only require platform-seeded modules");

// The declared externals must all be platform seeds (react is the only one used).
const usedExternals = [...bundle.matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1]);
assert.deepEqual([...new Set(usedExternals)], ["react"], "bundle requires exactly one platform module");

// 4. declared client injects must be real host package names
for (const dep of found.pkg.dsh.client.inject ?? []) {
  assert.match(dep, /^@deepseek-ai\/dsh-/, `inject "${dep}" must look like a host package`);
}

console.log("packaging: all checks passed");
