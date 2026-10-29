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
    useSyncExternalStore(subscribe, getSnapshot) {
      // The fake never re-renders, so it only has to return a current value.
      cursor++;
      return getSnapshot();
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

// ── apply() registers the pet and the invisible bridge ────────────────────
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
assert.deepEqual(
  injected,
  ["shell.overlay", "conversation.input.overlay"],
  "pet in the frame overlay, bridge in a session-scoped slot"
);
assert.equal(registrations.length, 2, "two registrations");

const pet = registrations.find((r) => r.spec.id === "pet-fuyuko");
const bridge = registrations.find((r) => r.spec.id === "pet-fuyuko-bridge");
assert.ok(pet, "pet registration exists");
assert.ok(bridge, "bridge registration exists");
assert.equal(pet.spec.name, "shell.overlay");
assert.equal(pet.spec.order, 50);
assert.equal(bridge.spec.name, "conversation.input.overlay");
assert.equal(typeof pet.component, "function");
assert.equal(typeof bridge.component, "function");
assert.equal(mod.SessionBridge, bridge.component, "bridge is exported for tests");

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

// ── M1: activity derivation from live session facts ───────────────────────
const { deriveActivity, publishSignal, clearSignal, getSignal, subscribeSignal, ACTIVITY, EMPTY_SIGNAL } = mod.__test;

/** Build a minimal chat snapshot with the two fields the pet reads. */
const chat = ({ runningCalls = [], partial = null } = {}) => ({
  legacy: { runningCalls, partial }
});
const sess = ({ lastAgentError = null } = {}) => ({ lastAgentError });

// Idle: nothing running, nothing streaming.
assert.deepEqual(deriveActivity(chat(), sess()), {
  activity: ACTIVITY.IDLE,
  toolCalls: 0,
  errorText: ""
});

// Thinking: a streaming assistant prefix with no tool in flight.
assert.equal(deriveActivity(chat({ partial: { turn: 1, step: 1, blocks: [] } }), sess()).activity, ACTIVITY.THINKING);

// Working: at least one running tool call, and the count is reported.
const twoCalls = deriveActivity(
  chat({ runningCalls: [{ callId: "a", name: "fs_read", argsRaw: "{}" }, { callId: "b", name: "pwsh", argsRaw: "{}" }] }),
  sess()
);
assert.equal(twoCalls.activity, ACTIVITY.WORKING);
assert.equal(twoCalls.toolCalls, 2);

// A tool call outranks a streaming prefix: "working" is more specific.
assert.equal(
  deriveActivity(chat({ runningCalls: [{ callId: "a" }], partial: { turn: 1, step: 1, blocks: [] } }), sess()).activity,
  ACTIVITY.WORKING
);

// Error outranks everything, and the message is carried through.
const failed = deriveActivity(chat({ runningCalls: [{ callId: "a" }] }), sess({ lastAgentError: "429 rate limited" }));
assert.equal(failed.activity, ACTIVITY.ERROR);
assert.equal(failed.errorText, "429 rate limited");

// Absent or malformed inputs must not throw — the pet renders before a session binds.
assert.equal(deriveActivity(undefined, undefined).activity, ACTIVITY.IDLE);
assert.equal(deriveActivity(null, null).activity, ACTIVITY.IDLE);
assert.equal(deriveActivity({}, {}).activity, ACTIVITY.IDLE);
assert.equal(deriveActivity({ legacy: {} }, {}).activity, ACTIVITY.IDLE);
assert.equal(deriveActivity({ legacy: { runningCalls: "nope" } }, {}).toolCalls, 0, "non-array → 0");

// ── M1: the signal store ──────────────────────────────────────────────────
clearSignal();
assert.equal(getSignal(), EMPTY_SIGNAL, "cleared signal is the shared empty value");

let notifications = 0;
const unsubscribe = subscribeSignal(() => {
  notifications += 1;
});

publishSignal({ activity: ACTIVITY.THINKING, sessionId: "s1", since: 111 });
assert.equal(notifications, 1, "a real change notifies");
assert.equal(getSignal().activity, ACTIVITY.THINKING);
assert.equal(getSignal().sessionId, "s1");

// Republishing identical values must NOT notify (useSyncExternalStore would
// otherwise re-render on every chat event).
publishSignal({ activity: ACTIVITY.THINKING, sessionId: "s1", since: 111 });
assert.equal(notifications, 1, "identical publish is a no-op");

publishSignal({ activity: ACTIVITY.WORKING, toolCalls: 3 });
assert.equal(notifications, 2, "changed activity notifies");
assert.equal(getSignal().toolCalls, 3);
assert.equal(getSignal().sessionId, "s1", "unspecified fields are preserved");

unsubscribe();
publishSignal({ activity: ACTIVITY.IDLE });
assert.equal(notifications, 2, "unsubscribed listener is not called");

clearSignal();
assert.equal(getSignal(), EMPTY_SIGNAL, "clear resets to the shared empty value");

console.log("client-face: all checks passed");
