"use strict";import{WebSocket,WebSocketServer as WebSocketService}from"ws";import{fetch,Request,Response}from"undici";import os from"node:os";import fs from"node:fs";import http from"node:http";import crypto from"node:crypto";
if(!globalThis.self){globalThis.self=globalThis};
"use strict";(()=>{var S=class{#e;#n;#l=!1;#a=[];#r={open:[],message:[],error:[],close:[]};addEventListener(e,t){this.#e?e!="open"?this.#e.addEventListener(e,t):t(new Event("open")):this.#r[e].push(t)}get binaryType(){return this.#e?.binaryType||""}get bufferedAmount(){return this.#e?.bufferedAmount||0}get extensions(){return this.#e?.extensions||""}get readyState(){return this.#e?.readyState||0}get url(){return this.#e?.url||this.#n}attach(e){if(this.#l)return!1;if(this.#e)throw new Error("Already attached a WebSocket object");this.#e=e;let t=this;switch(e.readyState){case 0:case 1:{for(let i in this.#r)this.#r[i].forEach(s=>{e.addEventListener(i,s)});let r=new Event("open");this.#r.open.forEach(i=>{i(r)});break}case 2:case 3:{t.dispatchEvent(new Event("close"));break}}}close(...e){return this.#l=!0,this.#e?.close(...e)}send(e){this.#e?this.#e.send(e):this.#a.push(e)}constructor(e){this.#n=e.url.replace("http","ws"),this.addEventListener("open",t=>{for(;this.#a.length>0;)this.#e.send(this.#a.shift())})}},E={args:process.argv.slice(2),os:os.platform(),variant:"Node",version:process.version.replace("v",""),persist:!0,exit:(e=0)=>{process.exit(e)},getEnv:(e,t)=>process.env[e]||t,memUsed:()=>process.memoryUsage(),randomInt:e=>Math.floor(Math.random()*e),readFile:async function(e,t){return new Uint8Array((await fs.promises.readFile(e,t)).buffer)},serve:(e,t={})=>{let r=t.port||8e3,i=t.hostname||"127.0.0.1",s=http.createServer(async function(n,a){let d,f=new ReadableStream({type:"bytes",start:c=>{d=c},cancel:c=>{},autoAllocateChunkSize:65536}),l={method:n.method,headers:n.headers},v=["GET","HEAD"].indexOf(l.method)==-1;n.on("data",c=>{d.enqueue(c)}).on("end",()=>{d.close()}),v&&(l.body=f,l.duplex="half");let p=new Request(`${n.headers["x-forwarded-proto"]||"http"}://${n.headers.host}${n.url}`,l),o=await e(p);o?.headers?.forEach((c,w)=>{a.setHeader(w,c)}),a.statusCode=o?.status||200,o?.statusText&&(a.statusMessage=o.statusText),a.flushHeaders();let u=o.body.getReader(),h=!0;for(;h;)await u.read().then(({done:c,value:w})=>{c?(a.end(),h=!1):a.write(w)})});return s.on("upgrade",async(n,a,d)=>{let f={method:n.method,headers:n.headers},l=new Request(`${n.headers["x-forwarded-proto"]||"http"}://${n.headers.host}${n.url}`,f);l.raw={requester:n,socket:a,head:d},await e(l)}),s.listen(r,i,()=>{(t.onListen||function({port:n,hostname:a}){console.error(`WingBlade serving at http://${a}:${n}`)})({port:r,hostname:i})}),s},setEnv:(e,t)=>{process.env[e]=t},sleep:function(e,t=0){return new Promise((r,i)=>{setTimeout(r,e+Math.floor(t*Math.random()))})},upgradeWebSocket:e=>{let t=new WebSocketService({noServer:!0}),r=new S(e);return t.handleUpgrade(e.raw.requester,e.raw.socket,e.raw.head,function(i){r.attach(i)}),{socket:r,response:new Response(null,{status:200})}},writeFile:async function(e,t,r={}){let i={flag:"w"};r.append&&(i.flag="a"),r.signal&&(i.signal=r.signal),r.mode&&(i.mode=r.mode),await fs.promises.writeFile(e,t,i)}};var x="currentTarget,explicitOriginalTarget,originalTarget,srcElement,target".split(",");var g={account:"user",application:"app",content:"text",created_at:"atNew",edited_at:"atEdit",favourites_count:"sumFav",in_reply_to_account_id:"replyUser",in_reply_to_id:"replyPost",language:"lang",media_attachments:"media",mentions:"ats",reblog:"boost",reblogs_count:"sumBoost",replies_count:"sumReply",sensitive:"cwReal",spoiler_text:"cwText",visibility:"access",followers_count:"sumFan",following_count:"sumSub",display_name:"dispName",avatar_static:"avatarStatic",header_static:"headerStatic",statuses_count:"sumPost",last_status_at:"atLastPost",noindex:"noIndex",verified_at:"atVerify",shortcode:"code",static_url:"static",visible_in_picker:"inPicker",expires_at:"atExpire",votes_count:"sumVote",voters_count:"sumVoter",website:"site",preview_url:"preview",remote_url:"remote",preview_remote_url:"previewRemote",text_url:"text",description:"alt"},b={update:"postNew","status.update":"postEdit",delete:"postDel"},y=class extends EventTarget{#e=40;#n=80;#l=2592e5;#a="";#r="";#u;#o=[];#c={};#f=[];#p=[];#m=[];#t=[];#i={};USER_NORMAL=0;USER_NOEXEMPT=1;USER_EXCLUDED=2;#d(e,t){return(t.atNew||0)-(e.atNew||0)}#v(){}#w(){}#E(){}#s(e){for(let t in e)g[t]&&(e[g[t]]=e[t],delete e[t]);return e.atNew&&(e.atNew=new Date(e.atNew).getTime()),e.atEdit&&(e.atEdit=new Date(e.atEdit).getTime()),e.atVerify&&(e.atVerify=new Date(e.atVerify).getTime()),e.atExpire&&(e.atExpire=new Date(e.atExpire).getTime()),e.app&&this.#s(e.app),e.user&&this.#s(e.user),e.media?.forEach(t=>{this.#s(t)}),e.emojis?.forEach(t=>{this.#s(t)}),e.ats?.forEach(t=>{this.#s(t)}),e.user&&e.user.fields?.forEach(t=>{this.#s(t)}),e.poll&&(e.poll.options?.forEach(t=>{this.#s(t)}),this.#s(e.poll)),e}#h(e,t){return this.#s(e),e?.user?.username&&(e.handle=`@${e.user.username}@${t.domain}`),e.rid=`${e.id}@${t.domain}`,e}receiver(e,t){let r,i=!0;switch(t.event){case"update":case"status.update":{let s=t.payload.constructor==String?JSON.parse(t.payload):t.payload;if(this.#h(s,e),this.#i[s.rid]){let n=this.#t.indexOf(this.#i[s.rid]);n>-1?(this.#t[n]=s,this.#i[s.rid]=s,console.error(`MODIFY Post ${s.rid} success.`)):console.error(`MODIFY Post ${s.rid} not found in postStore.`)}else console.error(`MODIFY Post ${s.rid} not found in postRef. Creating.`),this.#t.unshift(s),this.#i[s.rid]=s,console.error(`CREATE Post ${s.rid} success.`);r=s;break}case"delete":{let s=`${t.payload}@${e.domain}`;if(this.#i[s]){let n=this.#t.indexOf(this.#i[s]);n>-1?(this.#t.splice(n,1),console.error(`DELETE Post ${s} success.`)):console.error(`DELETE Post ${s} not found in postStore.`)}else console.error(`DELETE Post ${s} not found in postRef.`);r=t.payload;break}default:console.error(`Unknown message type ${t.event}.`),console.error(t)}this.#t.sort(this.#d),this.#t.length>this.#n&&this.#t.splice(this.#n,this.#t.length-this.#n).forEach(s=>{delete this.#i[s.rid]}),i?this.dispatchEvent(new MessageEvent(b[t.event]||t.event,{data:r})):console.error("Event dispatch aborted.")}getPosts(){return this.#t}startFor(e){e.ws=new WebSocket(`wss://${e.domain}/api/v1/streaming/`),e.ws.addEventListener("open",()=>{e.ws.send('{"type":"subscribe","stream":"public:local"}'),e.domain==this.#a&&e.ws.send(`{"type":"subscribe","stream":"user","access_token":"${this.#r}"}`)}),e.ws.addEventListener("message",t=>{let r=JSON.parse(t.data);this.receiver.call(this,e,r)}),e.ws.addEventListener("close",()=>{AbortSignal.timeout(3e3).onabort=()=>{this.startFor(e)}}),console.info(`Started for ${e.domain}.`)}launch(e){this.#o.forEach(async t=>{if(console.info(`Starting for ${t.domain}.`),this.startFor.call(this,t),!e){let r={headers:{}};t.auth&&(r.headers.Authorization=`Bearer ${t.auth}`);let i=await fetch(`https://${t.domain}/api/v1/timelines/public?local=true&only_media=false&limit=${this.#e}`);i.status==200?(await i.json())?.forEach(s=>{this.receiver(t,{event:"update",payload:s})}):console.error(`Post fetching for ${t.domain} failed: ${i.status} ${i.statusText}`)}})}constructor({servers:e,serversCw:t,instance:r,accessToken:i,serversTk:s,streamOnly:n=!1}){super(),e?.forEach(a=>{let d={domain:a,ws:void 0,cw:!1};this.#c[a]=this.#o.length,this.#o.push(d)}),t?.forEach(a=>{let d={domain:a,ws:void 0,cw:!0};this.#c[a]=this.#o.length,this.#o.push(d)}),s?.forEach(a=>{this.#o[this.#c[a[0]]].auth=a[1]}),this.#a=r,this.#r=i,this.launch(n)}};var m=new TextEncoder("utf-8"),_=async function(e){let t=`Silk@${WingBlade.variant}`;switch(e[0]||"serve"){case"login":{let r=e[1];r||(console.error("Target instance not defined!"),WingBlade.exit(1)),console.error(`Trying to log into ${r}.`),console.error("Obtaining app token...");let i=new FormData;i.set("client_name","Lightingale Silk"),i.set("redirect_uris","http://127.0.0.1:19810/"),i.set("website","https://mlp.ltgc.cc/silk/");let s=await(await fetch(`https://${r}/api/v1/apps`,{method:"post",body:i})).json();console.error(`Registered Silk as app ${s.id}.`),console.info(`Client ID: ${s.client_id}`),console.info(`Client Secret: ${s.client_secret}`),WingBlade.serve(async()=>(WingBlade.sleep(1e3).then(()=>{console.error("Login success."),WingBlade.exit(0)}),new Response("OK")),{onListen:()=>{console.error(`Open https://${r}/oauth/authorize?response_type=code&client_id=${s.client_id}&redirect_uri=${encodeURIComponent("http://127.0.0.1:19810/")}`)},port:19810});break}case"serve":{let r=WingBlade.getEnv("LIST_SERVER")?.split(",")||[],i=WingBlade.getEnv("LIST_SERVER_CW")?.split(",")||[],s=WingBlade.getEnv("LIST_SERVER_TK")?.split(",")||[],n=WingBlade.getEnv("HOOK_SERVER"),a=WingBlade.getEnv("HOOK_AUTH"),d=WingBlade.getEnv("NO_BATCH_REQUEST")||WingBlade.variant=="Cloudflare";n||(console.error("Hook server not defined!"),WingBlade.exit(1)),a||(console.error("Hook server not logged in!"),WingBlade.exit(1)),s.forEach((o,u,h)=>{let c=o.indexOf("=");c>-1&&(h[u]=[o.slice(0,c),o.slice(c+1)])});let f={servers:r,serversCw:i,serversTk:s,instance:n,accessToken:a,streamOnly:d};console.info(f);let l=new y(f),v=m.encode("[]"),p=[];l.addEventListener("postNew",async({data:o})=>{let u=m.encode(`{"event":"set","data":${JSON.stringify(o)}}`);p.forEach(async h=>{h.send()}),v=m.encode(JSON.stringify(l.getPosts()))}),l.addEventListener("postEdit",async({data:o})=>{let u=m.encode(`{"event":"set","data":${JSON.stringify(o)}}`);p.forEach(async h=>{h.send()})}),l.addEventListener("postDel",async({data:o})=>{let u=m.encode(`{"event":"delete","data":${JSON.stringify(o)}}`);p.forEach(async h=>{h.send()})}),WingBlade.serve(o=>{let u=new URL(o.url);switch(o.method?.toLowerCase()){case"get":{switch(u.pathname){case"/nr/silk/timeline":case"/nr/silk/timeline/":return new Response(v,{status:200,headers:{"content-type":"application/json",server:t}});case"/rt/silk/timeline":case"/rt/silk/timeline/":return o.headers.get("upgrade")=="websocket"?new Response("WebSocket isn't supported yet.",{status:400,server:t}):new Response("SSE isn't supported yet.",{status:400,server:t});default:return new Response(`Endpoint ${u.pathname} not found.`,{status:404,server:t})}break}default:return new Response("Method disallowed.",{status:405,server:t})}});break}default:console.error(`Unknown subcommand "${e.join(" ")}"`)}};self.WingBlade=E;_(E.args);})();
