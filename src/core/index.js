"use strict";

import {MastodonClient} from "../mastodon/index.mjs";

let main = async function (args) {
	switch (args[0] || "serve") {
		case "login": {
			let instance = args[1];
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
			let appToken = await (await fetch(`https://${instance}/api/v1/apps`, {
				method: "post",
				body: appDetails
			})).json();
			console.error(`Registered Silk as app ${appToken.id}.`);
			console.info(`Client ID: ${appToken.client_id}`);
			console.info(`Client Secret: ${appToken.client_secret}`);
			WingBlade.serve(async () => {
				WingBlade.sleep(1000).then(() => {
					console.error(`Login success.`);
					WingBlade.exit(0);
				});
				return new Response("OK");
			}, {
				onListen: () => {
					console.error(`Open https://${instance}/oauth/authorize?response_type=code&client_id=${appToken.client_id}&redirect_uri=${encodeURIComponent("http://127.0.0.1:19810/")}`);
				},
				port: 19810
			})
			break;
		};
		case "serve": {
			// Load configs
			let listServers = WingBlade.getEnv("LIST_SERVER")?.split(",") || [];
			let listServersCw = WingBlade.getEnv("LIST_SERVER_CW")?.split(",") || [];
			let listServersTk = WingBlade.getEnv("LIST_SERVER_TK")?.split(",") || [];
			let hookServer = WingBlade.getEnv("HOOK_SERVER");
			let hookAuth = WingBlade.getEnv("HOOK_AUTH");
			let streamOnly = WingBlade.getEnv("NO_BATCH_REQUEST") || WingBlade.variant == "Cloudflare";
			// Test configs
			if (!hookServer) {
				console.error("Hook server not defined!");
				WingBlade.exit(1);
			};
			if (!hookAuth) {
				console.error("Hook server not logged in!");
				WingBlade.exit(1);
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
				accessToken: hookAuth,
				streamOnly
			};
			console.info(mastoConf);
			let mastoClient = new MastodonClient(mastoConf);
			WingBlade.serve(() => {
				return new Response("Test me!");
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
