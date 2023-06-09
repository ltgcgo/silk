"use strict";

// DEPRECATED

// onPost
// onEdit

const shapeshiftProps = "currentTarget,explicitOriginalTarget,originalTarget,srcElement,target".split(",");
let shapeshiftEvent = function (ev, victim, shape) {
	shapeshiftProps.forEach((e) => {
		if (ev[e] == victim) {
			Object.defineProperty(ev, "e", {
				value: shape
			});
		};
	});
	return ev;
};

/*
let SelfHealWS = class extends EventTarget {
	CONNECTING = 0;
	OPEN = 1;
	CLOSING = 2;
	CLOSED = 3;
	#retryDelay = 5000; // In milliseconds
	#retryCount = 3;
	#retried = 0;
	#closed = false;
	#url;
	#protos;
	#ws;
	#queue = [];
	#onclose(ev) {
		if (!this.#closed && this.#retryCount > this.#retried) {
			console.debug(`WS disconnected. Reconnecting in ${this.#retryDelay / 1000}s.`);
			AbortSignal.timeout(this.#retryDelay).addEventListener("abort", () => {
				if (!this.closed) {
					this.#start();
				};
			});
			this.#retried ++;
		} else {
			console.debug(`WS closed.`);
		};
		shapeshiftEvent(ev, this.#ws, this);
		this.dispatchEvent(ev);
	};
	#onopen(ev) {
		this.#retried = 0;
		shapeshiftEvent(ev, this.#ws, this);
		this.dispatchEvent(ev);
		while (this.#queue.length) {
			this.#ws?.send(this.#queue.shift());
		};
	};
	#onmessage(ev) {
		shapeshiftEvent(ev, this.#ws, this);
		this.dispatchEvent(ev);
	};
	#onerror(ev) {
		shapeshiftEvent(ev, this.#ws, this);
		this.dispatchEvent(ev);
	};
	#start() {
		this.#ws = new WebSocket(this.#url, this.#protos);
		this.#ws.addEventListener("open", (ev) => {
			this.#onopen.call(this, ev);
		});
		this.#ws.addEventListener("message", (ev) => {
			this.#onmessage.call(this, ev);
		});
		this.#ws.addEventListener("error", (ev) => {
			this.#onerror.call(this, ev);
		});
		this.#ws.addEventListener("close", (ev) => {
			this.#onclose.call(this, ev);
		});
	};
	close(code, reason) {
		this.#closed = true;
		this.#ws?.close(code, reason);
		this.#ws = undefined;
	};
	send(data) {
		if (this.#closed || this.#ws?.readyState > 1) {
			return;
		};
		if (this.#ws?.readyState == 1) {
			this.#ws.send(data);
		} else {
			this.#queue.push(data);
		};
	};
	get binaryType() {
		return this.#ws?.binaryType;
	};
	get bufferedAmount() {
		return this.#ws?.bufferedAmount;
	};
	get extensions() {
		return this.#ws?.extensions;
	};
	get protocol() {
		return this.#ws?.protocol;
	};
	get readyState() {
		return this.#ws?.readyState;
	};
	get url() {
		return this.#ws?.url;
	};
	constructor(url, protos) {
		super();
		this.#url = url.replace("http", "ws");
		this.#protos = protos;
		this.#start();
	};
};
*/

// Sacrifice some CPU cycles for less storage
const renameMap = {
	// Post
	"account": "user",
	"application": "app",
	"content": "text",
	"created_at": "atNew", // Unix TS
	"edited_at": "atEdit", // Unix TS
	"favourites_count": "sumFav",
	"in_reply_to_account_id": "replyUser",
	"in_reply_to_id": "replyPost",
	"language": "lang",
	"media_attachments": "media",
	"mentions": "ats",
	"reblog": "boost",
	"reblogs_count": "sumBoost",
	"replies_count": "sumReply",
	"sensitive": "cwReal",
	"spoiler_text": "cwText",
	"visibility": "access",
	// User
	"followers_count": "sumFan",
	"following_count": "sumSub",
	"display_name": "dispName",
	"avatar_static": "avatarStatic",
	"header_static": "headerStatic",
	"statuses_count": "sumPost",
	"last_status_at": "atLastPost",
	"noindex": "noIndex",
	"verified_at": "atVerify", // Unix TS
	// Emoji
	"shortcode": "code",
	"static_url": "static",
	"visible_in_picker": "inPicker",
	// Poll
	"expires_at": "atExpire", // Unix TS
	"votes_count": "sumVote",
	"voters_count": "sumVoter",
	// App
	"website": "site",
	// Media
	"preview_url": "preview",
	"remote_url": "remote",
	"preview_remote_url": "previewRemote",
	"text_url": "text",
	"description": "alt"
},
eventRemap = {
	"update": "postNew",
	"status.update": "postEdit",
	"delete": "postDel"
};

// Mastodon post grab cycle
const postGrab = {
	maxAge: 259200000, // Posts are discarded if longer than 3 days
	maxCount: 100, // Grabs 100 post at most from each instance
	pageSize: 40 // Grabs this many post in each batch query attempt
};

let MastodonClient = class extends EventTarget {
	#limitTotal = 100; // How many posts should be tracked
	#expiry = 259200000; // Max TTL for 3 days
	#hookInstance = "";
	#hookClient;
	#servers = [];
	#svrRef = {};
	#userMuted = [];
	#userBanned = [];
	#userTracked = [];
	#postStore = [];
	#postRef = {}; // Refer to posts by ID (id@server)
	#launched = false;
	USER_NORMAL = 0;
	USER_NOEXEMPT = 1;
	USER_EXCLUDED = 2;
	filePath = "";
	#sorter(a, b) {
		return (b.atNew || 0) - (a.atNew || 0);
	};
	#addPost() {};
	#modPost() {};
	#delPost() {};
	#normalizer(post) {
		for (let key in post) {
			if (renameMap[key]) {
				post[renameMap[key]] = post[key];
				delete post[key];
			};
		};
		if (post.atNew) {
			post.atNew = new Date(post.atNew).getTime();
		};
		if (post.atEdit) {
			post.atEdit = new Date(post.atEdit).getTime();
		};
		if (post.atVerify) {
			post.atVerify = new Date(post.atVerify).getTime();
		};
		if (post.atExpire) {
			post.atExpire = new Date(post.atExpire).getTime();
		};
		if (post.app) {
			this.#normalizer(post.app);
		};
		if (post.user) {
			this.#normalizer(post.user);
		};
		post.media?.forEach((e) => {
			this.#normalizer(e);
		});
		post.emojis?.forEach((e) => {
			this.#normalizer(e);
		});
		post.ats?.forEach((e) => {
			this.#normalizer(e);
		});
		if (post.user) {
			post.user.fields?.forEach((e) => {
				this.#normalizer(e);
			});
		};
		if (post.poll) {
			post.poll.options?.forEach((e) => {
				this.#normalizer(e);
			});
			this.#normalizer(post.poll);
		};
		return post;
	};
	#dataProcessor(data, server) {
		this.#normalizer(data);
		if (data?.user?.username) {
			data.handle = `@${data.user.username}@${server.domain}`;
		};
		data.rid = `${data.id}@${server.domain}`;
		return data;
	};
	receiver(server, msg) {
		let targetData;
		let dispatchEvent = true;
		let timeNow = Date.now(), timeLimit = timeNow - postGrab.maxAge;
		switch (msg.event) {
			case "update":
			case "status.update": {
				// Post creation and edit
				let data = msg.payload.constructor == String ? JSON.parse(msg.payload) : msg.payload;
				this.#dataProcessor(data, server);
				if (data.atNew < timeLimit) {
					dispatchEvent = false;
					//console.debug(`MODIFY Post ${data.rid} aborted due to exceeding maxAge.`);
					break;
				};
				if (this.#postRef[data.rid]) {
					let pidx = this.#postStore.indexOf(this.#postRef[data.rid]);
					if (pidx > -1) {
						this.#postStore[pidx] = data;
						this.#postRef[data.rid] = data;
						console.debug(`MODIFY Post ${data.rid} success.`);
					} else {
						//console.error(`MODIFY Post ${data.rid} not found in postStore.`);
					};
				} else {
					//console.debug(`MODIFY Post ${data.rid} not found in postRef. Creating.`);
					this.#postStore.unshift(data);
					this.#postRef[data.rid] = data;
					console.debug(`CREATE Post ${data.rid} success.`);
				};
				targetData = data;
				break;
			};
			case "delete": {
				// Post removal
				let rid = `${msg.payload}@${server.domain}`;
				if (this.#postRef[rid]) {
					let pidx = this.#postStore.indexOf(this.#postRef[rid]);
					if (pidx > -1) {
						this.#postStore.splice(pidx, 1);
						console.debug(`DELETE Post ${rid} success (${pidx}).`);
					} else {
						console.warn(`DELETE Post ${rid} not found in postStore.`);
					};
				} else {
					console.warn(`DELETE Post ${rid} not found in postRef.`);
				};
				targetData = msg.payload;
				break;
			};
			default: {
				console.error(`Unknown message type ${msg.event} from ${server.domain}.`);
				console.error(msg);
			};
		};
		this.#postStore.sort(this.#sorter);
		if (this.#postStore.length > this.#limitTotal) {
			this.#postStore.splice(this.#limitTotal, this.#postStore.length - this.#limitTotal).forEach((e) => {
				delete this.#postRef[e.rid];
			});
		};
		if (dispatchEvent) {
			this.dispatchEvent(new MessageEvent(eventRemap[msg.event] || msg.event, {data: targetData}));
		} else {
			//console.debug(`Event dispatch aborted.`);
		};
	};
	//addServer() {};
	getPosts() {
		return this.#postStore;
	};
	getServers() {
		return this.#servers;
	};
	startFor(e) {
		e.ws = new WebSocket(`wss://${e.domain}/api/v1/streaming/`);
		e.ws.addEventListener("open", () => {
			if (e.auth) {
				e.ws.send(`{"type":"subscribe","stream":"public:local","access_token":"${e.auth || ""}"}}`);
				console.info(`Authenticated local timeline started for ${e.domain}.`);
			} else {
				e.ws.send(`{"type":"subscribe","stream":"public:local"}`);
				console.info(`Local timeline started for ${e.domain}.`);
			};
			if (e.hook) {
				e.ws.send(`{"type":"subscribe","stream":"user","access_token":"${e.auth || ""}"}`);
				console.info(`User stream started for ${e.domain}.`);
			};
		});
		e.ws.addEventListener("message", (ev) => {
			let data = JSON.parse(ev.data);
			this.receiver.call(this, e, data);
		});
		e.ws.addEventListener("close", () => {
			AbortSignal.timeout(3000).onabort = () => {
				this.startFor(e);
			};
		});
	};
	launch(streamOnly) {
		if (this.#launched) {
			//console.debug(`Already launched.`);
		} else {
			this.#servers.forEach(async (e) => {
				console.info(`Starting for ${e.domain}.`);
				console.debug(e);
				this.startFor.call(this, e);
				if (!streamOnly) {
					let opt = {
						headers: {}
					};
					if (e.auth) {
						opt.headers["Authorization"] = `Bearer ${e.auth}`;
					};
					let request = await fetch(`https://${e.domain}/api/v1/timelines/public?local=true&only_media=false&limit=${postGrab.pageSize}`, opt);
					if (request.status == 200) {
						(await request.json())?.forEach((payload) => {
							this.receiver(e, {
								event: "update",
								payload
							});
						});
					} else {
						console.error(`Post fetching for ${e.domain} failed: ${request.status} ${request.statusText}`);
						console.error(await request.json());
					};
				};
			});
			this.#launched = true;
		};
	};
	constructor({servers, serversCw, instance, serversTk, streamOnly = false, filePath = "./auth.json"}) {
		super();
		servers?.forEach((e) => {
			let server = {
				domain: e,
				ws: undefined,
				cw: false,
				hook: e == instance,
				auth: false
			};
			this.#svrRef[e] = this.#servers.length;
			this.#servers.push(server);
		});
		serversCw?.forEach((e) => {
			let server = {
				domain: e,
				ws: undefined,
				cw: true,
				hook: e == instance,
				auth: false
			};
			this.#svrRef[e] = this.#servers.length;
			this.#servers.push(server);
		});
		serversTk?.forEach((e) => {
			this.#servers[this.#svrRef[e[0]]].auth = e[1];
		});
		this.#hookInstance = instance;
		this.launch(streamOnly);
	};
};

export {
	MastodonClient
};
