"use strict";

import {MastodonClient} from "../mastodon/index.mjs";

let handler = function (request, {persistent}) {
	return new Response(`This works.`);
};

export {
	handler
};
