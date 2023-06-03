"use strict";
(() => {
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
})();
