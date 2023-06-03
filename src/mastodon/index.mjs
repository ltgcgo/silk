"use strict";

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
};
let MastodonClient = class extends EventTarget {
	#limitServer = 40; // Max returned posts
	#limitTotal = 80; // How many posts should be tracked
	#expiry = 259200000; // Max TTL for 3 days
	#hookInstance = "";
	#hookAuthToken = "";
	#hookClient;
	#servers = [];
	#svrRef = {};
	#userMuted = [];
	#userBanned = [];
	#userTracked = [];
	#postStore = [];
	#postRef = {}; // Refer to posts by ID (id@server)
	USER_NORMAL = 0;
	USER_NOEXEMPT = 1;
	USER_EXCLUDED = 2;
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
		switch (msg.event) {
			case "update": {
				// Post creation
				let data = msg.payload.constructor == String ? JSON.parse(msg.payload) : msg.payload;
				this.#dataProcessor(data, server);
				this.#postStore.unshift(data);
				this.#postRef[data.rid] = data;
				console.error(`CREATE Post ${data.rid} success.`);
				this.dispatchEvent(new MessageEvent("postnew", {data}));
				break;
			};
			case "status.update": {
				// Post edit
				let data = JSON.parse(msg.payload);
				this.#dataProcessor(data, server);
				if (this.#postRef[data.rid]) {
					let pidx = this.#postStore.indexOf(this.#postRef[data.rid]);
					if (pidx > -1) {
						this.#postStore[pidx] = data;
						this.#postRef[data.rid] = data;
						console.error(`MODIFY Post ${data.rid} success.`);
					} else {
						console.error(`MODIFY Post ${data.rid} not found in postStore.`);
					};
				} else {
					console.error(`MODIFY Post ${data.rid} not found in postRef.`);
				};
				this.dispatchEvent(new MessageEvent("postedit", {data}));
				break;
			};
			case "delete": {
				// Post removal
				let rid = `${msg.payload}@${server.domain}`;
				if (this.#postRef[rid]) {
					let pidx = this.#postStore.indexOf(this.#postRef[rid]);
					if (pidx > -1) {
						this.#postStore.splice(pidx, 1);
						console.error(`DELETE Post ${rid} success.`);
					} else {
						console.error(`DELETE Post ${rid} not found in postStore.`);
					};
				} else {
					console.error(`DELETE Post ${rid} not found in postRef.`);
				};
				break;
			};
			default: {
				console.error(`Unknown message type ${msg.event}.`);
			};
		};
		this.#postStore.sort(this.#sorter);
		if (this.#postStore.length > this.#limitTotal) {
			this.#postStore.splice(this.#limitTotal, this.#postStore.length - this.#limitTotal).forEach((e) => {
				delete this.#postRef[e.rid];
			});
		};
	};
	//addServer() {};
	getPosts() {
		return this.#postStore;
	};
	startFor(e) {
		e.ws = new WebSocket(`wss://${e.domain}/api/v1/streaming/`);
		e.ws.addEventListener("open", () => {
			e.ws.send(`{"type":"subscribe","stream":"public:local"}`);
			if (e.domain == this.#hookInstance) {
				e.ws.send(`{"type":"subscribe","stream":"user","access_token":"${this.#hookAuthToken}"}`);
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
		console.info(`Started for ${e.domain}.`);
	};
	launch(streamOnly) {
		this.#servers.forEach(async (e) => {
			console.info(`Starting for ${e.domain}.`);
			this.startFor.call(this, e);
			if (!streamOnly) {
				let opt = {
					headers: {}
				};
				if (e.auth) {
					opt.headers["Authorization"] = `Bearer ${e.auth}`;
				};
				(await (await fetch(`https://${e.domain}/api/v1/timelines/public?local=1&limit=${this.#limitServer}`)).json())?.forEach((payload) => {
					this.receiver(e, {
						event: "update",
						payload
					});
				});
			};
		});
	};
	constructor({servers, serversCw, instance, accessToken, serversTk, streamOnly = false}) {
		super();
		servers?.forEach((e) => {
			let server = {
				domain: e,
				ws: undefined,
				cw: false
			};
			this.#svrRef[e] = this.#servers.length;
			this.#servers.push(server);
		});
		serversCw?.forEach((e) => {
			let server = {
				domain: e,
				ws: undefined,
				cw: true
			};
			this.#svrRef[e] = this.#servers.length;
			this.#servers.push(server);
		});
		serversTk?.forEach((e) => {
			this.#servers[this.#svrRef[e[0]]].auth = e[1];
		});
		this.#hookInstance = instance;
		this.#hookAuthToken = accessToken;
		this.launch(streamOnly);
	};
};

export {
	MastodonClient
};
