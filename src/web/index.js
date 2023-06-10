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

// Use dates
self.formatTime = (ts = 0, format = "DD-MM-YYYY hh:mm:ss") => {
	let date = new Date(ts);
	let result = format;
	result = result.replace("YYYY", `${date.getFullYear()}`.padStart(2, "0"));
	result = result.replace("YY", `${date.getFullYear() % 100}`.padStart(2, "0"));
	result = result.replace("DD", `${date.getDate()}`.padStart(2, "0"));
	result = result.replace("MM", `${date.getMonth() + 1}`.padStart(2, "0"));
	result = result.replace("hh", `${date.getHours()}`.padStart(2, "0"));
	result = result.replace("mm", `${date.getMinutes()}`.padStart(2, "0"));
	result = result.replace("ss", `${date.getSeconds()}`.padStart(2, "0"));
	return result;
};
self.formatPercentage = (value = 0) => {
	return (Math.round(value * 10000) / 100) || 0;
};

// Get posts
Alpine.store("servers", []);
Alpine.store("posts", []);
let postRef = {};
let renderPost = function (post) {
	// Deal with polls
	if (post.poll) {
		let maxVotes = 0.5;
		post.poll.options?.forEach((e) => {
			if (e.sumVote > maxVotes) {
				maxVotes = e.sumVote;
			};
		});
		post.poll.options?.forEach((e) => {
			e.isTop = e.sumVote >= maxVotes;
		});
	};
	// Render display names
	post.user.html = post.user.dispName || post.user.username;
	post.user.emojis.forEach((e) => {
		post.user.html = post.user.html.replaceAll(`:${e.code}:`, `<img class="fedimoji" src="${e.static}" title="${e.code}" fetchpriority="low" loading="lazy"></img>`);
	});
	// Render posts
	post.html = post.text;
	post.emojis.forEach((e) => {
		post.html = post.html.replaceAll(`:${e.code}:`, `<img class="fedimoji" src="${e.static}" title="${e.code}" fetchpriority="low" loading="lazy"></img>`);
	});
	post.html = post.html
		.replaceAll(` class="mention hashtag" rel="tag">`, ` class="mention hashtag" target="_blank" rel="tag">`)
		.replaceAll(` class="u-url mention">`, ` class="u-url mention" href="_blank">`);
};

Alpine.start();

let setPost = (e, dir = 0) => {
	renderPost(e);
	if (postRef[e.rid]) {
		// Modify
		let modIndex = Alpine.store("posts").indexOf(postRef[e.rid]);
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
(async () => {
	let failed = true;
	while (failed) {
		let reply = await fetch("https://api.ltgc.cc/nr/silk/servers");
		if (reply.status == 200) {
			(await reply.json()).forEach(async (e) => {
				Alpine.store("servers").push(e);
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

let sortingThread = setInterval(async () => {
	Alpine.store("posts").sort((a, b) => {
		return b.atNew - a.atNew;
	});
}, 15000);
