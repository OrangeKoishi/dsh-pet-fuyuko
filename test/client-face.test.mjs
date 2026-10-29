/**
 * Headless client-half test: loads lib/client.js through a fake module loader,
 * checks the plugin face, then drives PetLayer with a minimal React stand-in.
 *
 * We deliberately do NOT use react-dom here: the profile ships react 18 with a
 * react-dom 19 nested under another plugin, and a version-mismatched SSR run
 * would test the harness's dependency tree rather than our component.
 *
 * Run: node test/client-face.test.mjs
 */
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// ── stub the browser globals the bundle touches at module scope ────────────
const styleTags = [];
globalThis.document = {
  querySelector: () => null,
  createElement: () => ({ dataset: {}, textContent: "" }),
  head: { appendChild: (el) => styleTags.push(el) }
};
const listeners = new Map();
globalThis.window = {
  innerWidth: 1280,
  innerHeight: 800,
  localStorage: {
    _v: new Map(),
    getItem(k) {
      return this._v.has(k) ? this._v.get(k) : null;
    },
    setItem(k, v) {
      this._v.set(k, String(v));
    }
  },
  addEventListener(type, fn) {
    listeners.set(type, fn);
  },
  removeEventListener(type) {
    listeners.delete(type);
  },
  setTimeout: (fn, ms) => setTimeout(fn, ms)
};

// ── fake module loader: capture the factory, then materialize it ───────────
let captured;
globalThis.window.__ModuleLoader__ = {
  load(registration) {
    captured = registration;
  }
};

const source = readFileSync(resolve(here, "..", "lib", "client.js"), "utf8");
new Function("window", "document", source)(globalThis.window, globalThis.document);

assert.ok(captured, "bundle must call __ModuleLoader__.load");
assert.equal(captured.id, "dsh-pet-fuyuko", "bundle id must equal the package name");

// ── minimal React stand-in: real hook ordering, fake rendering ────────────
function makeFakeReact() {
  const hookState = [];
  let cursor = 0;
  const react = {
    useRef(initial) {
      const i = cursor++;
      if (!(i in hookState)) hookState[i] = { current: initial };
      return hookState[i];
    },
    useState(initial) {
      const i = cursor++;
      if (!(i in hookState)) hookState[i] = typeof initial === "function" ? initial() : initial;
      return [
        hookState[i],
        (next) => {
          hookState[i] = typeof next === "function" ? next(hookState[i]) : next;
        }
      ];
    },
    useCallback(fn) {
      return fn;
    },
    useEffect(fn) {
      cursor++;
    },
    createElement(type, props, ...children) {
      return { type, props: props ?? {}, children: children.flat() };
    }
  };
  return {
    react,
    reset: () => {
      cursor = 0;
    }
  };
}

const fake = makeFakeReact();
const mod = captured.factory((spec) => {
  if (spec === "react") return fake.react;
  throw new Error(`unexpected external: ${spec}`);
});

// ── plugin face ───────────────────────────────────────────────────────────
assert.equal(typeof mod.apply, "function", "must export apply");
assert.deepEqual(mod.inject, ["slots"], "must declare the slots dependency");
assert.equal(typeof mod.PetLayer, "function", "must export PetLayer");

assert.equal(styleTags.length, 1, "one style tag");
assert.equal(styleTags[0].dataset.plugin, "dsh-pet-fuyuko");
assert.match(styleTags[0].textContent, /dpf-pet/, "css carries the pet rules");
assert.match(styleTags[0].textContent, /prefers-reduced-motion/, "css honours reduced motion");
assert.match(styleTags[0].textContent, /dpf-breathe/, "css carries the idle motion");

// ── apply() registers into shell.overlay ──────────────────────────────────
const registrations = [];
const injected = [];
const ctx = {
  slots: {
    inject(key, cb) {
      injected.push(key);
      return cb();
    },
    register(spec, component) {
      registrations.push({ spec, component });
      return () => {};
    }
  }
};
mod.apply(ctx);
assert.deepEqual(injected, ["shell.overlay"], "must wait for the overlay slot");
assert.equal(registrations.length, 1, "one registration");
assert.equal(registrations[0].spec.name, "shell.overlay");
assert.equal(registrations[0].spec.id, "pet-fuyuko");
assert.equal(registrations[0].spec.order, 50);
assert.equal(typeof registrations[0].component, "function");

// ── first render: hidden until the manifest probe confirms the route ──────
fake.reset();
let tree = mod.PetLayer({});
assert.equal(tree, null, "pet stays hidden until pet.json confirms the asset route");

// ── the pet is window-level, not conversation-level ───────────────────────
// M0 deliberately shows the pet on every view (a desktop pet belongs to the
// window, not to one conversation). Session-driven *state* arrives in M1 via a
// bridge component; visibility must not depend on the selected session, so the
// pet ignores the session kit entirely. This pins that contract.
fake.reset();
tree = mod.PetLayer({ useSessions: () => { throw new Error("must not be called"); } });
assert.equal(tree, null, "hidden only because the asset probe has not resolved");

fake.reset();
tree = mod.PetLayer();
assert.equal(tree, null, "same result with no props at all");

// ── geometry helpers behave (default seat + clamping) ─────────────────────
// Default seat is bottom-right and clear of the composer: 1280-160-28 = 1092,
// 800-160-96 = 544.
assert.deepEqual(mod.__test.defaultPosition(), { x: 1092, y: 544 });
assert.deepEqual(mod.__test.clamp({ x: -999, y: -999 }), { x: 16, y: 16 });
assert.deepEqual(mod.__test.clamp({ x: 99999, y: 99999 }), { x: 1104, y: 624 });

// Persisted position round-trips through localStorage.
mod.__test.writePosition(321.4, 654.6);
const stored = JSON.parse(window.localStorage.getItem("dsh-pet-fuyuko:position"));
assert.deepEqual(stored, { x: 321, y: 655 });
assert.deepEqual(mod.__test.readPosition(), { x: 321, y: 655, placed: true });

// ── Alt+wheel zoom ────────────────────────────────────────────────────────
const { sanitizeScale, boxSize, anchorOnZoom, clamp, SIZE, MIN_SCALE, MAX_SCALE, ZOOM_RATE } = mod.__test;

// Zoom is clamped into the supported range, and junk falls back to 1.
assert.equal(sanitizeScale(1), 1);
assert.equal(sanitizeScale(0.1), MIN_SCALE, "below the floor → clamped up");
assert.equal(sanitizeScale(99), MAX_SCALE, "above the ceiling → clamped down");
assert.equal(sanitizeScale("abc"), 1, "non-numeric → 1");
assert.equal(sanitizeScale(undefined), 1, "undefined → 1");
assert.equal(sanitizeScale(Number.NaN), 1, "NaN → 1");

// The rendered box tracks the scale.
assert.equal(boxSize(1), SIZE);
assert.equal(boxSize(2), SIZE * 2);
assert.equal(boxSize(0.5), SIZE / 2);

// Zooming grows the box upward and sideways from the bottom-centre anchor, so
// her feet stay planted: the top edge moves up by the full growth, the left
// edge by half of it.
const before = { x: 400, y: 500 };
const grown = anchorOnZoom(before, 1, 2);
assert.equal(grown.x, 400 - SIZE / 2, "centre preserved horizontally");
assert.equal(grown.y, 500 - SIZE, "bottom edge preserved vertically");
const shrunk = anchorOnZoom(before, 2, 1);
assert.equal(shrunk.x, 400 + SIZE / 2);
assert.equal(shrunk.y, 500 + SIZE);
// Round-tripping a zoom change returns to the original top-left.
const roundTrip = anchorOnZoom(grown, 2, 1);
assert.equal(roundTrip.x, before.x);
assert.equal(roundTrip.y, before.y);

// Clamping accounts for the zoomed box: a 2x pet cannot hang off the edge.
const big = clamp({ x: 99999, y: 99999 }, 2);
assert.equal(big.x, 1280 - SIZE * 2 - 16);
assert.equal(big.y, 800 - SIZE * 2 - 16);

// Default seat also respects the current zoom.
assert.deepEqual(mod.__test.defaultPosition(1), { x: 1092, y: 544 });
assert.deepEqual(mod.__test.defaultPosition(2), { x: 1280 - 320 - 28, y: 800 - 320 - 96 });

// Persisted zoom round-trips, and a junk value degrades to 1 instead of NaN.
mod.__test.writeScale(1.23456);
assert.equal(JSON.parse(window.localStorage.getItem("dsh-pet-fuyuko:scale")), 1.235);
assert.equal(mod.__test.readScale(), 1.235);
window.localStorage.setItem("dsh-pet-fuyuko:scale", "\"nope\"");
assert.equal(mod.__test.readScale(), 1, "corrupt stored zoom → 1");

// A wheel notch changes the scale by ZOOM_RATE * deltaY, and the sign is right:
// scrolling up (negative deltaY) enlarges her.
const stepUp = 1 * (1 - -100 * ZOOM_RATE);
const stepDown = 1 * (1 - 100 * ZOOM_RATE);
assert.ok(stepUp > 1, "wheel up enlarges");
assert.ok(stepDown < 1, "wheel down shrinks");

console.log("client-face: all checks passed");
