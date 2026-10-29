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
.dpf-pet img{display:block;width:100%;height:100%;object-fit:contain;image-rendering:auto;filter:drop-shadow(0 6px 10px rgba(0,0,0,.18));pointer-events:none;-webkit-user-drag:none}
.dpf-pet[data-state=idle]{animation:dpf-breathe 4s ease-in-out infinite}
.dpf-pet[data-state=think]{animation:dpf-float 6s ease-in-out infinite}
.dpf-pet[data-state=work]{animation:dpf-sway 2.4s ease-in-out infinite}
.dpf-pet[data-state=panic]{animation:dpf-shake .18s ease-in-out 3}
.dpf-pet[data-state=sleepy]{animation:dpf-sink 5s ease-in-out infinite;filter:saturate(.72) brightness(.96)}
.dpf-pet[data-state=dragged]{animation:none}
.dpf-pet[data-ghost=true]{opacity:0;pointer-events:none}
.dpf-pet[data-zooming=true]{cursor:ns-resize}
.dpf-dots{position:absolute;pointer-events:none;display:flex;gap:4px}
.dpf-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-tertiary,#999);opacity:0;animation:dpf-dot 1.6s ease-in-out infinite}
.dpf-dot:nth-child(2){animation-delay:.25s}
.dpf-dot:nth-child(3){animation-delay:.5s}
.dpf-badge{position:absolute;right:-2px;bottom:-2px;pointer-events:none;padding:1px 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2,#fff);border:.5px solid var(--dsw-alias-border-l2,#ddd);color:var(--dsw-alias-label-secondary,#666);font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums;opacity:0;transition:opacity .18s ease}
.dpf-pet[data-zooming=true] .dpf-badge{opacity:1}
@keyframes dpf-breathe{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(0,-3px,0) scale(1.008)}}
@keyframes dpf-float{0%,100%{transform:translate3d(0,-2px,0) rotate(-.4deg)}50%{transform:translate3d(0,-7px,0) rotate(.4deg)}}
@keyframes dpf-sway{0%,100%{transform:translate3d(-1.5px,0,0) rotate(-.8deg)}50%{transform:translate3d(1.5px,0,0) rotate(.8deg)}}
@keyframes dpf-shake{0%,100%{transform:translate3d(0,0,0)}25%{transform:translate3d(-4px,0,0) rotate(-1.5deg)}75%{transform:translate3d(4px,0,0) rotate(1.5deg)}}
@keyframes dpf-sink{0%,100%{transform:translate3d(0,2px,0)}50%{transform:translate3d(0,5px,0)}}
@keyframes dpf-dot{0%,100%{opacity:.15;transform:translateY(0)}50%{opacity:.85;transform:translateY(-2px)}}
@media (prefers-reduced-motion:reduce){
  .dpf-pet{animation:none!important}
  .dpf-dot{animation:none;opacity:.5}
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
		/** Persisted position key. */
		const POS_KEY = "dsh-pet-fuyuko:position";
		/** Persisted zoom key. */
		const SCALE_KEY = "dsh-pet-fuyuko:scale";
		/** Persisted state override (debug). */
		const STATE_KEY = "dsh-pet-fuyuko:state";
		/** Sprite box in CSS px at scale 1. */
		const SIZE = 160;
		/** Zoom limits: below 0.5 she is a smudge, above 2.5 she eats the window. */
		const MIN_SCALE = 0.5;
		const MAX_SCALE = 2.5;
		/** Wheel sensitivity: a 100px notch is roughly a 16% size change. */
		const ZOOM_RATE = 0.0015;
		/** Keep the pet clear of the composer and window edges. */
		const MARGIN = 16;

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
		function readState() {
			try {
				const v = window.localStorage.getItem(STATE_KEY);
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
		 * The pet surface: a draggable static sprite in the frame-wide overlay.
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
					pos: stored.placed ? clamp(stored, scale) : defaultPosition(scale)
				};
			}

			const [pos, setPos] = react.useState(initial.current.pos);
			const [scale, setScale] = react.useState(initial.current.scale);
			const [dragging, setDragging] = react.useState(false);
			const [ready, setReady] = react.useState(false);
			// Briefly true while the zoom badge is showing.
			const [zooming, setZooming] = react.useState(false);
			const zoomTimer = react.useRef(null);
			const drag = react.useRef(null);
			const elRef = react.useRef(null);
			// Latest scale for listeners registered once (wheel handler).
			const scaleRef = react.useRef(scale);
			scaleRef.current = scale;

			// Live activity from the session-scoped bridge. `null` means the bridge
			// has not mounted yet (no session), so the pet falls back to idle.
			const signal = react.useSyncExternalStore(subscribeSignal, getSignal, getSignal);
			// A manual override wins over the derived activity: it is the M1 debug
			// channel, and it lets the click reaction interrupt cleanly.
			const [override, setOverride] = react.useState(() => readState() ?? null);
			const state = override ?? signal.activity;

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
				},
				[]
			);

			// Keep the pet on screen when the window resizes.
			react.useEffect(() => {
				const onResize = () => setPos((p) => clamp(p, scaleRef.current));
				window.addEventListener("resize", onResize);
				return () => window.removeEventListener("resize", onResize);
			}, []);

			// Manual state override channel (debug + click reaction). A null detail
			// clears it so the derived activity takes over again.
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

			const onPointerDown = react.useCallback(
				(event) => {
					if (event.button !== 0) return;
					event.currentTarget.setPointerCapture(event.pointerId);
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
					if (!d.moved) {
						// A plain click: bounce once, then hand control back to the
						// derived activity (M2 replaces this with lines).
						setOverride("panic");
						window.setTimeout(() => setOverride((s) => (s === "panic" ? null : s)), 700);
					}
				},
				[]
			);

			react.useEffect(() => {
				let alive = true;
				fetch(`${ASSET}/pet.json`, { cache: "no-store" })
					.then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
					.then(() => {
						if (alive) setReady(true);
					})
					.catch(() => {
						if (alive) setReady(false);
					});
				return () => {
					alive = false;
				};
			}, []);

			if (!ready) return null;

			const sprite = `${ASSET}/fuyuko.png`;
			const box = boxSize(scale);
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
						title: "拖动移动 · Alt + 滚轮缩放",
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
						onDragStart: (e) => e.preventDefault(),
						role: "img",
						"aria-label": "黛冬优子"
					},
					react.createElement("img", { src: sprite, alt: "", draggable: false }),
					react.createElement(
						"span",
						{ className: "dpf-badge" },
						`${Math.round(scale * 100)}%`
					),
					state === "think"
						? react.createElement(
								"div",
								{ className: "dpf-dots", style: { left: "62%", top: "-2px" } },
								react.createElement("span", { className: "dpf-dot" }),
								react.createElement("span", { className: "dpf-dot" }),
								react.createElement("span", { className: "dpf-dot" })
							)
						: null
				)
			);
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
			readState,
			deriveActivity,
			publishSignal,
			clearSignal,
			getSignal,
			subscribeSignal,
			ACTIVITY,
			EMPTY_SIGNAL,
			SIZE,
			MARGIN,
			MIN_SCALE,
			MAX_SCALE,
			ZOOM_RATE
		};
		return module.exports;
	}
});
