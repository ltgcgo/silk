"use strict";

//import {SilkClient} from "../silkApi/index.mjs";
//import {m} from "../../libs/mithril/mithril.js";
import {Alpine} from "../../libs/alpinejs/alpine.js";
import langPool from "./lang.js";

// Quickpath
let $e = (selector = "", root = document) => {
	return root.querySelector(selector);
};
let sleep = function (timeout = 0) {
	return new Promise((r) => {
		AbortSignal.timeout(timeout).addEventListener("abort", r);
	});
};

self.Alpine = Alpine;

// Use languages
let currentPool;
let setLang = (lang = "en") => {
	currentPool = langPool[lang] || langPool.en;
	Alpine.store("str", currentPool);
	globalRefresh();
};

// The full app
Alpine.store("app", {
	view: location.hash.slice(3) || "timeline"
});
let appInfo = Alpine.store("app");
addEventListener("hashchange", async () => {
	appInfo.view = location.hash.slice(3) || "timeline";
	globalRefresh();
});

// Global refresh
let globalRefresh = async () => {
	document.title = `Silk Web - ${currentPool.tab[Alpine.store("app").view]}`;
};
let chooseLang = () => {
	for (let i = 0; i < navigator.languages.length; i ++) {
		let e = navigator.languages[i];
		if (langPool[e]) {
			return e;
		};
	};
	return "en";
};
let updateLang = () => {
	setLang(chooseLang());
};
addEventListener("languagechange", updateLang);
updateLang();

// Get posts
let postStore = Alpine.store("posts", []);
let postRef = {};
let renderPost = function (post) {
	post.html = post.text;
};

Alpine.start();

let setPost = (e, dir = 0) => {
	renderPost(e);
	if (postRef[e.rid]) {
		// Modify
		let modIndex = postStore.indexOf(postRef[e.rid]);
		if (modIndex > -1) {
			postRef[e.rid] = e;
			Alpine.store("posts")[modIndex] = e;
		} else {
			console.warn(`Received a post modification event that didn't exist: ${e.rid}.`);
		};
	} else {
		// Add
		postRef[e.rid] = e;
		if (dir) {
			Alpine.store("posts").unshift(e);
		} else {
			Alpine.store("posts").push(e);
		};
	};
};
let delPost = (rid) => {};
(async () => {
	let failed = true;
	while (failed) {
		let reply = await fetch("https://api.ltgc.cc/nr/silk/timeline");
		if (reply.status == 200) {
			(await reply.json()).forEach(async (e) => {
				setPost(e);
			});
			failed = false;
		} else {
			await sleep(4000);
		};
	};
})();
let ws, wsConn = async function () {
	ws = new WebSocket(`ws://api.ltgc.cc/rt/silk/timeline`);
	ws.addEventListener("message", (ev) => {
		let msg = JSON.parse(ev.data);
		let post = msg.data;
		switch (msg.event) {
			case "set": {
				setPost(post, 1);
				break;
			};
			default: {
				console.warn(`Unknown event "${msg.event}".`, post);
			};
		};
	});
	ws.addEventListener("close", async () => {
		await sleep(2000);
		wsConn();
	});
};
wsConn();
