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
.dpf-dots{position:absolute;pointer-events:none;display:flex;gap:4px}
.dpf-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-tertiary,#999);opacity:0;animation:dpf-dot 1.6s ease-in-out infinite}
.dpf-dot:nth-child(2){animation-delay:.25s}
.dpf-dot:nth-child(3){animation-delay:.5s}
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
		/** Persisted state override (debug). */
		const STATE_KEY = "dsh-pet-fuyuko:state";
		/** Sprite box in CSS px. */
		const SIZE = 160;
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
		 * Clamp a position so the sprite stays fully on screen.
		 * @param {{x:number,y:number}} pos - candidate position.
		 * @returns {{x:number,y:number}} clamped position.
		 */
		function clamp(pos) {
			const maxX = Math.max(MARGIN, window.innerWidth - SIZE - MARGIN);
			const maxY = Math.max(MARGIN, window.innerHeight - SIZE - MARGIN);
			return {
				x: Math.min(Math.max(MARGIN, pos.x), maxX),
				y: Math.min(Math.max(MARGIN, pos.y), maxY)
			};
		}

		/** Default seat: bottom-right, above the composer. */
		function defaultPosition() {
			return clamp({
				x: window.innerWidth - SIZE - 28,
				y: window.innerHeight - SIZE - 96
			});
		}

		/**
		 * The pet surface: a draggable static sprite in the frame-wide overlay.
		 * Window-level on purpose: a desktop pet belongs to the window, not to one
		 * conversation, so M0 shows it on every view. Session-driven state lands
		 * in M1 through the bridge component, not through visibility gating.
		 * @returns {import('react').ReactElement | null} the pet, or nothing until
		 *   the asset probe confirms the sprite route answers.
		 */
		function PetLayer() {
			const initial = react.useRef(null);
			if (initial.current === null) {
				const stored = readPosition();
				initial.current = stored.placed ? clamp(stored) : defaultPosition();
			}

			const [pos, setPos] = react.useState(initial.current);
			const [dragging, setDragging] = react.useState(false);
			const [state, setState] = react.useState(() => readState() ?? "idle");
			const [ready, setReady] = react.useState(false);
			const drag = react.useRef(null);
			const elRef = react.useRef(null);

			// Keep the pet on screen when the window resizes.
			react.useEffect(() => {
				const onResize = () => setPos((p) => clamp(p));
				window.addEventListener("resize", onResize);
				return () => window.removeEventListener("resize", onResize);
			}, []);

			// Debug state channel: lets M1 wire real session state without a rebuild.
			react.useEffect(() => {
				const onState = (event) => {
					if (event instanceof CustomEvent && typeof event.detail === "string") setState(event.detail);
				};
				window.addEventListener("dsh-pet-fuyuko:state", onState);
				return () => window.removeEventListener("dsh-pet-fuyuko:state", onState);
			}, []);

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
				setPos(clamp({ x: event.clientX - d.offsetX, y: event.clientY - d.offsetY }));
			}, []);

			const onPointerUp = react.useCallback(
				(event) => {
					const d = drag.current;
					if (d === null || d.pointerId !== event.pointerId) return;
					drag.current = null;
					setDragging(false);
					setPos((p) => {
						const next = clamp(p);
						writePosition(next.x, next.y);
						return next;
					});
					if (!d.moved) {
						// A plain click: bounce once, no台词 yet (M2).
						setState("panic");
						window.setTimeout(() => setState((s) => (s === "panic" ? "idle" : s)), 700);
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
						style: {
							left: `${pos.x}px`,
							top: `${pos.y}px`,
							width: `${SIZE}px`,
							height: `${SIZE}px`,
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
		 * Client plugin body: contribute the pet into the frame-wide overlay.
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
		}

		exports.PetLayer = PetLayer;
		exports.apply = apply;
		exports.inject = inject;
		// Test-only face for the geometry helpers (not part of the plugin contract).
		exports.__test = { clamp, defaultPosition, readPosition, writePosition, readState, SIZE, MARGIN };
		return module.exports;
	}
});
