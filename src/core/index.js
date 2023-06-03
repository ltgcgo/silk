"use strict";

let main = async function () {
	WingBlade.serve(() => {
		return new Response("Test me!");
	});
};

export {
	main
};
