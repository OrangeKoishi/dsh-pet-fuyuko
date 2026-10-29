/**
 * Serves the visual harness, the real client bundle, the real assets, AND the
 * real host-half routes on one origin.
 *
 * The host half is imported exactly as DSH imports it and mounted on a real
 * node:http server through the same route contract (`kind` + `path` +
 * `handler`), so the wallet talks to the genuine `/pet-fuyuko/balance` and
 * `/pet-fuyuko/key` handlers rather than a stub.
 *
 * Run: node test/harness-server.mjs [port]
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { apply as applyHost } from "../lib/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const PORT = Number(process.argv[2] ?? 4599);

const TYPES = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".css": "text/css; charset=utf-8"
};

/**
 * Minimal stand-in for @deepseek-ai/dsh-host-webserver's route table: exact
 * paths first, then longest prefix, same as the real server.
 */
function makeWebServer() {
	const exact = new Map();
	const prefixes = [];
	return {
		register(route) {
			if (route.kind === "exact") {
				exact.set(route.path, route.handler);
				return () => exact.delete(route.path);
			}
			prefixes.push(route);
			prefixes.sort((a, b) => b.path.length - a.path.length);
			return () => {
				const i = prefixes.indexOf(route);
				if (i >= 0) prefixes.splice(i, 1);
			};
		},
		/**
		 * @param {import('node:http').IncomingMessage} req - request.
		 * @param {import('node:http').ServerResponse} res - response.
		 * @returns {boolean} true when a plugin route answered.
		 */
		dispatch(req, res) {
			const pathname = new URL(req.url ?? "/", "http://x").pathname;
			const hit = exact.get(pathname);
			if (hit !== undefined) {
				hit(req, res);
				return true;
			}
			for (const p of prefixes) {
				if (pathname === p.path || pathname.startsWith(`${p.path}/`)) {
					p.handler(req, res);
					return true;
				}
			}
			return false;
		}
	};
}

const webServer = makeWebServer();
applyHost({
	logger: { debug() {}, info() {} },
	inject(_names, cb) {
		cb({
			webServer,
			logger: { debug() {}, info() {} },
			effect(fn) {
				return fn();
			}
		});
	}
});

const server = createServer((req, res) => {
	// The plugin's own routes win, exactly as they would in the app.
	if (webServer.dispatch(req, res)) return;

	const url = new URL(req.url ?? "/", "http://x");
	let file;

	if (url.pathname === "/" || url.pathname === "/harness") {
		file = join(here, "visual-harness.html");
	} else if (url.pathname === "/plugins/??dsh-pet-fuyuko/client.js" || url.pathname === "/bundle.js") {
		file = join(root, "lib", "client.js");
	}

	if (file === undefined || !existsSync(file) || !statSync(file).isFile()) {
		res.writeHead(404, { "content-type": "text/plain" });
		res.end("not found");
		return;
	}
	res.writeHead(200, {
		"content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
		"cache-control": "no-store"
	});
	createReadStream(file).pipe(res);
});

server.listen(PORT, "127.0.0.1", () => {
	console.log(`harness: http://127.0.0.1:${PORT}/`);
});
