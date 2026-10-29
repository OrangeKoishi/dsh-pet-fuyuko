window.__ModuleLoader__.load({
	id: "dsh-pet-fuyuko",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const react = require("react");

		//#region css
		const CSS = `
.dpf-layer{position:absolute;inset:0;pointer-events:none;z-index:5}
.dpf-pet{position:absolute;pointer-events:auto;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none;will-change:transform;transform-origin:50% 100%}
.dpf-pet[data-dragging=true]{cursor:grabbing;transition:none!important}
.dpf-figure{display:block;width:100%;height:100%}
.dpf-pet img{display:block;width:100%;height:100%;object-fit:contain;image-rendering:auto;filter:drop-shadow(0 6px 10px rgba(0,0,0,.18));pointer-events:none;-webkit-user-drag:none}
.dpf-pet[data-state=idle]{animation:dpf-breathe 4s ease-in-out infinite}
.dpf-pet[data-state=think]{animation:dpf-float 6s ease-in-out infinite}
.dpf-pet[data-state=work]{animation:dpf-sway 2.4s ease-in-out infinite}
.dpf-pet[data-state=panic]{animation:dpf-shake .18s ease-in-out 3}
.dpf-pet[data-state=sleepy]{animation:dpf-sink 5s ease-in-out infinite;filter:saturate(.72) brightness(.96)}
.dpf-pet[data-state=curious]{animation:dpf-peek 2.6s ease-in-out infinite}
.dpf-pet[data-state=talk]{animation:dpf-talk 1.4s ease-in-out infinite}
.dpf-pet[data-state=worried]{animation:dpf-breathe 4.6s ease-in-out infinite}
.dpf-pet[data-state=pout]{animation:dpf-pout 3.4s ease-in-out infinite}
.dpf-pet[data-state=dragged]{animation:none}
.dpf-pet[data-motion=wiggle] .dpf-figure{animation:dpf-wiggle .16s ease-in-out 4}
.dpf-pet[data-ghost=true]{opacity:0;pointer-events:none}
.dpf-pet[data-zooming=true]{cursor:ns-resize}
.dpf-dots{position:absolute;pointer-events:none;display:flex;gap:4px}
.dpf-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-tertiary,#999);opacity:0;animation:dpf-dot 1.6s ease-in-out infinite}
.dpf-dot:nth-child(2){animation-delay:.25s}
.dpf-dot:nth-child(3){animation-delay:.5s}
.dpf-badge{position:absolute;right:-2px;bottom:-2px;pointer-events:none;padding:1px 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2,#fff);border:.5px solid var(--dsw-alias-border-l2,#ddd);color:var(--dsw-alias-label-secondary,#666);font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums;opacity:0;transition:opacity .18s ease}
.dpf-pet[data-zooming=true] .dpf-badge{opacity:1}
.dpf-bubble{position:fixed;z-index:30;max-width:230px;padding:8px 11px;border-radius:12px;background:var(--dsw-alias-bg-layer-2,#fff);border:.5px solid var(--dsw-alias-border-l2,#e4e4ea);box-shadow:0 6px 18px rgba(0,0,0,.12);color:var(--dsw-alias-label-primary,#222);font:12px/1.6 "Microsoft YaHei",system-ui,-apple-system,sans-serif;white-space:pre-wrap;word-break:break-word;pointer-events:none;transform:translate(-50%,-100%);animation:dpf-pop .16s ease-out}
.dpf-bubble[data-side=below]{transform:translate(-50%,0)}
.dpf-bubble[data-kind=error]{border-color:var(--dsw-alias-border-danger,#e5b4b4);background:var(--dsw-alias-bg-danger,#fff6f6)}
.dpf-bubble-tail{position:absolute;left:50%;bottom:-5px;width:9px;height:9px;margin-left:-4.5px;background:inherit;border-right:.5px solid var(--dsw-alias-border-l2,#e4e4ea);border-bottom:.5px solid var(--dsw-alias-border-l2,#e4e4ea);transform:rotate(45deg)}
.dpf-bubble[data-side=below] .dpf-bubble-tail{top:-5px;bottom:auto;border-right:0;border-bottom:0;border-left:.5px solid var(--dsw-alias-border-l2,#e4e4ea);border-top:.5px solid var(--dsw-alias-border-l2,#e4e4ea)}
.dpf-bubble[data-kind=error] .dpf-bubble-tail{border-color:var(--dsw-alias-border-danger,#e5b4b4)}
.dpf-bubble-summary{margin-top:4px;padding-top:4px;border-top:.5px dashed var(--dsw-alias-border-l2,#e4e4ea);color:var(--dsw-alias-label-secondary,#666);font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;max-height:56px;overflow:hidden}
.dpf-menu{position:fixed;z-index:40;min-width:170px;padding:5px;border-radius:10px;background:var(--dsw-alias-bg-layer-2,#fff);border:.5px solid var(--dsw-alias-border-l2,#e4e4ea);box-shadow:0 10px 28px rgba(0,0,0,.16);font:12px/1.4 "Microsoft YaHei",system-ui,-apple-system,sans-serif;pointer-events:auto;animation:dpf-pop .12s ease-out;transform-origin:top left}
.dpf-menu-item{display:flex;align-items:center;gap:8px;width:100%;padding:6px 9px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary,#222);font:inherit;text-align:left;cursor:pointer}
.dpf-menu-item:hover:not(:disabled){background:var(--dsw-alias-bg-layer-3,#f2f2f6)}
.dpf-menu-item:disabled{color:var(--dsw-alias-label-tertiary,#aaa);cursor:default}
.dpf-menu-item[data-checked=true]::after{content:"\\2713";margin-left:auto;color:var(--dsw-alias-label-secondary,#666)}
.dpf-menu-hint{margin-left:auto;font-size:10px;color:var(--dsw-alias-label-tertiary,#aaa)}
.dpf-menu-sep{height:.5px;margin:4px 6px;background:var(--dsw-alias-border-l2,#e8e8ec)}
@keyframes dpf-breathe{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(0,-3px,0) scale(1.008)}}
@keyframes dpf-float{0%,100%{transform:translate3d(0,-2px,0) rotate(-.4deg)}50%{transform:translate3d(0,-7px,0) rotate(.4deg)}}
@keyframes dpf-sway{0%,100%{transform:translate3d(-1.5px,0,0) rotate(-.8deg)}50%{transform:translate3d(1.5px,0,0) rotate(.8deg)}}
@keyframes dpf-shake{0%,100%{transform:translate3d(0,0,0)}25%{transform:translate3d(-4px,0,0) rotate(-1.5deg)}75%{transform:translate3d(4px,0,0) rotate(1.5deg)}}
@keyframes dpf-sink{0%,100%{transform:translate3d(0,2px,0)}50%{transform:translate3d(0,5px,0)}}
@keyframes dpf-peek{0%,100%{transform:translate3d(0,-2px,0) scale(1)}50%{transform:translate3d(0,-6px,0) scale(1.02)}}
@keyframes dpf-talk{0%,100%{transform:translate3d(0,-1px,0) scale(1)}50%{transform:translate3d(0,-4px,0) scale(1.012)}}
@keyframes dpf-pout{0%,100%{transform:rotate(-2.5deg)}50%{transform:rotate(-1.2deg)}}
@keyframes dpf-wiggle{0%,100%{transform:rotate(0)}30%{transform:rotate(-4deg)}70%{transform:rotate(4deg)}}
@keyframes dpf-dot{0%,100%{opacity:.15;transform:translateY(0)}50%{opacity:.85;transform:translateY(-2px)}}
@keyframes dpf-pop{from{opacity:0;transform:translate(-50%,-100%) scale(.94)}to{opacity:1;transform:translate(-50%,-100%) scale(1)}}
@media (prefers-reduced-motion:reduce){
  .dpf-pet{animation:none!important}
  .dpf-pet[data-motion=wiggle] .dpf-figure{animation:none!important}
  .dpf-dot{animation:none;opacity:.5}
  .dpf-bubble,.dpf-menu{animation:none}
}
`;
		const TAG_ID = "dsh-pet-fuyuko/pet.css";
		if (typeof document !== "undefined" && document.querySelector('style[data-plugin-css=' + JSON.stringify(TAG_ID) + ']') === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-pet-fuyuko";
			tag.dataset.pluginCss = TAG_ID;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}
		//#endregion

		/** Public asset prefix served by the host half. */
		const ASSET = "/pet-fuyuko/asset/fuyuko";
		/** Line library served by the host half (package-root whitelist route). */
		const LINES_URL = "/pet-fuyuko/lines.zh.json";
		/** Persisted position key. */
		const POS_KEY = "dsh-pet-fuyuko:position";
		/** Persisted zoom key. */
		const SCALE_KEY = "dsh-pet-fuyuko:scale";
		/** Persisted persona/pet state (mode, mute, cooldowns, counters). */
		const PET_STATE_KEY = "dsh-pet-fuyuko:state";
		/** Persisted debug state override. Separate key so it cannot collide. */
		const DEBUG_STATE_KEY = "dsh-pet-fuyuko:debug-state";
		/** Sprite box in CSS px at scale 1. */
		const SIZE = 160;
		/** Zoom limits: below 0.5 she is a smudge, above 2.5 she eats the window. */
		const MIN_SCALE = 0.5;
		const MAX_SCALE = 2.5;
		/** Wheel sensitivity: a 100px notch is roughly a 16% size change. */
		const ZOOM_RATE = 0.0015;
		/** Keep the pet clear of the composer and window edges. */
		const MARGIN = 16;
		/** Current persisted-state schema version (bump when migrating). */
		const PET_STATE_VERSION = 1;
		/** Per-line cooldown used when the line library omits one. */
		const DEFAULT_COOLDOWN = 600;
		/** Deep-night window: she dozes off in [23:00, 06:00). */
		const SLEEP_FROM_HOUR = 23;
		const SLEEP_TO_HOUR = 6;
		/** How long without interaction before the night-time doze starts. */
		const SLEEP_IDLE_MS = 10 * 60 * 1000;
		/** Minimum gap between ambient (think/work/idle) lines. */
		const AMBIENT_GAP_MS = 20 * 1000;
		/** Minimum gap between two error summaries. */
		const ERROR_REPEAT_MS = 30 * 1000;
		/** Idle chatter cadence. */
		const IDLE_GAP_MS = 4 * 60 * 1000;
		/** Half of the widest bubble, for viewport clamping. */
		const BUBBLE_HALF = 120;
		/** Bubble dwell time bounds, in ms. */
		const BUBBLE_MIN_MS = 1800;
		const BUBBLE_MAX_MS = 6000;
		/** Longest error snippet shown in a bubble. */
		const ERROR_SNIPPET = 120;

		/**
		 * Read the persisted position, falling back to bottom-right.
		 * @returns {{x:number,y:number,placed:boolean}}
		 */
		function readPosition() {
			try {
				const raw = window.localStorage.getItem(POS_KEY);
				if (raw) {
					const parsed = JSON.parse(raw);
					if (typeof parsed.x === "number" && typeof parsed.y === "number") {
						return { x: parsed.x, y: parsed.y, placed: true };
					}
				}
			} catch {}
			return { x: 0, y: 0, placed: false };
		}

		/** Persist one position; storage failures are non-fatal (private mode). */
		function writePosition(x, y) {
			try {
				window.localStorage.setItem(POS_KEY, JSON.stringify({ x: Math.round(x), y: Math.round(y) }));
			} catch {}
		}

		/** Read the debug state override, if any. */
		function readDebugState() {
			try {
				const v = window.localStorage.getItem(DEBUG_STATE_KEY);
				return v === null ? undefined : v;
			} catch {
				return undefined;
			}
		}

		/**
		 * Coerce a stored zoom into the supported range.
		 * @param {unknown} value - raw stored value.
		 * @returns {number} a usable scale.
		 */
		function sanitizeScale(value) {
			const n = typeof value === "number" ? value : Number(value);
			if (!Number.isFinite(n)) return 1;
			return Math.min(MAX_SCALE, Math.max(MIN_SCALE, n));
		}

		/** Read the persisted zoom, defaulting to 1. */
		function readScale() {
			try {
				const raw = window.localStorage.getItem(SCALE_KEY);
				return raw === null ? 1 : sanitizeScale(JSON.parse(raw));
			} catch {
				return 1;
			}
		}

		/** Persist the zoom; storage failures are non-fatal. */
		function writeScale(scale) {
			try {
				window.localStorage.setItem(SCALE_KEY, JSON.stringify(Number(scale.toFixed(3))));
			} catch {}
		}

		/** Rendered box size in CSS px for one scale. */
		function boxSize(scale) {
			return Math.round(SIZE * scale);
		}

		/**
		 * Clamp a position so the sprite stays fully on screen.
		 * @param {{x:number,y:number}} pos - candidate top-left position.
		 * @param {number} [scale] - current zoom, so the real box size is used.
		 * @returns {{x:number,y:number}} clamped position.
		 */
		function clamp(pos, scale = 1) {
			const size = boxSize(scale);
			const maxX = Math.max(MARGIN, window.innerWidth - size - MARGIN);
			const maxY = Math.max(MARGIN, window.innerHeight - size - MARGIN);
			return {
				x: Math.min(Math.max(MARGIN, pos.x), maxX),
				y: Math.min(Math.max(MARGIN, pos.y), maxY)
			};
		}

		/**
		 * Re-anchor a box across a zoom change so her feet stay planted and her
		 * centre stays put: the box grows upward and sideways from the bottom
		 * middle, which is the anchor `pet.json` declares.
		 * @param {{x:number,y:number}} pos - top-left before the change.
		 * @param {number} from - scale before.
		 * @param {number} to - scale after.
		 * @returns {{x:number,y:number}} top-left after the change.
		 */
		function anchorOnZoom(pos, from, to) {
			const before = boxSize(from);
			const after = boxSize(to);
			const grow = after - before;
			return { x: pos.x - grow / 2, y: pos.y - grow };
		}

		/** Default seat: bottom-right, above the composer. */
		function defaultPosition(scale = 1) {
			const size = boxSize(scale);
			return clamp({
				x: window.innerWidth - size - 28,
				y: window.innerHeight - size - 96
			}, scale);
		}

		//#region live session signal
		//
		// The pet lives in `shell.overlay` (root scope) but every interesting fact
		// — is a turn running, is a tool executing, did the turn fail — only exists
		// in the session scope. They are two separate React trees, so they cannot
		// share context. The bridge component below renders inside the session tree
		// and publishes a plain snapshot into this module-level store; the pet
		// subscribes to it with useSyncExternalStore.
		//
		// Deliberately a hand-rolled store, not a Cordis service: it must not leak
		// across plugin instances, and it holds no session identity or content —
		// only coarse activity flags.

		/** Coarse activity the sprite can express. */
		const ACTIVITY = Object.freeze({
			IDLE: "idle",
			THINKING: "think",
			WORKING: "work",
			ERROR: "panic"
		});

		/** Neutral snapshot used before any session mounts. */
		const EMPTY_SIGNAL = Object.freeze({
			activity: ACTIVITY.IDLE,
			sessionId: null,
			/** ms timestamp when the current activity began. */
			since: 0,
			/** consecutive tool calls seen in this turn, for the debug readout. */
			toolCalls: 0,
			/** sanitized provider message, when the last turn failed. */
			errorText: ""
		});

		/** Current published signal; replaced wholesale on every change. */
		let signal = EMPTY_SIGNAL;
		/** Subscribers of {@link signal}. */
		const signalListeners = new Set();

		/**
		 * Publish a new signal. Identity is preserved when nothing changed, so
		 * useSyncExternalStore does not re-render on every event.
		 * @param {Partial<typeof EMPTY_SIGNAL>} next - fields to merge.
		 */
		function publishSignal(next) {
			const merged = { ...signal, ...next };
			const same =
				merged.activity === signal.activity &&
				merged.sessionId === signal.sessionId &&
				merged.since === signal.since &&
				merged.toolCalls === signal.toolCalls &&
				merged.errorText === signal.errorText;
			if (same) return;
			signal = merged;
			for (const listener of signalListeners) listener();
		}

		/** Reset to idle when the last session-scoped bridge unmounts. */
		function clearSignal() {
			if (signal === EMPTY_SIGNAL) return;
			signal = EMPTY_SIGNAL;
			for (const listener of signalListeners) listener();
		}

		/**
		 * Subscribe to signal changes.
		 * @param {() => void} listener - called on every publish.
		 * @returns {() => void} unsubscribe.
		 */
		function subscribeSignal(listener) {
			signalListeners.add(listener);
			return () => signalListeners.delete(listener);
		}

		/** @returns {typeof EMPTY_SIGNAL} the current signal. */
		function getSignal() {
			return signal;
		}

		// Read-only probe for the local verification tooling. Exposes the coarse
		// activity flags only — never message content — and is harmless in the app.
		if (typeof window !== "undefined") {
			window.__petSignalProbe = () => ({ ...signal });
		}

		/**
		 * Derive the coarse activity from a chat snapshot.
		 *
		 * Order matters: a failed turn outranks "running" because the error is the
		 * thing worth showing, and a running tool outranks a streaming prefix
		 * because "I'm working" is more specific than "I'm thinking".
		 * @param {any} chat - ChatSnapshot, or undefined before a session binds.
		 * @param {any} session - SessionSnapshot, or undefined.
		 * @returns {{activity: string, toolCalls: number, errorText: string}}
		 */
		function deriveActivity(chat, session) {
			const errorText =
				typeof session?.lastAgentError === "string" && session.lastAgentError !== ""
					? session.lastAgentError
					: "";
			if (errorText !== "") {
				return { activity: ACTIVITY.ERROR, toolCalls: 0, errorText };
			}

			const runningCalls = chat?.legacy?.runningCalls;
			const callCount = Array.isArray(runningCalls) ? runningCalls.length : 0;
			if (callCount > 0) {
				return { activity: ACTIVITY.WORKING, toolCalls: callCount, errorText: "" };
			}

			const partial = chat?.legacy?.partial;
			const streaming = partial !== null && partial !== undefined;
			if (streaming) {
				return { activity: ACTIVITY.THINKING, toolCalls: 0, errorText: "" };
			}

			return { activity: ACTIVITY.IDLE, toolCalls: 0, errorText: "" };
		}
		//#endregion

		//#region line library
		//
		// Everything she can say lives in `lines.zh.json`; the code below only
		// knows how to *choose* a line. Adding a line, a kind, or a whole new
		// persona variant is a JSON edit — the host serves the file straight off
		// disk, so a refresh picks it up with no rebuild.
		//
		// Selection rules, in order:
		//   1. kind must match the trigger (click / idle / think / ...);
		//   2. mode must match the current persona, or be "both";
		//   3. calendar / hour conditions must hold (festive lines, late night);
		//   4. `once` lines are dropped after they have played once;
		//   5. the current cycle never repeats a line until the pool is exhausted;
		//   6. among the remaining, prefer lines that are not still cooling down;
		//   7. weight breaks ties.

		/** The two personas. `omote` is the smiling shop-window self. */
		const MODE = Object.freeze({ OMOTE: "omote", URA: "ura" });

		/** Fallback form of address when the library does not set one. */
		const DEFAULT_HONORIFIC = "你";

		/**
		 * Validate and index a raw line library.
		 * @param {unknown} raw - parsed `lines.zh.json`.
		 * @returns {{schemaVersion:number, locale:string, defaults:{称呼:string, 冷却秒:number},
		 *   lines:any[], byKind:Map<string, any[]>} | null} `null` when unusable.
		 */
		function normalizeLibrary(raw) {
			if (raw === null || typeof raw !== "object" || !Array.isArray(raw.lines)) return null;
			const defaults = raw.defaults !== null && typeof raw.defaults === "object" ? raw.defaults : {};
			const fallbackCooldown = Number.isFinite(defaults.冷却秒) ? defaults.冷却秒 : DEFAULT_COOLDOWN;
			const lines = [];
			const seen = new Set();
			for (const item of raw.lines) {
				if (item === null || typeof item !== "object") continue;
				if (typeof item.id !== "string" || typeof item.text !== "string" || item.text === "") continue;
				if (seen.has(item.id)) continue;
				seen.add(item.id);
				lines.push({
					id: item.id,
					kind: typeof item.kind === "string" ? item.kind : "idle",
					mode: item.mode === MODE.URA ? MODE.URA : item.mode === MODE.OMOTE ? MODE.OMOTE : "both",
					emotion: typeof item.emotion === "string" ? item.emotion : "idle",
					text: item.text,
					weight: Number.isFinite(item.weight) && item.weight > 0 ? item.weight : 1,
					cooldown: Number.isFinite(item.cooldown) ? item.cooldown : fallbackCooldown,
					once: item.once === true,
					date: typeof item.date === "string" ? item.date : null,
					fromHour: Number.isInteger(item.fromHour) ? item.fromHour : null,
					toHour: Number.isInteger(item.toHour) ? item.toHour : null
				});
			}
			if (lines.length === 0) return null;
			const byKind = new Map();
			for (const line of lines) {
				const bucket = byKind.get(line.kind);
				if (bucket === undefined) byKind.set(line.kind, [line]);
				else bucket.push(line);
			}
			return {
				schemaVersion: Number.isInteger(raw.schemaVersion) ? raw.schemaVersion : 1,
				locale: typeof raw.locale === "string" ? raw.locale : "zh-CN",
				defaults: {
					称呼: typeof defaults.称呼 === "string" ? defaults.称呼 : DEFAULT_HONORIFIC,
					冷却秒: fallbackCooldown
				},
				lines,
				byKind
			};
		}

		/** Zero-pad a date component. */
		function pad2(n) {
			return n < 10 ? `0${n}` : String(n);
		}

		/**
		 * Does a line's calendar/hour condition hold right now?
		 * A window with `toHour <= fromHour` wraps past midnight.
		 * @param {any} line - normalized line.
		 * @param {number} now - ms timestamp.
		 * @returns {boolean} true when the line may play.
		 */
		function matchesSchedule(line, now) {
			const d = new Date(now);
			if (line.date !== null) {
				const md = `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
				if (line.date !== md) return false;
			}
			if (line.fromHour !== null) {
				const hour = d.getHours();
				const to = line.toHour === null ? 24 : line.toHour;
				if (to > line.fromHour) {
					if (hour < line.fromHour || hour >= to) return false;
				} else if (hour < line.fromHour && hour >= to) {
					return false;
				}
			}
			return true;
		}

		/** Is a line still inside its own cooldown window? */
		function isCooling(line, cooldowns, now) {
			const at = cooldowns[line.id];
			if (typeof at !== "number" || !Number.isFinite(at)) return false;
			return now - at < line.cooldown * 1000;
		}

		/**
		 * Weighted random pick. `rng` is injectable so tests are deterministic.
		 * @param {any[]} list - candidates with a positive `weight`.
		 * @param {() => number} rng - uniform [0,1) source.
		 * @returns {any | null} the chosen item.
		 */
		function weightedPick(list, rng) {
			if (list.length === 0) return null;
			let total = 0;
			for (const item of list) total += item.weight;
			let roll = rng() * total;
			for (const item of list) {
				roll -= item.weight;
				if (roll <= 0) return item;
			}
			return list[list.length - 1];
		}

		/**
		 * Choose one line for a trigger.
		 *
		 * `used` is the per-kind/per-mode cycle: it guarantees that she cycles
		 * through every eligible line before repeating one, which is what makes
		 * "click 20 times and nothing repeats" true instead of merely likely.
		 * @param {ReturnType<typeof normalizeLibrary>} library - indexed library.
		 * @param {{kind:string, mode:string, now:number, cooldowns?:Record<string,number>,
		 *   used?:Set<string>, seenOnce?:string[], rng?:() => number}} opts - trigger context.
		 * @returns {any | null} the chosen line, or null when the pool is empty.
		 */
		function pickLine(library, opts) {
			const { kind, mode, now } = opts;
			const cooldowns = opts.cooldowns ?? {};
			const used = opts.used ?? new Set();
			const seenOnce = opts.seenOnce ?? [];
			const rng = opts.rng ?? Math.random;
			const bucket = library.byKind.get(kind);
			if (bucket === undefined) return null;

			const pool = [];
			for (const line of bucket) {
				if (line.mode !== "both" && line.mode !== mode) continue;
				if (line.once && seenOnce.indexOf(line.id) >= 0) continue;
				if (!matchesSchedule(line, now)) continue;
				pool.push(line);
			}
			if (pool.length === 0) return null;
			// A full cycle means every line has played once: start a new cycle.
			if (used.size >= pool.length) used.clear();

			const fresh = pool.filter((line) => !used.has(line.id));
			const candidates = fresh.length > 0 ? fresh : pool;
			const ready = candidates.filter((line) => !isCooling(line, cooldowns, now));
			const chosen = weightedPick(ready.length > 0 ? ready : candidates, rng);
			if (chosen === null) return null;
			used.add(chosen.id);
			return chosen;
		}

		/**
		 * Substitute `{变量}` placeholders. Unknown placeholders are left intact
		 * so a typo in the JSON is visible instead of silently swallowed.
		 * @param {string} text - raw line text.
		 * @param {Record<string, string|number>} vars - values.
		 * @returns {string} display text.
		 */
		function applyVars(text, vars) {
			return text.replace(/\{([^{}]+)\}/g, (whole, name) => {
				const value = vars[name];
				return typeof value === "string" || typeof value === "number" ? String(value) : whole;
			});
		}

		/** How long a bubble stays up for a given text, in ms. */
		function bubbleMs(text) {
			const len = typeof text === "string" ? text.length : 0;
			return Math.min(BUBBLE_MAX_MS, Math.max(BUBBLE_MIN_MS, 1200 + len * 90));
		}

		/**
		 * Condense an error message for the bubble: one line, bounded length, and
		 * API keys masked (the privacy rule applies to anything user-visible).
		 * @param {unknown} text - provider error text.
		 * @returns {string} display-safe summary.
		 */
		function summarizeError(text) {
			if (typeof text !== "string") return "";
			const flat = text.replace(/\s+/g, " ").trim();
			if (flat === "") return "";
			const masked = flat.replace(/sk-[A-Za-z0-9_-]{6,}/g, "sk-****");
			return masked.length > ERROR_SNIPPET ? `${masked.slice(0, ERROR_SNIPPET)}…` : masked;
		}

		/** Per-kind/per-mode cycles, so a refresh restarts each cycle cleanly. */
		const cycles = new Map();

		/** @returns {Set<string>} the current cycle for one trigger. */
		function cycleFor(kind, mode) {
			const key = `${kind}:${mode}`;
			let set = cycles.get(key);
			if (set === undefined) {
				set = new Set();
				cycles.set(key, set);
			}
			return set;
		}

		/** Forget every cycle (library reload, or "reset cooldowns" in the menu). */
		function resetCycles() {
			cycles.clear();
		}
		//#endregion

		//#region pet state
		//
		// One JSON blob in localStorage, versioned so a future migration can read
		// old values. It holds persona, mute, hidden, per-line cooldowns, the
		// `once` ledger and counters — never any conversation content.

		/** Fresh state for a first run. */
		function defaultPetState() {
			return {
				schemaVersion: PET_STATE_VERSION,
				mode: MODE.OMOTE,
				muted: false,
				hidden: false,
				cooldowns: {},
				onceSeen: [],
				counters: { clicks: 0, talks: 0, drags: 0 },
				lastInteractionAt: 0
			};
		}

		/**
		 * Coerce anything read from storage into a usable state. Unknown fields are
		 * dropped, wrong types fall back to defaults, and a future schemaVersion is
		 * still read field-by-field rather than discarded.
		 * @param {unknown} raw - parsed value from localStorage.
		 * @returns {ReturnType<typeof defaultPetState>} sanitized state.
		 */
		function sanitizePetState(raw) {
			const state = defaultPetState();
			if (raw === null || typeof raw !== "object") return state;
			if (raw.mode === MODE.URA || raw.mode === MODE.OMOTE) state.mode = raw.mode;
			if (raw.muted === true) state.muted = true;
			if (raw.hidden === true) state.hidden = true;
			if (raw.cooldowns !== null && typeof raw.cooldowns === "object") {
				for (const key of Object.keys(raw.cooldowns)) {
					const value = raw.cooldowns[key];
					if (typeof value === "number" && Number.isFinite(value)) state.cooldowns[key] = value;
				}
			}
			if (Array.isArray(raw.onceSeen)) {
				state.onceSeen = raw.onceSeen.filter((id) => typeof id === "string");
			}
			if (raw.counters !== null && typeof raw.counters === "object") {
				for (const key of ["clicks", "talks", "drags"]) {
					const value = raw.counters[key];
					if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
						state.counters[key] = Math.floor(value);
					}
				}
			}
			if (typeof raw.lastInteractionAt === "number" && Number.isFinite(raw.lastInteractionAt)) {
				state.lastInteractionAt = raw.lastInteractionAt;
			}
			return state;
		}

		/** Read the persisted pet state. */
		function readPetState() {
			try {
				const raw = window.localStorage.getItem(PET_STATE_KEY);
				return raw === null ? defaultPetState() : sanitizePetState(JSON.parse(raw));
			} catch {
				return defaultPetState();
			}
		}

		/** Persist the pet state; storage failures are non-fatal. */
		function writePetState(state) {
			try {
				window.localStorage.setItem(PET_STATE_KEY, JSON.stringify(state));
			} catch {}
		}

		/**
		 * Keep the cooldown table from growing forever: drop the oldest entries
		 * once it passes a few hundred lines.
		 * @param {Record<string, number>} cooldowns - table to prune.
		 * @returns {Record<string, number>} the same table, pruned in place.
		 */
		function pruneCooldowns(cooldowns) {
			const keys = Object.keys(cooldowns);
			if (keys.length <= 400) return cooldowns;
			keys.sort((a, b) => cooldowns[a] - cooldowns[b]);
			for (const key of keys.slice(0, keys.length - 300)) delete cooldowns[key];
			return cooldowns;
		}
		//#endregion

		//#region sprite state machine
		//
		// Two layers, deliberately separate:
		//   * `deriveActivity` (M1) says what the *session* is doing;
		//   * `deriveSpriteState` (M2) folds that together with local UI facts
		//     (drag, talk, hover, doze) using the priority the design fixes:
		//     drag > talk > panic > sleep > work > think > curious > idle.

		/** Does the hour fall inside the deep-night window? */
		function isSleepHour(hour) {
			return hour >= SLEEP_FROM_HOUR || hour < SLEEP_TO_HOUR;
		}

		/**
		 * Should she be dozing right now?
		 * Only when the session is quiet, it is late, and nothing has touched her
		 * for a while — she must never "fall asleep" while a turn is running.
		 * @param {{hour:number, now:number, lastInteractionAt:number, activity:string}} ctx - facts.
		 * @returns {boolean} true when sleepy.
		 */
		function shouldSleep(ctx) {
			if (ctx.activity !== ACTIVITY.IDLE) return false;
			if (!isSleepHour(ctx.hour)) return false;
			return ctx.now - ctx.lastInteractionAt > SLEEP_IDLE_MS;
		}

		/**
		 * Fold session activity and local interaction into one sprite state.
		 * @param {{activity:string, dragging?:boolean, talking?:boolean,
		 *   hovering?:boolean, sleeping?:boolean}} flags - current facts.
		 * @returns {string} the state name used by `data-state`.
		 */
		function deriveSpriteState(flags) {
			if (flags.dragging === true) return "dragged";
			if (flags.talking === true) return "talk";
			if (flags.activity === ACTIVITY.ERROR) return "panic";
			if (flags.sleeping === true) return "sleepy";
			if (flags.activity === ACTIVITY.WORKING) return "work";
			if (flags.activity === ACTIVITY.THINKING) return "think";
			if (flags.hovering === true) return "curious";
			return "idle";
		}
		//#endregion

		//#region pointer geometry
		//
		// Hotspots come from `pet.json`, so the clickable ahoge is data, not a
		// hard-coded rectangle. `x`/`y` are the hotspot centre in normalized
		// sprite coordinates, `w`/`h` its extents; the first match wins, which is
		// why the ahoge is listed before the body.

		/**
		 * Hit-test normalized sprite coordinates against the hotspot list.
		 * @param {any} hotspots - `pet.json` hotspots.
		 * @param {number} nx - normalized x (0 = left edge).
		 * @param {number} ny - normalized y (0 = top edge).
		 * @returns {string | null} the hotspot id, or null for empty space.
		 */
		function hitHotspot(hotspots, nx, ny) {
			if (!Array.isArray(hotspots)) return null;
			for (const spot of hotspots) {
				if (spot === null || typeof spot !== "object") continue;
				const w = Number.isFinite(spot.w) ? spot.w : 0.2;
				const h = Number.isFinite(spot.h) ? spot.h : 0.2;
				const x = Number.isFinite(spot.x) ? spot.x : 0.5;
				const y = Number.isFinite(spot.y) ? spot.y : 0.5;
				if (Math.abs(nx - x) <= w / 2 && Math.abs(ny - y) <= h / 2) {
					return typeof spot.id === "string" ? spot.id : null;
				}
			}
			return null;
		}

		/**
		 * Place the speech bubble relative to the sprite, clamped to the viewport.
		 * It prefers the space above her head and flips below when she is near the
		 * top edge.
		 * @param {{x:number,y:number}} pos - sprite top-left.
		 * @param {number} box - sprite box size in px.
		 * @param {{width:number,height:number}} viewport - window size.
		 * @returns {{left:number, top:number, side:string}} fixed-position anchor.
		 */
		function placeBubble(pos, box, viewport) {
			const half = Math.min(BUBBLE_HALF, Math.max(60, viewport.width / 2 - 8));
			const minLeft = half + 8;
			const maxLeft = Math.max(minLeft, viewport.width - half - 8);
			const left = Math.min(Math.max(pos.x + box / 2, minLeft), maxLeft);
			const above = pos.y - 8;
			if (above >= 64) return { left, top: above, side: "above" };
			return { left, top: pos.y + box + 14, side: "below" };
		}

		/**
		 * Clamp a context menu into the viewport.
		 * @param {number} x - requested left.
		 * @param {number} y - requested top.
		 * @param {{width:number,height:number}} size - menu size.
		 * @param {{width:number,height:number}} viewport - window size.
		 * @returns {{left:number, top:number}} clamped position.
		 */
		function placeMenu(x, y, size, viewport) {
			const left = Math.min(Math.max(8, x), Math.max(8, viewport.width - size.width - 8));
			const top = Math.min(Math.max(8, y), Math.max(8, viewport.height - size.height - 8));
			return { left, top };
		}

		/**
		 * Estimated pixel size of a menu, used before it is measurable.
		 * @param {any[]} items - menu items (separators included).
		 * @returns {{width:number, height:number}} estimated size.
		 */
		function menuSize(items) {
			let height = 12;
			for (const item of items) height += item !== null && typeof item === "object" && item.sep === true ? 9 : 30;
			return { width: 184, height };
		}
		//#endregion

		/**
		 * Stable selector for the chat snapshot. Hoisted to module scope because
		 * snapshot hooks memoize on selector identity.
		 * @param {any} snapshot - ChatSnapshot.
		 * @returns {any} the snapshot unchanged.
		 */
		const selectChat = (snapshot) => snapshot;

		/**
		 * Stable selector for the session snapshot, for the same reason.
		 * @param {any} snapshot - SessionSnapshot.
		 * @returns {any} the snapshot unchanged.
		 */
		const selectSession = (snapshot) => snapshot;

		/**
		 * Session-scoped bridge: reads the live chat/session facts and publishes
		 * them into the module-level signal the pet subscribes to. Renders nothing.
		 *
		 * It must live in a session-scoped slot because `useChat` and `useSession`
		 * only exist there; the pet itself is root-scoped and cannot see them.
		 * @param {any} props - session standard kit (`useChat`, `useSession`, `sessionId`).
		 * @returns {null} always — this component has no visual output.
		 */
		function SessionBridge(props) {
			const chat = props.useChat(selectChat);
			const session = props.useSession(selectSession);
			const sessionId = props.sessionId;

			react.useEffect(() => {
				const next = deriveActivity(chat, session);
				const changedActivity = next.activity !== getSignal().activity;
				publishSignal({
					...next,
					sessionId: sessionId === undefined ? null : String(sessionId),
					// Only restart the clock when the activity itself changes, so a
					// long "working" stretch keeps its original start time.
					since: changedActivity ? Date.now() : getSignal().since
				});
			}, [chat, session, sessionId]);

			react.useEffect(() => () => clearSignal(), []);

			return null;
		}

		/**
		 * The pet surface: a draggable static sprite in the frame-wide overlay,
		 * plus her speech bubble and context menu.
		 *
		 * Window-level on purpose: a desktop pet belongs to the window, not to one
		 * conversation, so it shows on every view. Live activity arrives from the
		 * session-scoped {@link SessionBridge} through the module-level signal.
		 * @returns {import('react').ReactElement | null} the pet, or nothing until
		 *   the asset probe confirms the sprite route answers.
		 */
		function PetLayer() {
			const initial = react.useRef(null);
			if (initial.current === null) {
				const scale = readScale();
				const stored = readPosition();
				initial.current = {
					scale,
					pos: stored.placed ? clamp(stored, scale) : defaultPosition(scale),
					petState: readPetState()
				};
			}

			const [pos, setPos] = react.useState(initial.current.pos);
			const [scale, setScale] = react.useState(initial.current.scale);
			const [dragging, setDragging] = react.useState(false);
			const [ready, setReady] = react.useState(false);
			// Briefly true while the zoom badge is showing.
			const [zooming, setZooming] = react.useState(false);
			// Persona / mute / hidden / cooldowns, persisted as one blob.
			const [petState, setPetState] = react.useState(initial.current.petState);
			// The bubble currently on screen: { key, kind, text, summary?, emotion?, ms }.
			const [bubble, setBubble] = react.useState(null);
			// Context menu anchor in viewport coordinates, or null when closed.
			const [menu, setMenu] = react.useState(null);
			const [hovering, setHovering] = react.useState(false);
			const [talking, setTalking] = react.useState(false);
			const [wiggling, setWiggling] = react.useState(false);
			// Line library, or null until the fetch lands.
			const [library, setLibrary] = react.useState(null);
			// Manifest hotspots (the ahoge lives here, not in the code).
			const [hotspots, setHotspots] = react.useState(null);
			// Slow tick so the doze window is re-evaluated without a rAF loop.
			const [, setTick] = react.useState(0);

			const zoomTimer = react.useRef(null);
			const wiggleTimer = react.useRef(null);
			const drag = react.useRef(null);
			const elRef = react.useRef(null);
			const menuRef = react.useRef(null);
			// Latest values for listeners and timers registered once.
			const scaleRef = react.useRef(scale);
			scaleRef.current = scale;
			const posRef = react.useRef(pos);
			posRef.current = pos;
			const petStateRef = react.useRef(petState);
			petStateRef.current = petState;
			const libraryRef = react.useRef(library);
			libraryRef.current = library;
			const hotspotsRef = react.useRef(hotspots);
			hotspotsRef.current = hotspots;

			// Live activity from the session-scoped bridge. `null` means the bridge
			// has not mounted yet (no session), so the pet falls back to idle.
			const signal = react.useSyncExternalStore(subscribeSignal, getSignal, getSignal);
			// A manual override wins over the derived state: it is the debug channel
			// and it lets a click reaction interrupt cleanly.
			const [override, setOverride] = react.useState(() => readDebugState() ?? null);

			/** Merge a patch into the persisted state and re-render once. */
			const commitPetState = react.useCallback((patch) => {
				const next = { ...petStateRef.current, ...patch };
				petStateRef.current = next;
				writePetState(next);
				setPetState(next);
			}, []);

			//#region bubble queue
			//
			// Bubbles queue so two lines never overlap, but they are not equal:
			// an error must not wait behind a 4-second idle greeting. Each bubble
			// carries a priority, and a higher-priority arrival flushes everything
			// still pending and cuts the current bubble short.
			const bubbleRef = react.useRef({ queue: [], timer: null, priority: 0 });

			/** Show the next queued bubble, or clear when the queue drains. */
			const pump = react.useCallback(() => {
				const queue = bubbleRef.current;
				if (queue.timer !== null) return;
				const next = queue.queue.shift();
				if (next === undefined) {
					queue.priority = 0;
					setBubble(null);
					setTalking(false);
					return;
				}
				queue.priority = next.priority ?? 0;
				setBubble(next);
				// Only a *conversational* bubble counts as "talking". An error
				// bubble must leave her looking panicked, not chatty, and the
				// panic state outranks talk in the fold below.
				setTalking(next.talk === true);
				queue.timer = window.setTimeout(() => {
					queue.timer = null;
					pump();
				}, next.ms);
			}, []);

			/**
			 * Queue one or more bubbles; each waits for the previous to finish,
			 * unless it outranks what is on screen.
			 * @param {any[]} items - bubbles to show, in order.
			 * @param {number} [priority] - 0 ambient, 1 reaction, 2 error.
			 */
			const say = react.useCallback(
				(items, priority = 1) => {
					const list = items
						.filter((item) => item !== null && item !== undefined)
						.map((item) => ({ ...item, priority: item.priority ?? priority }));
					if (list.length === 0) return;
					const queue = bubbleRef.current;
					const top = Math.max(...list.map((item) => item.priority));
					// A more important message preempts whatever is still pending.
					if (top > queue.priority) {
						if (queue.timer !== null) window.clearTimeout(queue.timer);
						queue.timer = null;
						queue.queue.length = 0;
					}
					queue.queue.push(...list);
					pump();
				},
				[pump]
			);

			// Drop a pending bubble timer on unmount.
			react.useEffect(
				() => () => {
					const queue = bubbleRef.current;
					if (queue.timer !== null) window.clearTimeout(queue.timer);
					queue.timer = null;
					queue.queue.length = 0;
				},
				[]
			);
			//#endregion

			/**
			 * Pick a line for one trigger and record that it played (cooldown,
			 * `once` ledger, counters). Returns the ready-to-display text.
			 */
			const pickText = react.useCallback(
				(kind) => {
					const lib = libraryRef.current;
					if (lib === null) return null;
					const st = petStateRef.current;
					const now = Date.now();
					const picked = pickLine(lib, {
						kind,
						mode: st.mode,
						now,
						cooldowns: st.cooldowns,
						used: cycleFor(kind, st.mode),
						seenOnce: st.onceSeen,
						rng: Math.random
					});
					if (picked === null) return null;
					const onceSeen =
						picked.once && st.onceSeen.indexOf(picked.id) < 0
							? st.onceSeen.concat(picked.id)
							: st.onceSeen;
					commitPetState({
						cooldowns: pruneCooldowns({ ...st.cooldowns, [picked.id]: now }),
						onceSeen,
						counters: { ...st.counters, talks: (st.counters.talks ?? 0) + 1 }
					});
					return {
						id: picked.id,
						text: applyVars(picked.text, { 称呼: lib.defaults.称呼 }),
						emotion: picked.emotion,
						once: picked.once
					};
				},
				[commitPetState]
			);

			/** Say one line of a given kind, honouring mute. */
			const speak = react.useCallback(
				(kind, priority = 1) => {
					if (petStateRef.current.muted) return;
					const picked = pickText(kind);
					if (picked === null) return;
					say(
						[
							{
								key: picked.id,
								kind: "speech",
								talk: true,
								text: picked.text,
								emotion: picked.emotion,
								ms: bubbleMs(picked.text)
							}
						],
						priority
					);
				},
				[pickText, say]
			);

			/**
			 * Panic line plus a redacted summary of the provider error.
			 *
			 * One bubble, not two: the summary is the part the user actually needs,
			 * and queuing it behind the line would delay it by the line's dwell
			 * time. The line becomes the headline and the summary the detail.
			 */
			const speakError = react.useCallback(
				(errorText) => {
					if (petStateRef.current.muted) return;
					const summary = summarizeError(errorText);
					const picked = pickText("panic");
					if (summary === "" && picked === null) return;
					const text = picked !== null ? picked.text : "出错了。";
					say(
						[
							{
								key: picked !== null ? picked.id : "error",
								kind: "error",
								// `talk: false` on purpose: she says the line, but her face
								// stays panicked rather than switching to the chatty state.
								talk: false,
								text,
								emotion: picked !== null ? picked.emotion : "panic",
								summary: summary === "" ? undefined : summary,
								ms: 6500
							}
						],
						2
					);
				},
				[pickText, say]
			);

			/** Note a real interaction: drives the doze timer and the counters. */
			const recordInteraction = react.useCallback(() => {
				const st = petStateRef.current;
				commitPetState({
					lastInteractionAt: Date.now(),
					counters: { ...st.counters, clicks: (st.counters.clicks ?? 0) + 1 }
				});
			}, [commitPetState]);

			/** Show the zoom badge for a moment after each notch. */
			const flashZoom = react.useCallback(() => {
				setZooming(true);
				if (zoomTimer.current !== null) window.clearTimeout(zoomTimer.current);
				zoomTimer.current = window.setTimeout(() => {
					zoomTimer.current = null;
					setZooming(false);
				}, 900);
			}, []);

			// Clear a pending badge timer on unmount.
			react.useEffect(
				() => () => {
					if (zoomTimer.current !== null) window.clearTimeout(zoomTimer.current);
					if (wiggleTimer.current !== null) window.clearTimeout(wiggleTimer.current);
				},
				[]
			);

			// Keep the pet on screen when the window resizes.
			react.useEffect(() => {
				const onResize = () => setPos((p) => clamp(p, scaleRef.current));
				window.addEventListener("resize", onResize);
				return () => window.removeEventListener("resize", onResize);
			}, []);

			// Re-evaluate the doze window once a minute (no rAF loop).
			react.useEffect(() => {
				const id = window.setInterval(() => setTick((t) => t + 1), 60000);
				return () => window.clearInterval(id);
			}, []);

			// Manual state override channel (debug only). A null detail clears it so
			// the derived state takes over again.
			react.useEffect(() => {
				const onState = (event) => {
					if (!(event instanceof CustomEvent)) return;
					if (typeof event.detail !== "string") return;
					setOverride(event.detail === "" ? null : event.detail);
				};
				window.addEventListener("dsh-pet-fuyuko:state", onState);
				return () => window.removeEventListener("dsh-pet-fuyuko:state", onState);
			}, []);

			// Alt + wheel over the sprite zooms it. The listener is native and
			// non-passive on purpose: React's onWheel is passive at the root, so a
			// synthetic handler could not stop the page/app from also scrolling.
			react.useEffect(() => {
				const node = elRef.current;
				if (node === null) return undefined;

				const onWheel = (event) => {
					// Only Alt+wheel resizes; a bare wheel keeps scrolling the app.
					if (!event.altKey) return;
					event.preventDefault();
					event.stopPropagation();
					const current = scaleRef.current;
					const next = sanitizeScale(current * (1 - event.deltaY * ZOOM_RATE));
					if (next === current) return;
					scaleRef.current = next;
					setScale(next);
					// Re-anchor so her feet stay planted, then clamp to the window.
					setPos((p) => {
						const anchored = anchorOnZoom(p, current, next);
						const nextPos = clamp(anchored, next);
						writePosition(nextPos.x, nextPos.y);
						return nextPos;
					});
					writeScale(next);
					flashZoom();
				};

				node.addEventListener("wheel", onWheel, { passive: false });
				return () => node.removeEventListener("wheel", onWheel);
			}, [ready]);

			// Ctrl/Cmd+Shift+F toggles her visibility, window-wide. Registered in the
			// overlay component so it only applies to this window, never globally.
			react.useEffect(() => {
				const onKey = (event) => {
					if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return;
					if (event.code !== "KeyF" && event.key !== "F" && event.key !== "f") return;
					event.preventDefault();
					commitPetState({ hidden: !petStateRef.current.hidden });
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [commitPetState]);

			// Load the manifest: it confirms the asset route and supplies hotspots.
			react.useEffect(() => {
				let alive = true;
				fetch(`${ASSET}/pet.json`, { cache: "no-store" })
					.then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
					.then((manifest) => {
						if (!alive) return;
						setHotspots(Array.isArray(manifest?.hotspots) ? manifest.hotspots : null);
						setReady(true);
					})
					.catch(() => {
						if (alive) setReady(false);
					});
				return () => {
					alive = false;
				};
			}, []);

			// Load the line library. A failure is silent: she still animates, she
			// just has nothing to say — the pet must never disappear over a bad JSON.
			react.useEffect(() => {
				let alive = true;
				fetch(LINES_URL, { cache: "no-cache" })
					.then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
					.then((raw) => {
						if (!alive) return;
						const lib = normalizeLibrary(raw);
						if (lib === null) return;
						resetCycles();
						setLibrary(lib);
						// Read-only probe for the local verification tooling. The line
						// library is public static data served to every browser anyway.
						window.__petLib = lib;
					})
					.catch(() => {});
				return () => {
					alive = false;
				};
			}, []);

			// Greet once per page load, a beat after she appears.
			const greeted = react.useRef(false);
			react.useEffect(() => {
				if (!ready || library === null || greeted.current) return undefined;
				greeted.current = true;
				const timer = window.setTimeout(() => {
					if (!petStateRef.current.hidden) speak("idle", 0);
				}, 1200);
				return () => window.clearTimeout(timer);
			}, [ready, library, speak]);

			// Ambient reactions to the session: panic gets a summary, the rest get a
			// line at most once every AMBIENT_GAP_MS so she never chatters.
			const prevActivity = react.useRef(null);
			const lastAmbientAt = react.useRef(0);
			const lastErrorAt = react.useRef(0);
			react.useEffect(() => {
				const activity = signal.activity;
				const prev = prevActivity.current;
				prevActivity.current = activity;
				if (activity === prev) return;
				if (activity === ACTIVITY.ERROR) {
					const now = Date.now();
					if (now - lastErrorAt.current < ERROR_REPEAT_MS) return;
					lastErrorAt.current = now;
					speakError(signal.errorText);
					return;
				}
				if (activity === ACTIVITY.IDLE) return;
				const now = Date.now();
				if (now - lastAmbientAt.current < AMBIENT_GAP_MS) return;
				lastAmbientAt.current = now;
				speak(activity === ACTIVITY.WORKING ? "work" : "think", 0);
			}, [signal.activity, signal.errorText, speak, speakError]);

			// Occasional idle chatter, so a long quiet stretch is not dead air.
			react.useEffect(() => {
				if (library === null) return undefined;
				const id = window.setInterval(() => {
					const st = petStateRef.current;
					if (st.hidden || st.muted) return;
					if (getSignal().activity !== ACTIVITY.IDLE) return;
					if (Math.random() > 0.5) return;
					speak("idle", 0);
				}, IDLE_GAP_MS);
				return () => window.clearInterval(id);
			}, [library, speak]);

			// Close the menu on an outside press or Escape.
			react.useEffect(() => {
				if (menu === null) return undefined;
				const onDown = (event) => {
					if (menuRef.current !== null && menuRef.current.contains(event.target)) return;
					setMenu(null);
				};
				const onKey = (event) => {
					if (event.key === "Escape") setMenu(null);
				};
				window.addEventListener("pointerdown", onDown, true);
				window.addEventListener("keydown", onKey);
				return () => {
					window.removeEventListener("pointerdown", onDown, true);
					window.removeEventListener("keydown", onKey);
				};
			}, [menu]);

			const onPointerDown = react.useCallback(
				(event) => {
					if (event.button !== 0) return;
					// Capture keeps the drag alive when the pointer outruns the sprite.
					// It throws when the pointer is already gone (synthetic events,
					// a fast release, some remote-desktop bridges), so the drag state
					// must be recorded either way — otherwise a click is silently lost.
					try {
						event.currentTarget.setPointerCapture(event.pointerId);
					} catch {}
					drag.current = {
						pointerId: event.pointerId,
						offsetX: event.clientX - pos.x,
						offsetY: event.clientY - pos.y,
						startX: event.clientX,
						startY: event.clientY,
						moved: false
					};
					setDragging(true);
				},
				[pos.x, pos.y]
			);

			const onPointerMove = react.useCallback((event) => {
				const d = drag.current;
				if (d === null || d.pointerId !== event.pointerId) return;
				// A 3px dead zone keeps a click from being read as a 1px drag, and
				// stops the pet from creeping under a stationary finger.
				if (!d.moved) {
					if (Math.hypot(event.clientX - d.startX, event.clientY - d.startY) <= 3) return;
					d.moved = true;
				}
				setPos(clamp({ x: event.clientX - d.offsetX, y: event.clientY - d.offsetY }, scaleRef.current));
			}, []);

			/** Ahoge wiggle: a short, self-clearing motion flag. */
			const wiggle = react.useCallback(() => {
				setWiggling(true);
				if (wiggleTimer.current !== null) window.clearTimeout(wiggleTimer.current);
				wiggleTimer.current = window.setTimeout(() => {
					wiggleTimer.current = null;
					setWiggling(false);
				}, 700);
			}, []);

			/**
			 * A body click: speak, and now and then swap persona. The 10% flip is
			 * the only way to discover the second personality by accident.
			 */
			const onBodyClick = react.useCallback(() => {
				const st = petStateRef.current;
				const flip = Math.random() < 0.1;
				if (flip) {
					commitPetState({ mode: st.mode === MODE.OMOTE ? MODE.URA : MODE.OMOTE });
				}
				// In 本体 mode she always grumbles before saying anything.
				if (!st.muted && !flip && st.mode === MODE.URA) {
					say([{ key: "hm", kind: "speech", talk: true, text: "哼。", emotion: "pout", ms: 700 }], 1);
				}
				speak("click");
			}, [commitPetState, say, speak]);

			const onPointerUp = react.useCallback(
				(event) => {
					const d = drag.current;
					if (d === null || d.pointerId !== event.pointerId) return;
					drag.current = null;
					setDragging(false);
					setPos((p) => {
						const next = clamp(p, scaleRef.current);
						writePosition(next.x, next.y);
						return next;
					});
					if (d.moved) {
						recordInteraction();
						return;
					}
					// A click: which hotspot did it land on?
					recordInteraction();
					const box = boxSize(scaleRef.current);
					const local = posRef.current;
					const nx = box > 0 ? (event.clientX - local.x) / box : 0.5;
					const ny = box > 0 ? (event.clientY - local.y) / box : 0.5;
					const spot = hitHotspot(hotspotsRef.current, nx, ny);
					if (spot === "ahoge") {
						wiggle();
						speak("ahoge");
						return;
					}
					onBodyClick();
				},
				[onBodyClick, recordInteraction, speak, wiggle]
			);

			const onContextMenu = react.useCallback(
				(event) => {
					event.preventDefault();
					recordInteraction();
					const items = menuItemsFor(petStateRef.current);
					const size = menuSize(items);
					setMenu(placeMenu(event.clientX, event.clientY, size, {
						width: window.innerWidth,
						height: window.innerHeight
					}));
				},
				[recordInteraction]
			);

			/** Run one context-menu command. */
			const onMenuAction = react.useCallback(
				(id) => {
					setMenu(null);
					const st = petStateRef.current;
					if (id === "talk") {
						recordInteraction();
						speak("click");
						return;
					}
					if (id === "mode") {
						commitPetState({ mode: st.mode === MODE.OMOTE ? MODE.URA : MODE.OMOTE });
						speak("click");
						return;
					}
					if (id === "mute") {
						const muted = !st.muted;
						commitPetState({ muted });
						// Un-muting gets an immediate sign of life.
						if (!muted) speak("click");
						return;
					}
					if (id === "hide") {
						commitPetState({ hidden: true });
						return;
					}
					if (id === "reset") {
						commitPetState({ cooldowns: {}, onceSeen: [] });
						resetCycles();
					}
				},
				[commitPetState, recordInteraction, speak]
			);

			// Probe for the local verification tooling: coarse facts only, no content.
			const derivedState = override ?? deriveSpriteState({
				activity: signal.activity,
				dragging,
				talking,
				hovering,
				sleeping: shouldSleep({
					hour: new Date().getHours(),
					now: Date.now(),
					lastInteractionAt: petState.lastInteractionAt,
					activity: signal.activity
				})
			});
			react.useEffect(() => {
				window.__petProbe = () => ({
					state: derivedState,
					mode: petState.mode,
					muted: petState.muted,
					hidden: petState.hidden,
					bubble: bubble === null ? null : bubble.text,
					lines: library === null ? 0 : library.lines.length
				});
			}, [derivedState, petState, bubble, library]);

			if (!ready) return null;
			if (petState.hidden) return null;

			const sprite = `${ASSET}/fuyuko.png`;
			const box = boxSize(scale);
			const state = derivedState;
			const bubblePos = bubble === null ? null : placeBubble(pos, box, {
				width: window.innerWidth,
				height: window.innerHeight
			});
			const items = menuItemsFor(petState);

			return react.createElement(
				"div",
				{
					className: "dpf-layer",
					// Inline, because the host's `.overlayLayer > *` rule forces
					// pointer-events:auto on every child; without this the layer
					// would swallow clicks meant for the app underneath.
					style: { pointerEvents: "none" }
				},
				react.createElement(
					"div",
					{
						ref: elRef,
						className: "dpf-pet",
						"data-state": dragging ? "dragged" : state,
						"data-dragging": dragging ? "true" : "false",
						"data-scale": scale.toFixed(3),
						"data-zooming": zooming ? "true" : "false",
						"data-motion": wiggling ? "wiggle" : "none",
						"data-mode": petState.mode,
						"data-muted": petState.muted ? "true" : "false",
						title: "拖动移动 · Alt + 滚轮缩放 · 右键菜单 · Ctrl+Shift+F 隐身",
						style: {
							left: `${pos.x}px`,
							top: `${pos.y}px`,
							width: `${box}px`,
							height: `${box}px`,
							pointerEvents: "auto"
						},
						onPointerDown,
						onPointerMove,
						onPointerUp,
						onPointerCancel: onPointerUp,
						onPointerEnter: () => setHovering(true),
						onPointerLeave: () => setHovering(false),
						onContextMenu,
						onDragStart: (e) => e.preventDefault(),
						role: "img",
						"aria-label": "黛冬优子"
					},
					react.createElement(
						"div",
						{ className: "dpf-figure" },
						react.createElement("img", { src: sprite, alt: "", draggable: false })
					),
					react.createElement("span", { className: "dpf-badge" }, `${Math.round(scale * 100)}%`),
					state === "think"
						? react.createElement(
								"div",
								{ className: "dpf-dots", style: { left: "62%", top: "-2px" } },
								react.createElement("span", { className: "dpf-dot" }),
								react.createElement("span", { className: "dpf-dot" }),
								react.createElement("span", { className: "dpf-dot" })
							)
						: null
				),
				bubble === null
					? null
					: react.createElement(
							"div",
							{
								className: "dpf-bubble",
								"data-kind": bubble.kind,
								"data-side": bubblePos.side,
								"data-emotion": bubble.emotion ?? "",
								style: { left: `${bubblePos.left}px`, top: `${bubblePos.top}px` }
							},
							bubble.text,
							bubble.summary === undefined
								? null
								: react.createElement("div", { className: "dpf-bubble-summary" }, bubble.summary),
							react.createElement("span", { className: "dpf-bubble-tail" })
						),
				menu === null
					? null
					: react.createElement(
							"div",
							{
								ref: menuRef,
								className: "dpf-menu",
								role: "menu",
								style: { left: `${menu.left}px`, top: `${menu.top}px` }
							},
							items.map((item, index) =>
								item.sep === true
									? react.createElement("div", { key: `sep-${index}`, className: "dpf-menu-sep" })
									: react.createElement(
											"button",
											{
												key: item.id,
												type: "button",
												className: "dpf-menu-item",
												role: "menuitem",
												disabled: item.disabled === true,
												"data-checked": item.checked === true ? "true" : "false",
												onClick: () => onMenuAction(item.id)
											},
											item.label,
											item.hint === undefined
												? null
												: react.createElement("span", { className: "dpf-menu-hint" }, item.hint)
										)
							)
						)
			);
		}

		/**
		 * Build the context-menu rows for one persona state. Kept pure so the tests
		 * can assert the menu without rendering it.
		 * @param {ReturnType<typeof defaultPetState>} state - pet state.
		 * @returns {any[]} menu rows (`{sep:true}` marks a separator).
		 */
		function menuItemsFor(state) {
			return [
				{ id: "talk", label: "说点什么" },
				{ id: "mode", label: state.mode === MODE.OMOTE ? "切换到本体模式" : "切换到营业模式" },
				{ id: "mute", label: state.muted ? "取消静音" : "静音" },
				{ id: "hide", label: "隐身", hint: "Ctrl+Shift+F" },
				{ sep: true },
				{ id: "reset", label: "重置台词冷却" },
				{ sep: true },
				{ id: "balance", label: "看余额", hint: "M3", disabled: true },
				{ id: "feed", label: "喂零食", hint: "M4", disabled: true }
			];
		}

		/** Required services: the slot registry. */
		const inject = ["slots"];

		/**
		 * Client plugin body: contribute the pet into the frame-wide overlay, and
		 * the invisible bridge into the session-scoped input overlay.
		 * @param {any} ctx - client root context.
		 */
		function apply(ctx) {
			ctx.slots.inject("shell.overlay", () =>
				ctx.slots.register(
					{
						name: "shell.overlay",
						id: "pet-fuyuko",
						order: 50
					},
					PetLayer
				)
			);
			// The bridge needs a session-scoped seat to reach useChat/useSession.
			// `conversation.input.overlay` is a list slot that renders above the
			// composer; the bridge draws nothing, so it is purely a data tap.
			ctx.slots.inject("conversation.input.overlay", () =>
				ctx.slots.register(
					{
						name: "conversation.input.overlay",
						id: "pet-fuyuko-bridge",
						order: 90
					},
					SessionBridge
				)
			);
		}

		exports.PetLayer = PetLayer;
		exports.SessionBridge = SessionBridge;
		exports.apply = apply;
		exports.inject = inject;
		// Test-only face for the pure helpers (not part of the plugin contract).
		exports.__test = {
			clamp,
			defaultPosition,
			anchorOnZoom,
			boxSize,
			sanitizeScale,
			readPosition,
			writePosition,
			readScale,
			writeScale,
			readDebugState,
			deriveActivity,
			publishSignal,
			clearSignal,
			getSignal,
			subscribeSignal,
			ACTIVITY,
			EMPTY_SIGNAL,
			normalizeLibrary,
			pickLine,
			applyVars,
			matchesSchedule,
			bubbleMs,
			summarizeError,
			cycleFor,
			resetCycles,
			defaultPetState,
			sanitizePetState,
			readPetState,
			writePetState,
			pruneCooldowns,
			deriveSpriteState,
			isSleepHour,
			shouldSleep,
			hitHotspot,
			placeBubble,
			placeMenu,
			menuSize,
			menuItemsFor,
			MODE,
			PET_STATE_VERSION,
			SIZE,
			MARGIN,
			MIN_SCALE,
			MAX_SCALE,
			ZOOM_RATE,
			DEFAULT_COOLDOWN,
			SLEEP_FROM_HOUR,
			SLEEP_TO_HOUR,
			SLEEP_IDLE_MS,
			ERROR_SNIPPET
		};
		return module.exports;
	}
});
