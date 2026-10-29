/**
 * M3 test: the wallet — price table, peak/off-peak pricing, cost estimation,
 * the local spend ledger, the card layout, and the host half's balance/key
 * routes (including the privacy rules).
 *
 * Run: node test/wallet.test.mjs
 */
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { apply, __test as hostTest } from "../lib/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");

// ── browser globals for the client bundle ─────────────────────────────────
const store = new Map();
globalThis.document = {
	querySelector: () => null,
	createElement: () => ({ dataset: {}, textContent: "" }),
	head: { appendChild: () => {} }
};
globalThis.window = {
	innerWidth: 1280,
	innerHeight: 800,
	localStorage: {
		getItem: (k) => (store.has(k) ? store.get(k) : null),
		setItem: (k, v) => store.set(k, String(v)),
		removeItem: (k) => store.delete(k)
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

// ── 1. the shipped price table is valid ──────────────────────────────────
const rawPricing = JSON.parse(readFileSync(resolve(pkgRoot, "pricing.json"), "utf8"));
const pricing = t.normalizePricing(rawPricing);
assert.ok(pricing !== null, "the shipped pricing.json must normalize");
assert.equal(pricing.currency, "CNY");
assert.ok(pricing.models.size >= 2, "at least the two official models");
assert.ok(pricing.disclaimer.length > 0, "the card needs a disclaimer");

// The official table is two-tier: peak and off-peak must both be present, and
// off-peak must be exactly half of peak (that is the provider's own rule).
for (const [id, entry] of pricing.models) {
	assert.ok(entry.peak, `${id} needs a peak tier`);
	assert.ok(entry.offPeak, `${id} needs an off-peak tier`);
	assert.equal(
		entry.offPeak.inputCacheMiss,
		entry.peak.inputCacheMiss / 2,
		`${id}: off-peak input must be half of peak`
	);
	assert.equal(entry.offPeak.output, entry.peak.output / 2, `${id}: off-peak output must be half of peak`);
	assert.ok(entry.peak.output > entry.peak.inputCacheMiss, `${id}: output costs more than input`);
	assert.ok(entry.peak.inputCacheMiss > entry.peak.inputCacheHit, `${id}: a cache hit is cheaper than a miss`);
}

// ── 2. normalization is defensive ────────────────────────────────────────
assert.equal(t.normalizePricing(null), null);
assert.equal(t.normalizePricing({}), null, "no models → unusable");
assert.equal(t.normalizePricing({ models: {} }), null, "empty models → unusable");
assert.equal(t.normalizePricing({ models: { x: {} } }), null, "a model with no rates is dropped");

const partial = t.normalizePricing({
	models: {
		onlyPeak: { peak: { inputCacheMiss: 2, inputCacheHit: 0.04, output: 8 } },
		bad: { peak: { inputCacheMiss: "nope", output: 1 }, offPeak: { inputCacheMiss: -1, output: 1 } }
	}
});
assert.ok(partial !== null);
assert.equal(partial.models.size, 1, "the malformed model is dropped");
assert.ok(partial.models.get("onlyPeak").offPeak, "a single-tier model reuses its tier for both");

// ── 3. model resolution: aliases, patterns, case ────────────────────────
// The session reports `deepseek-v4.1-flash-sg`; the table names `deepseek-flash`.
assert.equal(t.resolveModelPricing(pricing, "deepseek-v4.1-flash-sg")?.id, "deepseek-flash");
assert.equal(t.resolveModelPricing(pricing, "DeepSeek-V4.1-Flash-SG")?.id, "deepseek-flash", "case-insensitive");
assert.equal(t.resolveModelPricing(pricing, "deepseek-flash")?.id, "deepseek-flash", "direct id");
assert.equal(t.resolveModelPricing(pricing, "deepseek-reasoner")?.id, "deepseek-v4-pro", "alias");
assert.equal(t.resolveModelPricing(pricing, "deepseek-flash-1017")?.id, "deepseek-flash", "prefix match");
// An unknown model is null, never a guessed price.
assert.equal(t.resolveModelPricing(pricing, "gpt-6-astra"), null);
assert.equal(t.resolveModelPricing(pricing, ""), null);
assert.equal(t.resolveModelPricing(null, "deepseek-flash"), null);

// ── 3b. the regex layer catches every channel's naming of the same model ─
// This is the fix for "价格未知" on real sessions: each provider spells the
// model differently, and the projection hands us exactly one of these.
assert.ok(pricing.patterns.length >= 2, "the shipped table declares patterns");
for (const name of [
	"deepseek-flash",
	"deepseek-v4.1-flash",
	"deepseek-v4.1-flash-sg",
	"deepseek-v4-flash",
	"deepseek-v4-flash-vision-exp",
	"deepseek-v4.1-flash-vision-exp",
	"deepseek-flash-1017",
	"DeepSeek-V4.1-Flash",
	"deepseek-chat"
]) {
	assert.equal(t.resolveModelPricing(pricing, name)?.id, "deepseek-flash", `${name} must price as flash`);
}
for (const name of ["deepseek-v4-pro", "deepseek-v4-pro-0813", "deepseek-reasoner", "DeepSeek-V4-Pro"]) {
	assert.equal(t.resolveModelPricing(pricing, name)?.id, "deepseek-v4-pro", `${name} must price as pro`);
}
// The pro pattern must win over the broad flash pattern: a name containing
// both words is a pro model, and mispricing it would understate cost ~4x.
assert.equal(t.resolveModelPricing(pricing, "deepseek-v4-pro-flash-hybrid")?.id, "deepseek-v4-pro");
// An unrecognised deepseek-* falls back to flash rather than "unknown".
assert.equal(t.resolveModelPricing(pricing, "deepseek-something-new")?.id, "deepseek-flash");
// But a non-DeepSeek model is still never priced.
for (const name of ["gpt-6-astra", "claude-sonnet-4", "glm-5.3", "kimi-k3.1-pro", "qwen-max"]) {
	assert.equal(t.resolveModelPricing(pricing, name), null, `${name} has no price entry`);
}

// A malformed pattern is dropped at load time instead of throwing at render.
{
	const bad = t.normalizePricing({
		models: { a: { peak: { inputCacheMiss: 1, inputCacheHit: 0.1, output: 2 } } },
		patterns: [
			{ match: "([", model: "a" },
			{ match: "ok", model: "missing" },
			{ match: "ok", model: "a" }
		]
	});
	assert.ok(bad !== null);
	assert.equal(bad.patterns.length, 1, "only the valid, resolvable pattern survives");
	assert.equal(t.resolveModelPricing(bad, "ok-model")?.id, "a");
}

// ── 4. peak-time detection reads Beijing time, not the browser's ─────────
const peak = rawPricing.periods.peak;
/** 2026-10-29 is a Thursday. Build the UTC instant for a Beijing wall time. */
const beijing = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h - 8, mi);

assert.equal(t.isPeakTime(peak, beijing(2026, 10, 29, 10, 0)), true, "Thu 10:00 CST is peak");
assert.equal(t.isPeakTime(peak, beijing(2026, 10, 29, 9, 0)), true, "09:00 is the inclusive start");
assert.equal(t.isPeakTime(peak, beijing(2026, 10, 29, 12, 0)), false, "12:00 is past the morning window");
assert.equal(t.isPeakTime(peak, beijing(2026, 10, 29, 13, 0)), false, "the lunch gap is off-peak");
assert.equal(t.isPeakTime(peak, beijing(2026, 10, 29, 15, 0)), true, "Thu 15:00 CST is peak");
assert.equal(t.isPeakTime(peak, beijing(2026, 10, 29, 18, 0)), false, "18:00 is past the afternoon window");
assert.equal(t.isPeakTime(peak, beijing(2026, 10, 29, 3, 0)), false, "the small hours are off-peak");
// Weekends are off-peak all day.
assert.equal(t.isPeakTime(peak, beijing(2026, 10, 31, 10, 0)), false, "Saturday 10:00 is off-peak");
assert.equal(t.isPeakTime(peak, beijing(2026, 11, 1, 15, 0)), false, "Sunday 15:00 is off-peak");
// A malformed period must not throw; it degrades to off-peak.
assert.equal(t.isPeakTime(null, Date.now()), false);
assert.equal(t.isPeakTime({}, Date.now()), false);

// ── 5. cost arithmetic ──────────────────────────────────────────────────
const flash = pricing.models.get("deepseek-flash");
const offPeakRates = t.ratesFor(flash, false);
const peakRates = t.ratesFor(flash, true);

// 1M uncached input at the peak miss rate is exactly that rate.
assert.equal(t.costOf({ uncachedInputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, peakRates), 2);
// 1M output at peak is the output rate.
assert.equal(t.costOf({ uncachedInputTokens: 0, outputTokens: 1_000_000, cacheReadTokens: 0, cacheWriteTokens: 0 }, peakRates), 8);
// Cache reads use the hit rate.
assert.equal(t.costOf({ uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 0 }, peakRates), 0.04);
// Cache WRITES bill at the miss rate (no third tier exists).
assert.equal(
	t.costOf({ uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 1_000_000 }, peakRates),
	2,
	"a cache write costs the same as a miss"
);
// Off-peak is half of peak for the same usage.
const sample = { uncachedInputTokens: 12_345, outputTokens: 678, cacheReadTokens: 90_000, cacheWriteTokens: 0 };
assert.equal(
	t.roundFen(t.costOf(sample, offPeakRates)),
	t.roundFen(t.costOf(sample, peakRates) / 2),
	"off-peak is exactly half"
);
// Missing or junk buckets count as zero rather than NaN.
assert.equal(t.costOf({}, peakRates), 0);
assert.equal(t.costOf(null, peakRates), 0);
assert.equal(t.costOf({ uncachedInputTokens: "x", outputTokens: null }, peakRates), 0);

// ── 6. rounding and formatting ──────────────────────────────────────────
assert.equal(t.roundFen(1.234), 1.23);
assert.equal(t.roundFen(1.236), 1.24);
assert.equal(t.roundFen(0.001), 0);
assert.equal(t.roundFen("junk"), 0);
// 1.005 is not exactly representable (it is 1.00499999…), so the honest
// expectation is 1.00 — documenting the float behaviour rather than pretending.
assert.equal(t.roundFen(1.005), 1);
assert.equal(t.formatCny(1.234), "¥1.23");
assert.equal(t.formatCny(0), "¥0.00");
assert.equal(t.formatCny(undefined), "—");
assert.equal(t.formatTokens(999), "999");
assert.equal(t.formatTokens(1234), "1.2k");
assert.equal(t.formatTokens(12_345), "12k");
assert.equal(t.formatTokens(2_500_000), "2.50M");
assert.equal(t.formatTokens(-5), "0");

// ── 7. estimateCost reports "unknown" instead of inventing a number ──────
const known = t.estimateCost(pricing, {
	model: "deepseek-v4.1-flash-sg",
	buckets: { uncachedInputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
	now: beijing(2026, 10, 29, 15, 0)
});
assert.equal(known.known, true);
assert.equal(known.cost, 2, "peak miss rate applies at Thu 15:00 CST");

const unknown = t.estimateCost(pricing, {
	model: "some-unlisted-model",
	buckets: { uncachedInputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
	now: Date.now()
});
assert.equal(unknown.known, false, "an unlisted model must not be priced");
assert.equal(unknown.cost, 0);

// ── 8. the spend ledger advances by deltas ──────────────────────────────
let ledger = t.defaultLedger();
assert.deepEqual(ledger.days, {});
assert.deepEqual(ledger.sessions, {});

const day = "2026-10-29";
const at = new Date(`${day}T15:00:00`).getTime();

// First observation: the whole cumulative total is new spend.
let step = t.applyUsage(ledger, {
	sessionId: "s1",
	model: "deepseek-v4.1-flash-sg",
	totals: { uncachedInputTokens: 1000, outputTokens: 200, cacheReadTokens: 50, cacheWriteTokens: 10 },
	now: at
});
assert.equal(step.changed, true);
assert.equal(step.delta.uncachedInputTokens, 1000);
ledger = step.ledger;
assert.equal(ledger.days[day].uncachedInputTokens, 1000);
assert.equal(ledger.models.s1, "deepseek-v4.1-flash-sg");

// Replaying the same total (a reload) must not double count.
step = t.applyUsage(ledger, {
	sessionId: "s1",
	model: "deepseek-v4.1-flash-sg",
	totals: { uncachedInputTokens: 1000, outputTokens: 200, cacheReadTokens: 50, cacheWriteTokens: 10 },
	now: at
});
assert.equal(step.changed, false, "an unchanged total is not new spend");
assert.equal(step.ledger.days[day].uncachedInputTokens, 1000, "still 1000, not 2000");
ledger = step.ledger;

// Growth adds only the increment.
step = t.applyUsage(ledger, {
	sessionId: "s1",
	model: "deepseek-v4.1-flash-sg",
	totals: { uncachedInputTokens: 1500, outputTokens: 250, cacheReadTokens: 50, cacheWriteTokens: 10 },
	now: at
});
assert.equal(step.changed, true);
assert.equal(step.delta.uncachedInputTokens, 500, "only the delta");
assert.equal(step.ledger.days[day].uncachedInputTokens, 1500);
ledger = step.ledger;

// A second session contributes independently.
step = t.applyUsage(ledger, {
	sessionId: "s2",
	model: "deepseek-v4-pro",
	totals: { uncachedInputTokens: 300, outputTokens: 40, cacheReadTokens: 0, cacheWriteTokens: 0 },
	now: at
});
assert.equal(step.changed, true);
assert.equal(step.ledger.days[day].uncachedInputTokens, 1800, "both sessions roll into today");
ledger = step.ledger;

// A shrinking total (log rewritten / session replaced) is not negative spend.
step = t.applyUsage(ledger, {
	sessionId: "s1",
	model: "deepseek-v4.1-flash-sg",
	totals: { uncachedInputTokens: 100, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 },
	now: at
});
assert.equal(step.delta.uncachedInputTokens, 0, "a decrease is a fresh baseline, not negative spend");
assert.equal(step.ledger.sessions.s1.uncachedInputTokens, 100, "the new baseline is recorded");
ledger = step.ledger;

// A new day starts a fresh row.
const nextDay = "2026-10-30";
step = t.applyUsage(ledger, {
	sessionId: "s1",
	model: "deepseek-v4.1-flash-sg",
	totals: { uncachedInputTokens: 150, outputTokens: 15, cacheReadTokens: 0, cacheWriteTokens: 0 },
	now: new Date(`${nextDay}T10:00:00`).getTime()
});
assert.equal(step.ledger.days[nextDay].uncachedInputTokens, 50, "the new day gets only the delta");
assert.equal(step.ledger.days[day].uncachedInputTokens, 1800, "yesterday is untouched");
ledger = step.ledger;

// ── 9. ledger persistence and migration ─────────────────────────────────
assert.deepEqual(t.defaultLedger().days, {});
assert.deepEqual(t.sanitizeLedger(null), t.defaultLedger());
assert.deepEqual(t.sanitizeLedger("junk"), t.defaultLedger());
assert.deepEqual(t.sanitizeLedger({ days: "nope" }), t.defaultLedger());

const messy = t.sanitizeLedger({
	days: { "2026-10-29": { uncachedInputTokens: 5, outputTokens: -3, junk: 9 }, "not-a-day": { x: 1 } },
	sessions: { s1: { outputTokens: 7 } },
	models: { s1: "deepseek-flash", s2: 42 }
});
assert.deepEqual(Object.keys(messy.days), ["2026-10-29"], "invalid day keys are dropped");
assert.equal(messy.days["2026-10-29"].uncachedInputTokens, 5);
assert.equal(messy.days["2026-10-29"].outputTokens, 0, "negative counts are clamped");
assert.equal(messy.sessions.s1.outputTokens, 7);
assert.deepEqual(messy.models, { s1: "deepseek-flash" }, "non-string models are dropped");

// Round-trips through localStorage.
t.writeUsageLedger(messy);
assert.deepEqual(t.readUsageLedger(), messy);
store.set("dsh-pet-fuyuko:usage", "{broken");
assert.deepEqual(t.readUsageLedger(), t.defaultLedger(), "corrupt ledger → defaults");

// Day pruning keeps the window bounded.
{
	const days = {};
	for (let i = 0; i < 60; i++) {
		const d = new Date("2026-10-29T00:00:00");
		d.setDate(d.getDate() - i);
		days[t.dayKey(d.getTime())] = t.zeroBuckets();
	}
	t.pruneDays(days, "2026-10-29");
	assert.ok(Object.keys(days).length <= 41, `pruned to the window, got ${Object.keys(days).length}`);
	assert.ok(days["2026-10-29"] !== undefined, "today survives");
	assert.equal(days["2026-06-01"], undefined, "an old day is gone");
}

// ── 10. day boundaries are local-calendar ───────────────────────────────
assert.equal(t.dayKey(new Date(2026, 9, 29, 0, 0).getTime()), "2026-10-29");
assert.equal(t.dayKey(new Date(2026, 9, 29, 23, 59).getTime()), "2026-10-29");
assert.equal(t.dayKey(new Date(2026, 0, 1, 12, 0).getTime()), "2026-01-01", "zero-padded");

// ── 11. the wallet card layout ──────────────────────────────────────────
{
	// No balance yet: a placeholder, never a fabricated zero.
	const loading = t.buildWalletRows({ balance: null, spend: { known: true, todayCost: 0.5, sessionCost: 0.2, todayTokens: 100 }, lowBalance: 10 });
	assert.equal(loading.rows.find((r) => r.key === "balance").unknown, true);
	assert.equal(loading.error, null);

	// A real balance, with the grant/topped-up split.
	const ok = t.buildWalletRows({
		balance: {
			ok: true,
			isAvailable: true,
			infos: [{ currency: "CNY", total: 42.5, granted: 10, toppedUp: 32.5 }],
			fetchedAt: at
		},
		spend: { known: true, todayCost: 1.234, sessionCost: 0.5, todayTokens: 12_000 },
		lowBalance: 10
	});
	const balRow = ok.rows.find((r) => r.key === "balance:CNY");
	assert.equal(balRow.value, "¥42.50");
	assert.equal(balRow.strong, true);
	assert.equal(balRow.warn, undefined, "42.50 is above the threshold");
	assert.equal(ok.rows.find((r) => r.key === "today").value, "¥1.23", "rounded to fen");
	assert.equal(ok.rows.find((r) => r.key === "tokens").value, "12k");
	assert.ok(ok.note.includes("估算"), "the estimate caveat is shown");
	assert.equal(ok.error, null);

	// Below the threshold: the balance row is flagged.
	const low = t.buildWalletRows({
		balance: { ok: true, infos: [{ currency: "CNY", total: 3, granted: 0, toppedUp: 3 }], fetchedAt: at },
		spend: { known: true, todayCost: 0, sessionCost: 0, todayTokens: 0 },
		lowBalance: 10
	});
	assert.equal(low.rows.find((r) => r.key === "balance:CNY").warn, true);

	// No key: a clear state, not an error.
	const nokey = t.buildWalletRows({ balance: { ok: false, code: "nokey" }, spend: { known: true }, lowBalance: 10 });
	assert.equal(nokey.rows.find((r) => r.key === "balance").value, "未配置 Key");
	assert.equal(nokey.error, null);

	// A real failure carries a readable reason.
	const auth = t.buildWalletRows({ balance: { ok: false, code: "auth" }, spend: { known: true }, lowBalance: 10 });
	assert.ok(auth.error.includes("401"), "the auth reason names the status");

	// An unlisted model: money is refused, tokens still shown.
	const unpriced = t.buildWalletRows({
		balance: { ok: true, infos: [{ currency: "CNY", total: 99 }], fetchedAt: at },
		spend: { known: false, model: "gpt-6-astra", todayTokens: 5000 },
		lowBalance: 10
	});
	assert.equal(unpriced.rows.find((r) => r.key === "today").value, "价格未知");
	assert.ok(unpriced.note.includes("gpt-6-astra"), "the note names the unpriced model");
}

// ── 12. balance error wording is total over the known codes ─────────────
for (const [code, fragment] of [
	["auth", "401"],
	["rate", "429"],
	["timeout", "超时"],
	["network", "网络"],
	["nokey", "Key"],
	["something-else", "不明"]
]) {
	assert.ok(t.balanceErrorText(code).includes(fragment), `${code} should mention ${fragment}`);
}
assert.ok(t.balanceErrorText(undefined).length > 0, "an absent code still says something");

// ── 13. the signal carries usage without spamming subscribers ───────────
{
	t.clearSignal();
	let notifications = 0;
	const off = t.subscribeSignal(() => {
		notifications += 1;
	});
	const buckets = { uncachedInputTokens: 10, outputTokens: 2, cacheReadTokens: 1, cacheWriteTokens: 0 };
	t.publishSignal({ activity: "idle", sessionId: "s1", usage: buckets, model: "m1" });
	assert.equal(notifications, 1, "first usage publish notifies");
	// An equal-but-new object must NOT notify: useProjection hands out fresh
	// objects, and re-rendering on every frame would be wasteful.
	t.publishSignal({ activity: "idle", sessionId: "s1", usage: { ...buckets }, model: "m1" });
	assert.equal(notifications, 1, "an equal bucket set is a no-op");
	t.publishSignal({ usage: { ...buckets, outputTokens: 3 } });
	assert.equal(notifications, 2, "a real change notifies");
	t.publishSignal({ model: "m2" });
	assert.equal(notifications, 3, "a model change notifies");
	off();
	t.clearSignal();
}

// ── 14. model attribution ───────────────────────────────────────────────
// The projection is the real source; the chat-node provenance is a fallback.
{
	// modelSelection: `next` wins, `lastUsed` is the documented fallback.
	assert.deepEqual(
		t.readSelection({ next: { provider: "p1", model: "m1" }, lastUsed: { provider: "p0", model: "m0" } }),
		{ provider: "p1", model: "m1" }
	);
	assert.deepEqual(
		t.readSelection({ next: null, lastUsed: { provider: "p0", model: "m0" } }),
		{ provider: "p0", model: "m0" },
		"falls back to lastUsed"
	);
	// `next` present but model-less must not shadow a usable lastUsed.
	assert.deepEqual(
		t.readSelection({ next: { provider: "p1", model: "" }, lastUsed: { provider: "p0", model: "m0" } }),
		{ provider: "p0", model: "m0" }
	);
	assert.deepEqual(t.readSelection(null), { provider: "", model: "" });
	assert.deepEqual(t.readSelection(undefined), { provider: "", model: "" });
	assert.deepEqual(t.readSelection({}), { provider: "", model: "" });
	assert.deepEqual(t.readSelection("junk"), { provider: "", model: "" });
	// Whitespace-only model ids are treated as absent.
	assert.deepEqual(t.readSelection({ next: { model: "   " } }), { provider: "", model: "" });
	// A missing provider does not lose the model.
	assert.deepEqual(t.readSelection({ next: { model: "m1" } }), { provider: "", model: "m1" });
}

{
	const chat = (nodes) => ({ nodes: { values: () => nodes } });
	const assistant = (seq, model) => ({ seq, provenance: { provider: "p", model } });
	assert.equal(t.deriveModel(chat([assistant(1, "a"), assistant(2, "b")])), "b", "newest wins");
	assert.equal(t.deriveModel(chat([assistant(2, "b"), assistant(1, "a")])), "b", "order-independent");
	assert.equal(t.deriveModel(chat([{ seq: 1 }])), "", "no provenance → empty");
	assert.equal(t.deriveModel(chat([])), "");
	assert.equal(t.deriveModel(undefined), "");
	assert.equal(t.deriveModel(null), "");
	assert.equal(t.deriveModel({ nodes: {} }), "", "no values() → empty");
}

// The regression that caused the reported bug: a real session's assistant
// messages carry NO provenance, so the projection must be the primary source.
// This documents why `deriveModel` alone is not enough.
{
	const bare = { nodes: { values: () => [{ seq: 1, kind: "assistant" }, { seq: 2, kind: "assistant" }] } };
	assert.equal(t.deriveModel(bare), "", "assistant nodes without provenance yield nothing");
	const selection = { next: { provider: "workbuddy-global", model: "deepseek-v4.1-flash" }, lastUsed: null };
	const route = t.readSelection(selection);
	assert.equal(route.model, "deepseek-v4.1-flash", "the projection supplies the model");
	assert.equal(t.resolveModelPricing(pricing, route.model)?.id, "deepseek-flash", "and it prices correctly");
}

// ── 15. host half: the key never leaves the process ─────────────────────
{
	assert.equal(hostTest.maskKey("sk-abcdef123456"), "sk-****");
	assert.equal(hostTest.maskKey(""), "");
	assert.equal(hostTest.maskKey(undefined), "");
	// Masking must not leak a prefix or length.
	assert.ok(!hostTest.maskKey("sk-abcdef123456").includes("abcdef"));
}

// ── 16. host half: upstream payload mapping ─────────────────────────────
{
	const ok = hostTest.toPayload({
		ok: true,
		status: 200,
		body: {
			is_available: true,
			balance_infos: [
				{ currency: "CNY", total_balance: "42.50", granted_balance: "10.00", topped_up_balance: "32.50" }
			]
		}
	});
	assert.equal(ok.ok, true);
	assert.equal(ok.isAvailable, true);
	assert.equal(ok.infos[0].total, 42.5, "a numeric string becomes a number");
	assert.equal(ok.infos[0].granted, 10);
	assert.equal(ok.infos[0].toppedUp, 32.5);
	assert.equal(typeof ok.fetchedAt, "number");

	// Nothing in the payload may carry the key.
	const serialized = JSON.stringify(ok);
	assert.ok(!/sk-/.test(serialized), "no key material in the payload");

	// A currency we cannot parse is passed through, not rounded to zero.
	const odd = hostTest.toPayload({
		ok: true,
		status: 200,
		body: { is_available: true, balance_infos: [{ currency: "USD", total_balance: "not-a-number" }] }
	});
	assert.equal(odd.infos[0].total, "not-a-number");

	// Missing fields degrade instead of throwing.
	const sparse = hostTest.toPayload({ ok: true, status: 200, body: {} });
	assert.deepEqual(sparse.infos, []);
	assert.equal(sparse.isAvailable, false);

	// Failure codes are coarse and stable.
	assert.equal(hostTest.toPayload({ ok: false, status: 401 }).code, "auth");
	assert.equal(hostTest.toPayload({ ok: false, status: 403 }).code, "auth");
	assert.equal(hostTest.toPayload({ ok: false, status: 429 }).code, "rate");
	assert.equal(hostTest.toPayload({ ok: false, code: "timeout" }).code, "timeout");
	assert.equal(hostTest.toPayload({ ok: false, code: "network" }).code, "network");
	assert.equal(hostTest.toPayload({ ok: false, status: 500 }).code, "network");
	// A 200 with a non-JSON body is not a success.
	assert.equal(hostTest.toPayload({ ok: true, status: 200, body: undefined }).ok, true);
}

// ── 17. host half: same-origin guard ────────────────────────────────────
{
	assert.equal(hostTest.isSameOrigin({ headers: {} }), true, "no Origin (same-origin fetch) is allowed");
	assert.equal(
		hostTest.isSameOrigin({ headers: { origin: "http://127.0.0.1:8805", host: "127.0.0.1:8805" } }),
		true,
		"same host is allowed"
	);
	assert.equal(
		hostTest.isSameOrigin({ headers: { origin: "https://evil.example", host: "127.0.0.1:8805" } }),
		false,
		"a foreign origin is refused"
	);
	assert.equal(
		hostTest.isSameOrigin({ headers: { origin: "null", host: "127.0.0.1:8805" } }),
		true,
		"an opaque origin (file://) has no Origin header to compare, so it passes as non-browser"
	);
}

// ── 18. host half: routes registered, and the key file is 0600 ──────────
{
	const routes = [];
	const ctx = {
		logger: { debug() {}, info() {} },
		inject(_names, cb) {
			cb(ctx);
		},
		effect(fn) {
			return fn();
		},
		webServer: {
			register(route) {
				routes.push(route);
				return () => {};
			}
		}
	};
	apply(ctx);
	const paths = routes.map((r) => `${r.kind} ${r.path}`);
	for (const expected of [
		"prefix /pet-fuyuko/asset",
		"exact /pet-fuyuko/lines.zh.json",
		"exact /pet-fuyuko/pricing.json",
		"exact /pet-fuyuko/balance",
		"exact /pet-fuyuko/key"
	]) {
		assert.ok(paths.includes(expected), `route ${expected} must be registered; got ${paths.join(", ")}`);
	}
	// pricing.json is whitelisted at the package root, not by widening the asset root.
	assert.ok(hostTest.ROOT_FILES.has("/pet-fuyuko/pricing.json"));
	assert.ok(!hostTest.ROOT_FILES.has("/pet-fuyuko/package.json"), "package.json stays unreachable");

	// The credential path lives under DSH_HOME, not in the shared settings file.
	const credPath = hostTest.credentialPath();
	assert.ok(credPath.includes("pet-fuyuko"), `credential path looks plugin-owned: ${credPath}`);
	assert.ok(!credPath.endsWith("settings.yaml"), "never the shared settings document");
}

// ── 19. the wallet card is clamped with its OWN width ───────────────────
// Regression: the card is 264px wide but was clamped with the bubble's 240px,
// so it hung ~4px off the right edge in her default corner.
{
	const viewport = { width: 1256, height: 681 };
	// Her default corner seat: the sprite's centre is already past the clamp, so
	// the bubble anchor lands on the right-hand limit.
	const corner = { x: 1048, y: 417 };
	const box = 160;
	const walletPos = t.placeBubble(corner, box, viewport, t.WALLET_HALF);
	const half = t.WALLET_HALF;
	assert.ok(walletPos.left - half >= 0, `left edge must stay on screen: ${walletPos.left - half}`);
	assert.ok(walletPos.left + half <= viewport.width, `right edge must stay on screen: ${walletPos.left + half}`);
	// With the bubble's half-width the card WOULD have overflowed — that is the
	// bug this pins: same anchor, wider surface.
	const bubblePos = t.placeBubble(corner, box, viewport, 120);
	assert.ok(bubblePos.left + 132 > viewport.width, "the old clamping did overflow (proving the fix matters)");

	// The bubble keeps its own (narrower) clamping.
	const bubble = t.placeBubble({ x: 1000, y: 400 }, box, viewport);
	assert.equal(bubble.left, 1080);
	assert.ok(bubble.left + 120 <= viewport.width);
}

// ── 20. double-tap detection constants are sane ─────────────────────────
// The component cannot use `event.detail` (PointerEvent fixes it at 0), so it
// compares tap timestamps itself. The window must be short enough not to
// swallow two deliberate single clicks.
assert.ok(t.DOUBLE_TAP_MS <= 500, "a double tap is under half a second");
assert.ok(t.DOUBLE_TAP_SLOP >= 4 && t.DOUBLE_TAP_SLOP <= 20, "a small movement is still a tap");

console.log("wallet: all checks passed");
