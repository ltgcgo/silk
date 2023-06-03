// Copyright (c) Lightingale Flame Author(s) 2023.
// Licensed under GNU AGPL 3.0.
"use strict";

let WebSocket = class {
	#target = {
		onclose: [],
		onerror: [],
		onmessage: [],
		onopen: [],
		close () {},
		readyState: 0,
		isDummy: true
	};
	#url = "";
	#getWsObj = async function (url) {
		let upThis = this;
		let timeout = AbortSignal.timeout(5000);
		let reply;
		let failure = function () {
			let error = new Error("Bad WebSocket handshake");
			upThis.#target?.onerror?.forEach(function (e) {
				e[0](error);
			});
			upThis.#target?.onclose?.forEach(function (e) {
				e[0]();
			});
		};
		timeout.addEventListener("abort", function () {
			if (!reply || reply?.readyState != 1) {
				failure();
			};
		});
		reply = await fetch(url, {
			headers: {
				"Upgrade": "websocket"
			}
		});
		let handle = reply.webSocket;
		if (handle) {
			this.#target.onclose.forEach(function (e) {
				handle.addEventListener("close", ...e);
			});
			this.#target.onerror.forEach(function (e) {
				handle.addEventListener("error", ...e);
			});
			this.#target.onmessage.forEach(function (e) {
				handle.addEventListener("message", ...e);
			});
			this.#target.onopen.forEach(function (e) {
				handle.addEventListener("open", ...e);
			});
			handle.addEventListener("error", function () {
				handle.close();
			});
			handle.accept();
			this.#target = handle;
		} else {
			failure();
		};
	};
	addEventListener(...args) {
		if (this.#target.isDummy) {
			this.#target[`on${args[0]}`].push(args.slice(1));
		} else {
			this.#target?.addEventListener(...args);
		};
	};
	close(...args) {
		this.#target.close(...args);
	};
	send(...args) {
		this.#target?.send(...args);
	};
	get url() {
		return this.#url;
	};
	get readyState() {
		return this.#target.readyState;
	};
	constructor(url) {
		let wsTarget = url,
		protIdx = url.indexOf("ws");
		if (protIdx == 0) {
			wsTarget = url.replace("ws", "http");
		};
		this.#url = wsTarget;
		this.#getWsObj(wsTarget);
	};
};

export {
	WebSocket
};
