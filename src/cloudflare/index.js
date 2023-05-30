"use strict";

import {MastodonClient} from "../mastodon/index.mjs";
import {handler} from "../core/index.mjs";

addEventListener("fetch", async function (event) {
	event.respondWith(await handler(event.request, {persistent: false}));
});
