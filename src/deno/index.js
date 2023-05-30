"use strict";

import {MastodonClient} from "../mastodon/index.mjs";
import {handler} from "../core/index.mjs";

Deno.serve(async function (req, inf) {
	return await handler(req, {persistent: true});
});
