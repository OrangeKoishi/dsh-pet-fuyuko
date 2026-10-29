/**
 * M2 test: the persona layer — line library indexing, selection rules,
 * cooldowns, the `once` ledger, variable substitution, the sprite state
 * machine, hotspot hit-testing, bubble/menu placement and pet-state migration.
 *
 * Everything here is a pure function, so no browser and no React are needed.
 *
 * Run: node test/lines.test.mjs
 */
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");

// ── browser globals the bundle touches at module scope ─────────────────────
globalThis.document = {
	querySelector: () => null,
	createElement: () => ({ dataset: {}, textContent: "" }),
	head: { appendChild: () => {} }
};
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
		},
		removeItem(k) {
			this._v.delete(k);
		}
	},
	addEventListener() {},
	removeEventListener() {},
	setTimeout: (fn, ms) => setTimeout(fn, ms)
};

let captured;
globalThis.window.__ModuleLoader__ = {
	load(registration) {
		captured = registration;
	}
};

const source = readFileSync(resolve(pkgRoot, "lib", "client.js"), "utf8");
new Function("window", "document", source)(globalThis.window, globalThis.document);

const fakeReact = {
	useRef: (v) => ({ current: v }),
	useState: (v) => [typeof v === "function" ? v() : v, () => {}],
	useCallback: (fn) => fn,
	useEffect: () => {},
	useSyncExternalStore: (_s, get) => get(),
	createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat() })
};
const mod = captured.factory((spec) => {
	if (spec === "react") return fakeReact;
	throw new Error(`unexpected external: ${spec}`);
});
const t = mod.__test;

// ── 1. the shipped library is valid and complete ──────────────────────────
const raw = JSON.parse(readFileSync(resolve(pkgRoot, "lines.zh.json"), "utf8"));
const lib = t.normalizeLibrary(raw);
assert.ok(lib !== null, "the shipped lines.zh.json must normalize");
assert.equal(lib.schemaVersion, 1);
assert.equal(lib.locale, "zh-CN");
assert.equal(lib.defaults.称呼, "你");
assert.equal(lib.defaults.冷却秒, 600);

// Every shipped entry survived normalization (no silent drops from typos).
assert.equal(lib.lines.length, raw.lines.length, "every shipped line must be usable");
const ids = new Set(lib.lines.map((l) => l.id));
assert.equal(ids.size, raw.lines.length, "line ids must be unique");
assert.ok(lib.lines.length >= 120, `design promises 120+ lines, got ${lib.lines.length}`);

// Design §3.4 requires both personas for every core trigger.
for (const kind of ["idle", "think", "work", "panic", "click", "ahoge", "balance", "feed"]) {
	const bucket = lib.byKind.get(kind) ?? [];
	assert.ok(bucket.length > 0, `kind ${kind} must exist`);
	assert.ok(bucket.some((l) => l.mode === "omote"), `${kind} needs an omote line`);
	assert.ok(bucket.some((l) => l.mode === "ura"), `${kind} needs an ura line`);
}
// Festive lines are shared by both personas.
for (const line of lib.byKind.get("festive") ?? []) {
	assert.equal(line.mode, "both", `festive ${line.id} must be mode:both`);
}

// ── 2. normalization is defensive ─────────────────────────────────────────
assert.equal(t.normalizeLibrary(null), null, "null → unusable");
assert.equal(t.normalizeLibrary({}), null, "missing lines → unusable");
assert.equal(t.normalizeLibrary({ lines: [] }), null, "empty library → unusable");
assert.equal(t.normalizeLibrary({ lines: [{ text: "no id" }] }), null, "entries need an id");
assert.equal(t.normalizeLibrary({ lines: [{ id: "a", text: "" }] }), null, "empty text is dropped");

const messy = t.normalizeLibrary({
	lines: [
		{ id: "a", text: "hello" },
		{ id: "a", text: "duplicate id" },
		{ id: "b", text: "x", mode: "nonsense", weight: -3, cooldown: "soon" },
		{ id: "c", text: "y", weight: 4, cooldown: 30 }
	]
});
assert.equal(messy.lines.length, 3, "duplicate ids collapse, valid rows stay");
assert.equal(messy.lines[0].kind, "idle", "kind defaults to idle");
assert.equal(messy.lines[0].mode, "both", "unknown mode degrades to both");
assert.equal(messy.lines[1].weight, 1, "non-positive weight → 1");
assert.equal(messy.lines[1].cooldown, 600, "non-numeric cooldown → library default");
assert.equal(messy.lines[2].weight, 4, "explicit weight is kept");
assert.equal(messy.lines[2].cooldown, 30, "explicit cooldown is kept");

// ── 3. persona separation: the two modes must read differently ────────────
const omoteTexts = new Set(lib.lines.filter((l) => l.mode === "omote").map((l) => l.text));
const uraTexts = new Set(lib.lines.filter((l) => l.mode === "ura").map((l) => l.text));
assert.equal(omoteTexts.size, lib.lines.filter((l) => l.mode === "omote").length, "omote texts unique");
assert.equal(uraTexts.size, lib.lines.filter((l) => l.mode === "ura").length, "ura texts unique");
for (const text of omoteTexts) {
	assert.ok(!uraTexts.has(text), `a line may not serve both personas: ${text}`);
}

// ── 4. selection honours the persona ─────────────────────────────────────
const now = new Date(2026, 9, 29, 14, 0, 0).getTime(); // 2026-10-29 14:00 local
const pick = (opts) => t.pickLine(lib, { kind: "click", mode: "omote", now, rng: () => 0, ...opts });

const omotePick = pick({ mode: "omote" });
assert.ok(omotePick.mode === "omote" || omotePick.mode === "both", "omote mode never yields a ura line");
const uraPick = pick({ mode: "ura" });
assert.ok(uraPick.mode === "ura" || uraPick.mode === "both", "ura mode never yields an omote line");

// An unknown kind is null, not a crash.
assert.equal(t.pickLine(lib, { kind: "nope", mode: "omote", now }), null);

// ── 5. the cycle rule: no repeat until the pool is exhausted ─────────────
// This is what makes "click 20 times, nothing repeats" a guarantee rather than
// a probability. Walk a whole pool and check every line appears exactly once.
{
	const used = new Set();
	const seen = [];
	const pool = (lib.byKind.get("click") ?? []).filter((l) => l.mode === "omote" || l.mode === "both");
	for (let i = 0; i < pool.length; i++) {
		const line = t.pickLine(lib, { kind: "click", mode: "omote", now, used, rng: Math.random });
		assert.ok(line !== null, "pick must succeed while the cycle has room");
		assert.ok(seen.indexOf(line.id) < 0, `line ${line.id} repeated inside one cycle`);
		seen.push(line.id);
	}
	assert.equal(seen.length, pool.length, "one full cycle covers the whole pool");
	// The next pick starts a fresh cycle instead of returning null.
	const after = t.pickLine(lib, { kind: "click", mode: "omote", now, used, rng: Math.random });
	assert.ok(after !== null, "cycle restarts once exhausted");
}

// 20 consecutive clicks over the real library never repeat.
{
	const used = new Set();
	const seen = new Set();
	for (let i = 0; i < 20; i++) {
		const line = t.pickLine(lib, { kind: "click", mode: "omote", now, used, rng: Math.random });
		assert.ok(line !== null);
		assert.ok(!seen.has(line.id), `click #${i + 1} repeated ${line.id}`);
		seen.add(line.id);
	}
}

// ── 6. cooldowns gate repeats across cycles ──────────────────────────────
{
	const line = (lib.byKind.get("think") ?? []).find((l) => l.mode === "omote");
	const cooldowns = { [line.id]: now };
	// Force the pool down to that one line by asking for a kind with a single
	// omote entry: the cooling line must still be returned rather than nothing.
	const only = {
		...lib,
		byKind: new Map([["solo", [line]]])
	};
	const got = t.pickLine(only, { kind: "solo", mode: "omote", now, cooldowns });
	assert.ok(got !== null, "a cooling line is still better than silence");
	// Once its cooldown has elapsed the same line is freely eligible again.
	const later = now + line.cooldown * 1000 + 1;
	const again = t.pickLine(only, { kind: "solo", mode: "omote", now: later, cooldowns });
	assert.equal(again.id, line.id);
}

// ── 7. `once` lines play at most once ────────────────────────────────────
{
	const birthday = lib.lines.find((l) => l.id === "festive.birthday");
	assert.ok(birthday.once, "the birthday line is marked once");
	const birthdayDay = new Date(2026, 11, 4, 12, 0, 0).getTime();
	const first = t.pickLine(lib, { kind: "festive", mode: "omote", now: birthdayDay, seenOnce: [] });
	assert.ok(first !== null);
	// Any festive line may win the first roll; the ledger must exclude it after.
	const seenOnce = [birthday.id];
	const second = t.pickLine(lib, {
		kind: "festive",
		mode: "omote",
		now: birthdayDay,
		seenOnce,
		used: new Set()
	});
	if (second !== null) assert.notEqual(second.id, birthday.id, "a once line must not replay");
}

// ── 8. calendar and hour conditions ─────────────────────────────────────
{
	const birthday = lib.lines.find((l) => l.id === "festive.birthday");
	assert.equal(t.matchesSchedule(birthday, new Date(2026, 11, 4, 9, 0).getTime()), true);
	assert.equal(t.matchesSchedule(birthday, new Date(2026, 11, 5, 9, 0).getTime()), false);
	// Zero-padding matters: 1 Jan must match "01-01".
	const newYear = lib.lines.find((l) => l.id === "festive.newyear");
	assert.equal(t.matchesSchedule(newYear, new Date(2027, 0, 1, 0, 30).getTime()), true);
	assert.equal(t.matchesSchedule(newYear, new Date(2027, 0, 11, 0, 30).getTime()), false);

	// `fromHour: 2` means "2am and later" (wrapping window handled by toHour).
	const late = lib.lines.find((l) => l.id === "festive.latenight");
	assert.equal(late.fromHour, 2);
	assert.equal(t.matchesSchedule(late, new Date(2026, 9, 29, 1, 0).getTime()), false, "01:00 is before 02:00");
	assert.equal(t.matchesSchedule(late, new Date(2026, 9, 29, 3, 0).getTime()), true, "03:00 is after 02:00");

	// A wrapping window [22, 4) covers both sides of midnight.
	const wrap = { date: null, fromHour: 22, toHour: 4 };
	assert.equal(t.matchesSchedule(wrap, new Date(2026, 9, 29, 23, 0).getTime()), true);
	assert.equal(t.matchesSchedule(wrap, new Date(2026, 9, 29, 2, 0).getTime()), true);
	assert.equal(t.matchesSchedule(wrap, new Date(2026, 9, 29, 12, 0).getTime()), false);
}

// ── 9. variable substitution ────────────────────────────────────────────
assert.equal(t.applyVars("你好{称呼}", { 称呼: "你" }), "你好你");
assert.equal(t.applyVars("花了{今日花费}", { 今日花费: "¥1.23" }), "花了¥1.23");
// Unknown placeholders stay visible, so a JSON typo is not silently swallowed.
assert.equal(t.applyVars("剩下{余额}", {}), "剩下{余额}");
assert.equal(t.applyVars("no vars", { 称呼: "你" }), "no vars");

// ── 10. bubble sizing and error summaries ───────────────────────────────
assert.ok(t.bubbleMs("短") >= 1800, "very short text still gets a readable dwell");
assert.ok(t.bubbleMs("很长".repeat(200)) <= 6000, "long text is capped");
assert.ok(t.bubbleMs("中等长度的台词，大约二十来个字符。") > t.bubbleMs("短"), "longer text lingers longer");

assert.equal(t.summarizeError(""), "");
assert.equal(t.summarizeError(null), "");
assert.equal(t.summarizeError("boom"), "boom");
// Whitespace is flattened so a multi-line provider error stays one bubble line.
assert.equal(t.summarizeError("line1\n\n  line2"), "line1 line2");
// Keys are masked — the privacy rule applies to anything user-visible.
assert.equal(t.summarizeError("auth failed for sk-abcdef1234567890"), "auth failed for sk-****");
assert.ok(t.summarizeError("x".repeat(500)).length <= t.ERROR_SNIPPET + 1, "long errors are truncated");
assert.ok(t.summarizeError("x".repeat(500)).endsWith("…"));

// ── 11. the sprite state machine priority ───────────────────────────────
// drag > talk > panic > sleep > work > think > curious > idle
assert.equal(t.deriveSpriteState({ activity: "idle" }), "idle");
assert.equal(t.deriveSpriteState({ activity: "think" }), "think");
assert.equal(t.deriveSpriteState({ activity: "work" }), "work");
assert.equal(t.deriveSpriteState({ activity: "panic" }), "panic");
assert.equal(t.deriveSpriteState({ activity: "idle", hovering: true }), "curious");
assert.equal(t.deriveSpriteState({ activity: "idle", sleeping: true }), "sleepy");
// A click reaction outranks every session fact.
assert.equal(t.deriveSpriteState({ activity: "panic", talking: true }), "talk");
// Dragging outranks everything — she should look grabbed, not busy.
assert.equal(t.deriveSpriteState({ activity: "work", talking: true, dragging: true }), "dragged");
// Sleep only beats the quiet states, never a running turn.
assert.equal(t.deriveSpriteState({ activity: "work", sleeping: true }), "sleepy");
assert.equal(t.deriveSpriteState({ activity: "think", sleeping: true }), "sleepy");
// ...but that combination is unreachable: `shouldSleep` refuses to fire while a
// turn is running, so the guard lives at the source, not in the fold. This is
// the property that actually matters.
assert.equal(t.shouldSleep({ hour: 23, now: 2_000_000_000_000, lastInteractionAt: 0, activity: "work" }), false);
assert.equal(t.shouldSleep({ hour: 23, now: 2_000_000_000_000, lastInteractionAt: 0, activity: "think" }), false);
assert.equal(t.shouldSleep({ hour: 23, now: 2_000_000_000_000, lastInteractionAt: 0, activity: "panic" }), false);

// ── 12. the doze window ─────────────────────────────────────────────────
assert.equal(t.isSleepHour(23), true);
assert.equal(t.isSleepHour(0), true);
assert.equal(t.isSleepHour(5), true);
assert.equal(t.isSleepHour(6), false, "06:00 is morning");
assert.equal(t.isSleepHour(14), false);

const hourAgo = 2 * 60 * 60 * 1000;
const base = { hour: 23, now: 1_000_000_000_000, activity: "idle" };
assert.equal(t.shouldSleep({ ...base, lastInteractionAt: base.now - hourAgo }), true);
assert.equal(t.shouldSleep({ ...base, lastInteractionAt: base.now - 1000 }), false, "just interacted");
assert.equal(t.shouldSleep({ ...base, hour: 14, lastInteractionAt: 0 }), false, "not late");
assert.equal(t.shouldSleep({ ...base, activity: "work", lastInteractionAt: 0 }), false, "never doze mid-turn");

// ── 13. hotspot hit-testing (the ahoge is data, not code) ───────────────
const spots = [
	{ id: "ahoge", x: 0.5, y: 0.06, w: 0.22, h: 0.14 },
	{ id: "body", x: 0.5, y: 0.55, w: 0.8, h: 0.85 }
];
assert.equal(t.hitHotspot(spots, 0.5, 0.06), "ahoge", "dead centre of the ahoge");
assert.equal(t.hitHotspot(spots, 0.5, 0.9), "body", "feet are body");
assert.equal(t.hitHotspot(spots, 0.02, 0.5), null, "outside the sprite");
assert.equal(t.hitHotspot(null, 0.5, 0.5), null, "no manifest → no hotspot");
assert.equal(t.hitHotspot([], 0.5, 0.5), null);
// Malformed entries must not throw.
assert.equal(t.hitHotspot([{ id: "x" }], 0.5, 0.5), "x", "missing extents default to a centred box");

// The real manifest's hotspots must keep the ahoge on top.
const manifest = JSON.parse(readFileSync(resolve(pkgRoot, "pets", "fuyuko", "pet.json"), "utf8"));
assert.ok(Array.isArray(manifest.hotspots) && manifest.hotspots.length >= 2);
assert.equal(manifest.hotspots[0].id, "ahoge", "the ahoge must be tested before the body");

// ── 14. bubble and menu placement ───────────────────────────────────────
{
	const viewport = { width: 1280, height: 800 };
	const above = t.placeBubble({ x: 1000, y: 400 }, 160, viewport);
	assert.equal(above.side, "above");
	assert.equal(above.top, 392, "8px of air above her head");
	assert.equal(above.left, 1080, "centred on her, inside the viewport");

	// Near the top edge the bubble flips below instead of being clipped.
	const below = t.placeBubble({ x: 1000, y: 10 }, 160, viewport);
	assert.equal(below.side, "below");
	assert.ok(below.top > 10 + 160, "below the sprite");

	// A pet hugging the right edge must not push the bubble off-screen.
	const right = t.placeBubble({ x: 1240, y: 400 }, 160, viewport);
	assert.ok(right.left + 120 <= viewport.width, "bubble stays on screen");

	const menu = t.placeMenu(1270, 790, { width: 184, height: 300 }, viewport);
	assert.ok(menu.left + 184 <= viewport.width);
	assert.ok(menu.top + 300 <= viewport.height);
	assert.deepEqual(t.placeMenu(-50, -50, { width: 184, height: 100 }, viewport), { left: 8, top: 8 });

	// Menu height estimation counts separators as their own thin row.
	const items = t.menuItemsFor(t.defaultPetState());
	assert.ok(t.menuSize(items).height > items.length * 20, "estimate scales with row count");
}

// ── 15. pet-state persistence and migration ─────────────────────────────
const fresh = t.defaultPetState();
assert.equal(fresh.schemaVersion, t.PET_STATE_VERSION);
assert.equal(fresh.mode, "omote", "she starts in 营业模式");
assert.equal(fresh.muted, false);
assert.equal(fresh.hidden, false);

// Junk in storage must degrade to defaults, never throw.
assert.deepEqual(t.sanitizePetState(null), fresh);
assert.deepEqual(t.sanitizePetState("nope"), fresh);
assert.deepEqual(t.sanitizePetState(42), fresh);
assert.deepEqual(t.sanitizePetState({}), fresh);

const migrated = t.sanitizePetState({
	mode: "ura",
	muted: true,
	hidden: true,
	cooldowns: { "idle.omote.01": 12345, bad: "x" },
	onceSeen: ["festive.birthday", 7],
	counters: { clicks: 3, talks: 9, drags: -2 },
	lastInteractionAt: 999
});
assert.equal(migrated.mode, "ura");
assert.equal(migrated.muted, true);
assert.equal(migrated.hidden, true);
assert.deepEqual(migrated.cooldowns, { "idle.omote.01": 12345 }, "non-numeric cooldowns dropped");
assert.deepEqual(migrated.onceSeen, ["festive.birthday"], "non-string ledger entries dropped");
assert.equal(migrated.counters.clicks, 3);
assert.equal(migrated.counters.talks, 9);
assert.equal(migrated.counters.drags, 0, "negative counters reset");
assert.equal(migrated.lastInteractionAt, 999);

// Round-trips through localStorage.
t.writePetState(migrated);
assert.deepEqual(t.readPetState(), migrated);
window.localStorage.setItem("dsh-pet-fuyuko:state", "{not json");
assert.deepEqual(t.readPetState(), fresh, "corrupt blob → defaults");

// Cooldown table pruning keeps the newest entries and stays bounded.
{
	const cooldowns = {};
	for (let i = 0; i < 500; i++) cooldowns[`line.${i}`] = 1000 + i;
	t.pruneCooldowns(cooldowns);
	const left = Object.keys(cooldowns);
	assert.equal(left.length, 300, "pruned down to 300");
	assert.ok(cooldowns["line.499"] !== undefined, "newest entry survives");
	assert.equal(cooldowns["line.0"], undefined, "oldest entry is dropped");
}

// ── 16. the context menu reflects the current persona ───────────────────
{
	const omoteMenu = t.menuItemsFor({ ...fresh, mode: "omote", muted: false });
	const modeRow = omoteMenu.find((i) => i.id === "mode");
	assert.equal(modeRow.label, "切换到本体模式", "offers the other persona");

	const uraMenu = t.menuItemsFor({ ...fresh, mode: "ura", muted: true });
	assert.equal(uraMenu.find((i) => i.id === "mode").label, "切换到营业模式");
	assert.equal(uraMenu.find((i) => i.id === "mute").label, "取消静音");

	// M3/M4 entries are present but disabled, so the menu shape is stable.
	for (const id of ["balance", "feed"]) {
		const row = omoteMenu.find((i) => i.id === id);
		assert.ok(row, `${id} placeholder exists`);
		assert.equal(row.disabled, true, `${id} is not wired yet`);
	}
	assert.ok(omoteMenu.some((i) => i.sep === true), "the menu has separators");
}

// ── 17. cycles are per kind AND per persona ─────────────────────────────
{
	t.resetCycles();
	const omote = t.cycleFor("click", "omote");
	const ura = t.cycleFor("click", "ura");
	assert.notEqual(omote, ura, "personas keep separate cycles");
	assert.equal(t.cycleFor("click", "omote"), omote, "same key returns the same set");
	t.resetCycles();
	assert.notEqual(t.cycleFor("click", "omote"), omote, "reset clears every cycle");
}

console.log("lines: all checks passed");
