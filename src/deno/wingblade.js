// Copyright (c) Lightingale WingBlade Author(s) 2023.
// Licensed under GNU LGPL 3.0.

"use strict";

import {serve} from "../../libs/denoServe/server.js";

let WingBlade = {
	args: Deno.args,
	os: Deno.build.os,
	variant: "Deno",
	version: Deno.version.deno,
	persist: true,
	exit: (code = 0) => {
		Deno.exit(code);
	},
	getEnv: (key, fallbackValue) => {
		return Deno.env.get(key) || fallbackValue;
	},
	memUsed: () => {
		return Deno.memoryUsage();
	},
	randomInt: (cap) => {
		return Math.floor(Math.random() * cap);
	},
	readFile: async function (path, opt) {
		return await Deno.readFile(path, opt);
	},
	serve: (handler, opt = {}) => {
		if (!opt?.onListen) {
			opt.onListen = function ({port, hostname}) {
				console.error(`WingBlade serving at http://${hostname}:${port}`);
			};
		};
		if (!opt?.hostname) {
			opt.hostname = "127.0.0.1";
		};
		if (!opt?.port) {
			opt.port = 8000;
		};
		return serve(handler, opt);
	},
	setEnv: (key, value) => {
		return Deno.env.set(key, value);
	},
	sleep: function (ms, maxAdd = 0) {
		return new Promise((y, n) => {
			let as = AbortSignal.timeout(ms + Math.floor(maxAdd * Math.random()));
			as.addEventListener("abort", () => {
				y();
			});
		});
	},
	upgradeWebSocket(req, opt) {
		return Deno.upgradeWebSocket(req, opt);
	},
	writeFile: async function (path, data, opt) {
		await Deno.writeFile(path, data, opt);
	}
};

export {
	WingBlade
};
