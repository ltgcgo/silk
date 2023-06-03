"use strict";
(() => {
  // libs/denoServe/server.js
  function deferred() {
    let methods, state = "pending", promise = new Promise((resolve, reject) => {
      methods = {
        async resolve(value) {
          await value, state = "fulfilled", resolve(value);
        },
        reject(reason) {
          state = "rejected", reject(reason);
        }
      };
    });
    return Object.defineProperty(promise, "state", {
      get: () => state
    }), Object.assign(promise, methods);
  }
  function delay(ms, options = {}) {
    let { signal, persistent } = options;
    return signal?.aborted ? Promise.reject(new DOMException("Delay was aborted.", "AbortError")) : new Promise((resolve, reject) => {
      let abort = () => {
        clearTimeout(i), reject(new DOMException("Delay was aborted.", "AbortError"));
      }, i = setTimeout(() => {
        signal?.removeEventListener("abort", abort), resolve();
      }, ms);
      if (signal?.addEventListener("abort", abort, {
        once: !0
      }), persistent === !1)
        try {
          Deno.unrefTimer(i);
        } catch (error) {
          if (!(error instanceof ReferenceError))
            throw error;
          console.error("`persistent` option is only available in Deno");
        }
    });
  }
  var MuxAsyncIterator = class {
    #iteratorCount = 0;
    #yields = [];
    #throws = [];
    #signal = deferred();
    add(iterable) {
      ++this.#iteratorCount, this.#callIteratorNext(iterable[Symbol.asyncIterator]());
    }
    async #callIteratorNext(iterator) {
      try {
        let { value, done } = await iterator.next();
        done ? --this.#iteratorCount : this.#yields.push({
          iterator,
          value
        });
      } catch (e) {
        this.#throws.push(e);
      }
      this.#signal.resolve();
    }
    async *iterate() {
      for (; this.#iteratorCount > 0; ) {
        await this.#signal;
        for (let i = 0; i < this.#yields.length; i++) {
          let { iterator, value } = this.#yields[i];
          yield value, this.#callIteratorNext(iterator);
        }
        if (this.#throws.length) {
          for (let e of this.#throws)
            throw e;
          this.#throws.length = 0;
        }
        this.#yields.length = 0, this.#signal = deferred();
      }
    }
    [Symbol.asyncIterator]() {
      return this.iterate();
    }
  }, ERROR_SERVER_CLOSED = "Server closed", INITIAL_ACCEPT_BACKOFF_DELAY = 5, MAX_ACCEPT_BACKOFF_DELAY = 1e3, Server = class {
    #port;
    #host;
    #handler;
    #closed = !1;
    #listeners = /* @__PURE__ */ new Set();
    #acceptBackoffDelayAbortController = new AbortController();
    #httpConnections = /* @__PURE__ */ new Set();
    #onError;
    constructor(serverInit) {
      this.#port = serverInit.port, this.#host = serverInit.hostname, this.#handler = serverInit.handler, this.#onError = serverInit.onError ?? function(error) {
        return console.error(error), new Response("Internal Server Error", {
          status: 500
        });
      };
    }
    async serve(listener) {
      if (this.#closed)
        throw new Deno.errors.Http(ERROR_SERVER_CLOSED);
      this.#trackListener(listener);
      try {
        return await this.#accept(listener);
      } finally {
        this.#untrackListener(listener);
        try {
          listener.close();
        } catch {
        }
      }
    }
    async listenAndServe() {
      if (this.#closed)
        throw new Deno.errors.Http(ERROR_SERVER_CLOSED);
      let listener = Deno.listen({
        port: this.#port ?? 80,
        hostname: this.#host ?? "0.0.0.0",
        transport: "tcp"
      });
      return await this.serve(listener);
    }
    async listenAndServeTls(certFile, keyFile) {
      if (this.#closed)
        throw new Deno.errors.Http(ERROR_SERVER_CLOSED);
      let listener = Deno.listenTls({
        port: this.#port ?? 443,
        hostname: this.#host ?? "0.0.0.0",
        certFile,
        keyFile,
        transport: "tcp"
      });
      return await this.serve(listener);
    }
    close() {
      if (this.#closed)
        throw new Deno.errors.Http(ERROR_SERVER_CLOSED);
      this.#closed = !0;
      for (let listener of this.#listeners)
        try {
          listener.close();
        } catch {
        }
      this.#listeners.clear(), this.#acceptBackoffDelayAbortController.abort();
      for (let httpConn of this.#httpConnections)
        this.#closeHttpConn(httpConn);
      this.#httpConnections.clear();
    }
    get closed() {
      return this.#closed;
    }
    get addrs() {
      return Array.from(this.#listeners).map((listener) => listener.addr);
    }
    async #respond(requestEvent, connInfo) {
      let response;
      try {
        if (response = await this.#handler(requestEvent.request, connInfo), response.bodyUsed && response.body !== null)
          throw new TypeError("Response body already consumed.");
      } catch (error) {
        response = await this.#onError(error);
      }
      try {
        await requestEvent.respondWith(response);
      } catch {
      }
    }
    async #serveHttp(httpConn, connInfo1) {
      for (; !this.#closed; ) {
        let requestEvent1;
        try {
          requestEvent1 = await httpConn.nextRequest();
        } catch {
          break;
        }
        if (requestEvent1 === null)
          break;
        this.#respond(requestEvent1, connInfo1);
      }
      this.#closeHttpConn(httpConn);
    }
    async #accept(listener) {
      let acceptBackoffDelay;
      for (; !this.#closed; ) {
        let conn;
        try {
          conn = await listener.accept();
        } catch (error1) {
          if (error1 instanceof Deno.errors.BadResource || error1 instanceof Deno.errors.InvalidData || error1 instanceof Deno.errors.UnexpectedEof || error1 instanceof Deno.errors.ConnectionReset || error1 instanceof Deno.errors.NotConnected) {
            acceptBackoffDelay ? acceptBackoffDelay *= 2 : acceptBackoffDelay = INITIAL_ACCEPT_BACKOFF_DELAY, acceptBackoffDelay >= 1e3 && (acceptBackoffDelay = MAX_ACCEPT_BACKOFF_DELAY);
            try {
              await delay(acceptBackoffDelay, {
                signal: this.#acceptBackoffDelayAbortController.signal
              });
            } catch (err) {
              if (!(err instanceof DOMException && err.name === "AbortError"))
                throw err;
            }
            continue;
          }
          throw error1;
        }
        acceptBackoffDelay = void 0;
        let httpConn1;
        try {
          httpConn1 = Deno.serveHttp(conn);
        } catch {
          continue;
        }
        this.#trackHttpConnection(httpConn1);
        let connInfo2 = {
          localAddr: conn.localAddr,
          remoteAddr: conn.remoteAddr
        };
        this.#serveHttp(httpConn1, connInfo2);
      }
    }
    #closeHttpConn(httpConn2) {
      this.#untrackHttpConnection(httpConn2);
      try {
        httpConn2.close();
      } catch {
      }
    }
    #trackListener(listener1) {
      this.#listeners.add(listener1);
    }
    #untrackListener(listener2) {
      this.#listeners.delete(listener2);
    }
    #trackHttpConnection(httpConn3) {
      this.#httpConnections.add(httpConn3);
    }
    #untrackHttpConnection(httpConn4) {
      this.#httpConnections.delete(httpConn4);
    }
  };
  function hostnameForDisplay(hostname) {
    return hostname === "0.0.0.0" ? "localhost" : hostname;
  }
  async function serve(handler, options = {}) {
    let port = options.port ?? 8e3, hostname = options.hostname ?? "0.0.0.0", server = new Server({
      port,
      hostname,
      handler,
      onError: options.onError
    });
    options?.signal?.addEventListener("abort", () => server.close(), {
      once: !0
    });
    let s = server.listenAndServe();
    return port = server.addrs[0].port, "onListen" in options ? options.onListen?.({
      port,
      hostname
    }) : console.log(`Listening on http://${hostnameForDisplay(hostname)}:${port}/`), await s;
  }

  // src/deno/wingblade.js
  var WingBlade2 = {
    args: Deno.args,
    os: Deno.build.os,
    variant: "Deno",
    version: Deno.version.deno,
    persist: !0,
    exit: (code = 0) => {
      Deno.exit(code);
    },
    getEnv: (key, fallbackValue) => Deno.env.get(key) || fallbackValue,
    memUsed: () => Deno.memoryUsage(),
    randomInt: (cap) => Math.floor(Math.random() * cap),
    readFile: async function(path, opt) {
      return await Deno.readFile(path, opt);
    },
    serve: (handler, opt = {}) => (opt?.onListen || (opt.onListen = function({ port, hostname }) {
      console.error(`WingBlade serving at http://${hostname}:${port}`);
    }), opt?.hostname || (opt.hostname = "127.0.0.1"), opt?.port || (opt.port = 8e3), serve(handler, opt)),
    setEnv: (key, value) => Deno.env.set(key, value),
    sleep: function(ms, maxAdd = 0) {
      return new Promise((y, n) => {
        AbortSignal.timeout(ms + Math.floor(maxAdd * Math.random())).addEventListener("abort", () => {
          y();
        });
      });
    },
    upgradeWebSocket(req, opt) {
      return Deno.upgradeWebSocket(req, opt);
    },
    writeFile: async function(path, data, opt) {
      await Deno.writeFile(path, data, opt);
    }
  };

  // src/mastodon/index.mjs
  var shapeshiftProps = "currentTarget,explicitOriginalTarget,originalTarget,srcElement,target".split(",");
  var renameMap = {
    // Post
    account: "user",
    application: "app",
    content: "text",
    created_at: "atNew",
    // Unix TS
    edited_at: "atEdit",
    // Unix TS
    favourites_count: "sumFav",
    in_reply_to_account_id: "replyUser",
    in_reply_to_id: "replyPost",
    language: "lang",
    media_attachments: "media",
    mentions: "ats",
    reblog: "boost",
    reblogs_count: "sumBoost",
    replies_count: "sumReply",
    sensitive: "cwReal",
    spoiler_text: "cwText",
    visibility: "access",
    // User
    followers_count: "sumFan",
    following_count: "sumSub",
    display_name: "dispName",
    avatar_static: "avatarStatic",
    header_static: "headerStatic",
    statuses_count: "sumPost",
    last_status_at: "atLastPost",
    noindex: "noIndex",
    verified_at: "atVerify",
    // Unix TS
    // Emoji
    shortcode: "code",
    static_url: "static",
    visible_in_picker: "inPicker",
    // Poll
    expires_at: "atExpire",
    // Unix TS
    votes_count: "sumVote",
    voters_count: "sumVoter",
    // App
    website: "site",
    // Media
    preview_url: "preview",
    remote_url: "remote",
    preview_remote_url: "previewRemote",
    text_url: "text",
    description: "alt"
  }, eventRemap = {
    update: "postNew",
    "status.update": "postEdit",
    delete: "postDel"
  }, postGrab = {
    maxAge: 2592e5,
    // Posts are discarded if longer than 3 days
    maxCount: 100,
    // Grabs 100 post at most from each instance
    pageSize: 40
    // Grabs this many post in each batch query attempt
  }, MastodonClient = class extends EventTarget {
    #limitTotal = 100;
    // How many posts should be tracked
    #expiry = 2592e5;
    // Max TTL for 3 days
    #hookInstance = "";
    #hookClient;
    #servers = [];
    #svrRef = {};
    #userMuted = [];
    #userBanned = [];
    #userTracked = [];
    #postStore = [];
    #postRef = {};
    // Refer to posts by ID (id@server)
    #launched = !1;
    USER_NORMAL = 0;
    USER_NOEXEMPT = 1;
    USER_EXCLUDED = 2;
    filePath = "";
    #sorter(a, b) {
      return (b.atNew || 0) - (a.atNew || 0);
    }
    #addPost() {
    }
    #modPost() {
    }
    #delPost() {
    }
    #normalizer(post) {
      for (let key in post)
        renameMap[key] && (post[renameMap[key]] = post[key], delete post[key]);
      return post.atNew && (post.atNew = new Date(post.atNew).getTime()), post.atEdit && (post.atEdit = new Date(post.atEdit).getTime()), post.atVerify && (post.atVerify = new Date(post.atVerify).getTime()), post.atExpire && (post.atExpire = new Date(post.atExpire).getTime()), post.app && this.#normalizer(post.app), post.user && this.#normalizer(post.user), post.media?.forEach((e) => {
        this.#normalizer(e);
      }), post.emojis?.forEach((e) => {
        this.#normalizer(e);
      }), post.ats?.forEach((e) => {
        this.#normalizer(e);
      }), post.user && post.user.fields?.forEach((e) => {
        this.#normalizer(e);
      }), post.poll && (post.poll.options?.forEach((e) => {
        this.#normalizer(e);
      }), this.#normalizer(post.poll)), post;
    }
    #dataProcessor(data, server) {
      return this.#normalizer(data), data?.user?.username && (data.handle = `@${data.user.username}@${server.domain}`), data.rid = `${data.id}@${server.domain}`, data;
    }
    receiver(server, msg) {
      let targetData, dispatchEvent = !0, timeNow = Date.now(), timeLimit = timeNow - postGrab.maxAge;
      switch (msg.event) {
        case "update":
        case "status.update": {
          let data = msg.payload.constructor == String ? JSON.parse(msg.payload) : msg.payload;
          if (this.#dataProcessor(data, server), data.atNew < timeLimit) {
            dispatchEvent = !1;
            break;
          }
          if (this.#postRef[data.rid]) {
            let pidx = this.#postStore.indexOf(this.#postRef[data.rid]);
            pidx > -1 && (this.#postStore[pidx] = data, this.#postRef[data.rid] = data, console.debug(`MODIFY Post ${data.rid} success.`));
          } else
            this.#postStore.unshift(data), this.#postRef[data.rid] = data, console.debug(`CREATE Post ${data.rid} success.`);
          targetData = data;
          break;
        }
        case "delete": {
          let rid = `${msg.payload}@${server.domain}`;
          if (this.#postRef[rid]) {
            let pidx = this.#postStore.indexOf(this.#postRef[rid]);
            pidx > -1 ? (this.#postStore.splice(pidx, 1), console.debug(`DELETE Post ${rid} success (${pidx}).`)) : console.warn(`DELETE Post ${rid} not found in postStore.`);
          } else
            console.warn(`DELETE Post ${rid} not found in postRef.`);
          targetData = msg.payload;
          break;
        }
        default:
          console.error(`Unknown message type ${msg.event} from ${server.domain}.`), console.error(msg);
      }
      this.#postStore.sort(this.#sorter), this.#postStore.length > this.#limitTotal && this.#postStore.splice(this.#limitTotal, this.#postStore.length - this.#limitTotal).forEach((e) => {
        delete this.#postRef[e.rid];
      }), dispatchEvent && this.dispatchEvent(new MessageEvent(eventRemap[msg.event] || msg.event, { data: targetData }));
    }
    //addServer() {};
    getPosts() {
      return this.#postStore;
    }
    getServers() {
      return this.#servers;
    }
    startFor(e) {
      e.ws = new WebSocket(`wss://${e.domain}/api/v1/streaming/`), e.ws.addEventListener("open", () => {
        e.auth ? (e.ws.send(`{"type":"subscribe","stream":"public:local","access_token":"${e.auth || ""}"}}`), console.info(`Authenticated local timeline started for ${e.domain}.`)) : (e.ws.send('{"type":"subscribe","stream":"public:local"}'), console.info(`Local timeline started for ${e.domain}.`)), e.hook && (e.ws.send(`{"type":"subscribe","stream":"user","access_token":"${e.auth || ""}"}`), console.info(`User stream started for ${e.domain}.`));
      }), e.ws.addEventListener("message", (ev) => {
        let data = JSON.parse(ev.data);
        this.receiver.call(this, e, data);
      }), e.ws.addEventListener("close", () => {
        AbortSignal.timeout(3e3).onabort = () => {
          this.startFor(e);
        };
      });
    }
    launch(streamOnly) {
      this.#launched || (this.#servers.forEach(async (e) => {
        if (console.info(`Starting for ${e.domain}.`), this.startFor.call(this, e), !streamOnly) {
          let opt = {
            headers: {}
          };
          e.auth && (opt.headers.Authorization = `Bearer ${e.auth}`);
          let request = await fetch(`https://${e.domain}/api/v1/timelines/public?local=true&only_media=false&limit=${postGrab.pageSize}`, opt);
          request.status == 200 ? (await request.json())?.forEach((payload) => {
            this.receiver(e, {
              event: "update",
              payload
            });
          }) : console.error(`Post fetching for ${e.domain} failed: ${request.status} ${request.statusText}`);
        }
      }), this.#launched = !0);
    }
    constructor({ servers, serversCw, instance, serversTk, streamOnly = !1, filePath = "./auth.json" }) {
      super(), servers?.forEach((e) => {
        let server = {
          domain: e,
          ws: void 0,
          cw: !1,
          hook: e == instance,
          auth: !1
        };
        this.#svrRef[e] = this.#servers.length, this.#servers.push(server);
      }), serversCw?.forEach((e) => {
        let server = {
          domain: e,
          ws: void 0,
          cw: !0,
          hook: e == instance,
          auth: !1
        };
        this.#svrRef[e] = this.#servers.length, this.#servers.push(server);
      }), serversTk?.forEach((e) => {
        this.#servers[this.#svrRef[e[0]]].auth = !0;
      }), this.#hookInstance = instance, this.launch(streamOnly);
    }
  };

  // src/core/index.js
  var utf8Enc = new TextEncoder("utf-8"), main = async function(args) {
    let serverImpl = `Silk@${WingBlade.variant}`;
    switch (console.debug(`${serverImpl} - Better Together`), args[0] || "serve") {
      case "login": {
        console.error("Deprecated."), WingBlade.exit(0);
        break;
      }
      case "serve": {
        console.error("Starting the Silk server!");
        let listServers = WingBlade.getEnv("LIST_SERVER")?.split(",") || [], listServersCw = WingBlade.getEnv("LIST_SERVER_CW")?.split(",") || [], listServersTk = WingBlade.getEnv("LIST_SERVER_TK")?.split(",") || [], hookServer = WingBlade.getEnv("HOOK_SERVER"), streamOnly = WingBlade.getEnv("NO_BATCH_REQUEST", "0") == "1";
        hookServer || console.error("Hook server not defined!"), listServersTk.forEach((e, i, a) => {
          let splitAt = e.indexOf("=");
          splitAt > -1 && (a[i] = [e.slice(0, splitAt), e.slice(splitAt + 1)]);
        });
        let mastoConf = {
          servers: listServers,
          serversCw: listServersCw,
          serversTk: listServersTk,
          instance: hookServer,
          streamOnly
        };
        console.info(mastoConf);
        let mastoClient = new MastodonClient(mastoConf), batchCache = utf8Enc.encode("[]"), activeClients = [];
        mastoClient.addEventListener("postNew", async ({ data }) => {
          let runCache = `{"event":"set","data":${JSON.stringify(data)}}`;
          activeClients.forEach(async (e) => {
            e.send(runCache);
          }), batchCache = utf8Enc.encode(JSON.stringify(mastoClient.getPosts()));
        }), mastoClient.addEventListener("postEdit", async ({ data }) => {
          let runCache = `{"event":"set","data":${JSON.stringify(data)}}`;
          activeClients.forEach(async (e) => {
            e.send(runCache);
          }), batchCache = utf8Enc.encode(JSON.stringify(mastoClient.getPosts()));
        }), mastoClient.addEventListener("postDel", async ({ data }) => {
          let runCache = `{"event":"set","data":${JSON.stringify(data)}}`;
          activeClients.forEach(async (e) => {
            e.send(runCache);
          }), batchCache = utf8Enc.encode(JSON.stringify(mastoClient.getPosts()));
        }), WingBlade.serve((request) => {
          let url = new URL(request.url);
          switch (request.method?.toLowerCase()) {
            case "get": {
              switch (url.pathname) {
                case "/nr/silk/servers": {
                  let det = [];
                  return mastoClient.getServers().forEach(({ domain, cw, ws }) => {
                    det.push({ domain, cw, active: ws.readyState == 1 });
                  }), new Response(JSON.stringify(det), {
                    status: 200,
                    headers: {
                      "content-type": "application/json",
                      server: serverImpl
                    }
                  });
                  break;
                }
                case "/nr/silk/timeline":
                case "/nr/silk/timeline/":
                  return new Response(batchCache, {
                    status: 200,
                    headers: {
                      "content-type": "application/json",
                      server: serverImpl
                    }
                  });
                case "/rt/silk/timeline":
                case "/rt/silk/timeline/": {
                  if (request.headers.get("upgrade") == "websocket") {
                    let { socket, response } = WingBlade.upgradeWebSocket(request);
                    return socket.addEventListener("open", () => {
                      socket.send('{"event":"ack"}'), activeClients.push(socket);
                    }), socket.addEventListener("close", () => {
                      let index = activeClients.indexOf(socket);
                      index > -1 && activeClients.splice(index, 1);
                    }), response;
                  } else
                    return new Response("SSE isn't supported yet.", {
                      status: 400,
                      server: serverImpl
                    });
                  break;
                }
                default:
                  return new Response(`Endpoint ${url.pathname} not found.`, {
                    status: 404,
                    server: serverImpl
                  });
              }
              break;
            }
            default:
              return new Response("Method disallowed.", {
                status: 405,
                server: serverImpl
              });
          }
        });
        break;
      }
      default:
        console.error(`Unknown subcommand "${args.join(" ")}"`);
    }
  };

  // src/deno/index.js
  self.WingBlade = WingBlade2;
  main(WingBlade2.args);
})();
