"use strict";import{WebSocket,WebSocketServer as WebSocketService}from"ws";import{fetch,Request,Response}from"undici";import os from"node:os";import fs from"node:fs";import http from"node:http";import crypto from"node:crypto";
if(!globalThis.self){globalThis.self=globalThis};
"use strict";
(() => {
  // src/node/wingblade.js
  var WebSocketServer = class {
    #attached;
    #url;
    #closed = !1;
    #dataQueue = [];
    #events = {
      open: [],
      message: [],
      error: [],
      close: []
    };
    addEventListener(type, handler) {
      this.#attached ? type != "open" ? this.#attached.addEventListener(type, handler) : handler(new Event("open")) : this.#events[type].push(handler);
    }
    get binaryType() {
      return this.#attached?.binaryType || "";
    }
    get bufferedAmount() {
      return this.#attached?.bufferedAmount || 0;
    }
    get extensions() {
      return this.#attached?.extensions || "";
    }
    get readyState() {
      return this.#attached?.readyState || 0;
    }
    get url() {
      return this.#attached?.url || this.#url;
    }
    attach(wsService) {
      if (this.#closed)
        return !1;
      if (this.#attached)
        throw new Error("Already attached a WebSocket object");
      this.#attached = wsService;
      let upThis = this;
      switch (wsService.readyState) {
        case 0:
        case 1: {
          for (let type in this.#events)
            this.#events[type].forEach((e) => {
              wsService.addEventListener(type, e);
            });
          let openEvent = new Event("open");
          this.#events.open.forEach((e) => {
            e(openEvent);
          });
          break;
        }
        case 2:
        case 3: {
          upThis.dispatchEvent(new Event("close"));
          break;
        }
      }
    }
    close(...args) {
      return this.#closed = !0, this.#attached?.close(...args);
    }
    send(data) {
      this.#attached ? this.#attached.send(data) : this.#dataQueue.push(data);
    }
    constructor(request) {
      this.#url = request.url.replace("http", "ws"), this.addEventListener("open", (ev) => {
        for (; this.#dataQueue.length > 0; )
          this.#attached.send(this.#dataQueue.shift());
      });
    }
  }, WingBlade2 = {
    args: process.argv.slice(2),
    os: os.platform(),
    variant: "Node",
    version: process.version.replace("v", ""),
    persist: !0,
    exit: (code = 0) => {
      process.exit(code);
    },
    getEnv: (key, fallbackValue) => process.env[key] || fallbackValue,
    memUsed: () => process.memoryUsage(),
    randomInt: (cap) => Math.floor(Math.random() * cap),
    readFile: async function(path, opt) {
      return new Uint8Array((await fs.promises.readFile(path, opt)).buffer);
    },
    serve: (handler, opt = {}) => {
      let port = opt.port || 8e3, hostname = opt.hostname || "127.0.0.1", server = http.createServer(async function(requester, responder) {
        let readStreamController, bodyStream = new ReadableStream({
          type: "bytes",
          start: (controller) => {
            readStreamController = controller;
          },
          cancel: (reason) => {
          },
          autoAllocateChunkSize: 65536
        }), reqOpt = {
          method: requester.method,
          headers: requester.headers
        }, bodyUsed = ["GET", "HEAD"].indexOf(reqOpt.method) == -1;
        requester.on("data", (chunk) => {
          readStreamController.enqueue(chunk);
        }).on("end", () => {
          readStreamController.close();
        }), bodyUsed && (reqOpt.body = bodyStream, reqOpt.duplex = "half");
        let request = new Request(`${requester.headers["x-forwarded-proto"] || "http"}://${requester.headers.host}${requester.url}`, reqOpt), response = await handler(request);
        response?.headers?.forEach((v, k) => {
          responder.setHeader(k, v);
        }), responder.statusCode = response?.status || 200, response?.statusText && (responder.statusMessage = response.statusText), responder.flushHeaders();
        let repBodyStream = response.body.getReader(), repBodyFlowing = !0;
        for (; repBodyFlowing; )
          await repBodyStream.read().then(({ done, value }) => {
            done ? (responder.end(), repBodyFlowing = !1) : responder.write(value);
          });
      });
      return server.on("upgrade", async (requester, socket, head) => {
        let reqOpt = {
          method: requester.method,
          headers: requester.headers
        }, request = new Request(`${requester.headers["x-forwarded-proto"] || "http"}://${requester.headers.host}${requester.url}`, reqOpt);
        request.raw = {
          requester,
          socket,
          head
        }, await handler(request);
      }), server.listen(port, hostname, () => {
        (opt.onListen || function({ port: port2, hostname: hostname2 }) {
          console.error(`WingBlade serving at http://${hostname2}:${port2}`);
        })({ port, hostname });
      }), server;
    },
    setEnv: (key, value) => {
      process.env[key] = value;
    },
    sleep: function(ms, maxAdd = 0) {
      return new Promise((y, n) => {
        setTimeout(y, ms + Math.floor(maxAdd * Math.random()));
      });
    },
    upgradeWebSocket: (req) => {
      let wsUpgrader = new WebSocketService({ noServer: !0 }), wsServer = new WebSocketServer(req);
      return wsUpgrader.handleUpgrade(req.raw.requester, req.raw.socket, req.raw.head, function(ws) {
        wsServer.attach(ws);
      }), {
        socket: wsServer,
        response: new Response(null, {
          status: 200
        })
      };
    },
    writeFile: async function(path, data, opt = {}) {
      let newOpt = {
        flag: "w"
      };
      opt.append && (newOpt.flag = "a"), opt.signal && (newOpt.signal = opt.signal), opt.mode && (newOpt.mode = opt.mode), await fs.promises.writeFile(path, data, newOpt);
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

  // src/node/index.js
  self.WingBlade = WingBlade2;
  main(WingBlade2.args);
})();
