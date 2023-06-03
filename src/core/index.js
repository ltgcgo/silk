"use strict";

import {MastodonClient} from "../mastodon/index.mjs";

let utf8Enc = new TextEncoder("utf-8");

let main = async function (args) {
	let serverImpl = `Silk@${WingBlade.variant}`;
	console.debug(`${serverImpl} - Better Together`);
	switch (args[0] || "serve") {
		case "login": {
			console.error(`Deprecated.`);
			WingBlade.exit(0);
			/*let instance = args[1];
			if (!instance) {
				console.error("Target instance not defined!");
				WingBlade.exit(1);
			};
			console.error(`Trying to log into ${instance}.`)
			console.error(`Obtaining app token...`);
			let appDetails = new FormData();
			appDetails.set("client_name", "Lightingale Silk");
			appDetails.set("redirect_uris", "http://127.0.0.1:19810/");
			appDetails.set("website", "https://mlp.ltgc.cc/silk/");
			appDetails.set("scopes", "read write")
			let appToken = await (await fetch(`https://${instance}/api/v1/apps`, {
				method: "post",
				body: appDetails
			})).json();
			console.error(`Registered Silk as app ${appToken.id}.`);
			console.info(`Client ID: ${appToken.client_id}`);
			console.info(`Client Secret: ${appToken.client_secret}`);
			console.info(`VAPID Key: ${appToken.vapid_key}`);
			WingBlade.serve(async (request) => {
				let url = new URL(request.url);
				if (url.search.indexOf("?code=") == 0) {
					let authToken = url.search.slice(6);
					console.info(`Auth token: ${authToken}`);
					let response = await fetch(`https://${instance}/api/v1/apps/verify_credentials`, {
						headers: {
							"Authorization": `Bearer ${authToken}`
						}
					});
					console.info(`Token status: ${response.status} ${response.statusText}`);
					if (response.status == 200) {
						console.info(await response.json());
					};
					WingBlade.sleep(1000).then(() => {
						console.error(`Login success.`);
						WingBlade.exit(0);
					});
				} else {
					console.info(`Unknown request.`);
				};
				return new Response("OK");
			}, {
				onListen: () => {
					console.error(`Open https://${instance}/oauth/authorize?response_type=code&client_id=${appToken.client_id}&scope=read+write&redirect_uri=${encodeURIComponent("http://127.0.0.1:19810/")}`);
				},
				port: 19810
			});*/
			break;
		};
		case "serve": {
			console.error(`Starting the Silk server!`);
			// Load configs
			let listServers = WingBlade.getEnv("LIST_SERVER")?.split(",") || [];
			let listServersCw = WingBlade.getEnv("LIST_SERVER_CW")?.split(",") || [];
			let listServersTk = WingBlade.getEnv("LIST_SERVER_TK")?.split(",") || [];
			let hookServer = WingBlade.getEnv("HOOK_SERVER");
			let streamOnly = WingBlade.getEnv("NO_BATCH_REQUEST", "0") == "1";
			// Test configs
			if (!hookServer) {
				console.error("Hook server not defined!");
			};
			// Format configs
			listServersTk.forEach((e, i, a) => {
				let splitAt = e.indexOf("=");
				if (splitAt > -1) {
					a[i] = [e.slice(0, splitAt), e.slice(splitAt + 1)];
				};
			});
			// Start Mastodon client
			let mastoConf = {
				servers: listServers,
				serversCw: listServersCw,
				serversTk: listServersTk,
				instance: hookServer,
				streamOnly,
			};
			console.info(mastoConf);
			let mastoClient = new MastodonClient(mastoConf);
			let batchCache = utf8Enc.encode(`[]`);
			let activeClients = [];
			mastoClient.addEventListener("postNew", async ({data}) => {
				let runCache = `{"event":"set","data":${JSON.stringify(data)}}`;
				activeClients.forEach(async (e) => {
					e.send(runCache);
				});
				batchCache = utf8Enc.encode(JSON.stringify(mastoClient.getPosts()));
				//console.debug(`Cache built for post creation.`);
			});
			mastoClient.addEventListener("postEdit", async ({data}) => {
				let runCache = `{"event":"set","data":${JSON.stringify(data)}}`;
				activeClients.forEach(async (e) => {
					e.send(runCache);
				});
				batchCache = utf8Enc.encode(JSON.stringify(mastoClient.getPosts()));
				//console.debug(`Cache built for post modification.`);
			});
			mastoClient.addEventListener("postDel", async ({data}) => {
				let runCache = `{"event":"delete","data":${JSON.stringify(data)}}`;
				activeClients.forEach(async (e) => {
					e.send(runCache);
				});
				batchCache = utf8Enc.encode(JSON.stringify(mastoClient.getPosts()));
				//console.debug(`Cache built for post removal.`);
			});
			WingBlade.serve((request) => {
				let url = new URL(request.url);
				switch (request.method?.toLowerCase()) {
					case "get": {
						switch (url.pathname) {
							case "/nr/silk/servers" : {
								let det = [];
								mastoClient.getServers().forEach(({domain, cw, ws}) => {
									det.push({domain, cw, active: ws.readyState == 1});
								});
								return new Response(JSON.stringify(det), {
									status: 200,
									headers: {
										"content-type": "application/json",
										"server": serverImpl
									}
								});
								break;
							};
							case "/nr/silk/timeline":
							case "/nr/silk/timeline/": {
								return new Response(batchCache, {
									status: 200,
									headers: {
										"content-type": "application/json",
										"server": serverImpl
									}
								});
								break;
							};
							case "/rt/silk/timeline":
							case "/rt/silk/timeline/": {
								if (request.headers.get("upgrade") == "websocket") {
									let {socket, response} = WingBlade.upgradeWebSocket(request);
									socket.addEventListener("open", () => {
										socket.send(`{"event":"ack"}`);
										activeClients.push(socket);
									});
									socket.addEventListener("close", () => {
										let index = activeClients.indexOf(socket);
										if (index > -1) {
											activeClients.splice(index, 1);
										};
									});
									return response;
								} else {
									return new Response(`SSE isn't supported yet.`, {
										status: 400,
										"server": serverImpl
									});
								};
								break;
							};
							default: {
								return new Response(`Endpoint ${url.pathname} not found.`, {
									status: 404,
									"server": serverImpl
								});
							};
						};
						break;
					};
					default: {
						return new Response("Method disallowed.", {
							status: 405,
							"server": serverImpl
						});
					};
				};
			});
			break;
		};
		default: {
			console.error(`Unknown subcommand "${args.join(" ")}"`);
		};
	};
};

export {
	main
};
