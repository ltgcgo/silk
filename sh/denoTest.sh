#!/bin/bash
export NO_UPDATE=1
export TEMPLATE_URL=
deno run --allow-net --allow-env dist/deno.js "$@"
exit
