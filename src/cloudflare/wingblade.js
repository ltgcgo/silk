// Copyright (c) Lightingale Flame Author(s) 2023.
// Licensed under GNU AGPL 3.0.
"use strict";

let WingBlade = {
	args: [],
	os: "linux",
	variant: "Cloudflare",
	version: "v1.0.0",
	persist: true,
	exit: (code = 0) => {
		throw(new Error(`WingBlade attempted exitting with code ${code}.`));
	},
	getEnv: (key, fallbackValue) => {
		return self[key] || fallbackValue;
	},
	memUsed: () => {
		return 0;
	},
	randomInt: (cap) => {
		return Math.floor(Math.random() * cap);
	},
	readFile: async function (path, opt) {
		throw(new Error(`File reads are not permitted on this platform.`));
		return;
	},
	serve: (handler, opt = {}) => {
		self.addEventListener("fetch", async function(event) {
			let request = event.request;
			let clientInfo = request.headers.get("cf-connecting-ip");
			event.respondWith(handler(request));
		});
		console.error(`WingBlade serving at (Wrangler Dev Server)`);
	},
	setEnv: (key, value) => {
		self[key] = value;
	},
	sleep: function (ms, maxAdd = 0) {
		return new Promise((y, n) => {
			setTimeout(y, ms + Math.floor(maxAdd * Math.random()));
		});
	},
	upgradeWebSocket: (req) => {
		let [client, socket] = Object.values(new WebSocketPair());
		socket.accept();
		let addEL = socket.addEventListener;
		Object.defineProperty(socket, "addEventListener", {value: function (type, ...args) {
			if (type == "open") {
				args[0].call(socket);
			} else {
				addEL.call(socket, type, ...args);
			};
		}});
		return {
			socket: socket,
			response: new Response(null, {
				status: 101,
				webSocket: client
			})
		};
	},
	writeFile: async function (path, data, opt = {}) {
		throw(new Error(`File writes are not permitted on this platform.`));
		return;
	}
};

export {
	WingBlade
};
