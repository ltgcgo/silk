"use strict";(()=>{var m="currentTarget,explicitOriginalTarget,originalTarget,srcElement,target".split(",");var d={account:"user",application:"app",content:"text",created_at:"atNew",edited_at:"atEdit",favourites_count:"sumFav",in_reply_to_account_id:"replyUser",in_reply_to_id:"replyPost",language:"lang",media_attachments:"media",mentions:"ats",reblog:"boost",reblogs_count:"sumBoost",replies_count:"sumReply",sensitive:"cwReal",spoiler_text:"cwText",visibility:"access",followers_count:"sumFan",following_count:"sumSub",display_name:"dispName",avatar_static:"avatarStatic",header_static:"headerStatic",statuses_count:"sumPost",last_status_at:"atLastPost",noindex:"noIndex",verified_at:"atVerify",shortcode:"code",static_url:"static",visible_in_picker:"inPicker",expires_at:"atExpire",votes_count:"sumVote",voters_count:"sumVoter",website:"site",preview_url:"preview",remote_url:"remote",preview_remote_url:"previewRemote",text_url:"text",description:"alt"},f={update:"postNew","status.update":"postEdit",delete:"postDel"},h=class extends EventTarget{#c=40;#r=80;#h=2592e5;#o="";#a="";#u;#s=[];#n={};#p=[];#f=[];#E=[];#e=[];#i={};USER_NORMAL=0;USER_NOEXEMPT=1;USER_EXCLUDED=2;#d(e,t){return(t.atNew||0)-(e.atNew||0)}#m(){}#_(){}#v(){}#t(e){for(let t in e)d[t]&&(e[d[t]]=e[t],delete e[t]);return e.atNew&&(e.atNew=new Date(e.atNew).getTime()),e.atEdit&&(e.atEdit=new Date(e.atEdit).getTime()),e.atVerify&&(e.atVerify=new Date(e.atVerify).getTime()),e.atExpire&&(e.atExpire=new Date(e.atExpire).getTime()),e.app&&this.#t(e.app),e.user&&this.#t(e.user),e.media?.forEach(t=>{this.#t(t)}),e.emojis?.forEach(t=>{this.#t(t)}),e.ats?.forEach(t=>{this.#t(t)}),e.user&&e.user.fields?.forEach(t=>{this.#t(t)}),e.poll&&(e.poll.options?.forEach(t=>{this.#t(t)}),this.#t(e.poll)),e}#l(e,t){return this.#t(e),e?.user?.username&&(e.handle=`@${e.user.username}@${t.domain}`),e.rid=`${e.id}@${t.domain}`,e}receiver(e,t){let s;switch(t.event){case"update":{let i=t.payload.constructor==String?JSON.parse(t.payload):t.payload;this.#l(i,e),this.#e.unshift(i),this.#i[i.rid]=i,console.error(`CREATE Post ${i.rid} success.`),s=i;break}case"status.update":{let i=JSON.parse(t.payload);if(this.#l(i,e),this.#i[i.rid]){let r=this.#e.indexOf(this.#i[i.rid]);r>-1?(this.#e[r]=i,this.#i[i.rid]=i,console.error(`MODIFY Post ${i.rid} success.`)):console.error(`MODIFY Post ${i.rid} not found in postStore.`)}else console.error(`MODIFY Post ${i.rid} not found in postRef.`);s=i;break}case"delete":{let i=`${t.payload}@${e.domain}`;if(this.#i[i]){let r=this.#e.indexOf(this.#i[i]);r>-1?(this.#e.splice(r,1),console.error(`DELETE Post ${i} success.`)):console.error(`DELETE Post ${i} not found in postStore.`)}else console.error(`DELETE Post ${i} not found in postRef.`);s=t.payload;break}default:console.error(`Unknown message type ${t.event}.`)}this.#e.sort(this.#d),this.#e.length>this.#r&&this.#e.splice(this.#r,this.#e.length-this.#r).forEach(i=>{delete this.#i[i.rid]}),this.dispatchEvent(new MessageEvent(f[t.event]||t.event,{data:s}))}getPosts(){return this.#e}startFor(e){e.ws=new WebSocket(`wss://${e.domain}/api/v1/streaming/`),e.ws.addEventListener("open",()=>{e.ws.send('{"type":"subscribe","stream":"public:local"}'),e.domain==this.#o&&e.ws.send(`{"type":"subscribe","stream":"user","access_token":"${this.#a}"}`)}),e.ws.addEventListener("message",t=>{let s=JSON.parse(t.data);this.receiver.call(this,e,s)}),e.ws.addEventListener("close",()=>{AbortSignal.timeout(3e3).onabort=()=>{this.startFor(e)}}),console.info(`Started for ${e.domain}.`)}launch(e){this.#s.forEach(async t=>{if(console.info(`Starting for ${t.domain}.`),this.startFor.call(this,t),!e){let s={headers:{}};t.auth&&(s.headers.Authorization=`Bearer ${t.auth}`),(await(await fetch(`https://${t.domain}/api/v1/timelines/public?local=1&limit=${this.#c}`)).json())?.forEach(i=>{this.receiver(t,{event:"update",payload:i})})}})}constructor({servers:e,serversCw:t,instance:s,accessToken:i,serversTk:r,streamOnly:a=!1}){super(),e?.forEach(n=>{let o={domain:n,ws:void 0,cw:!1};this.#n[n]=this.#s.length,this.#s.push(o)}),t?.forEach(n=>{let o={domain:n,ws:void 0,cw:!0};this.#n[n]=this.#s.length,this.#s.push(o)}),r?.forEach(n=>{this.#s[this.#n[n[0]]].auth=n[1]}),this.#o=s,this.#a=i,this.launch(a)}};var w=async function(e){switch(e[0]||"serve"){case"login":{let t=e[1];t||(console.error("Target instance not defined!"),WingBlade.exit(1)),console.error(`Trying to log into ${t}.`),console.error("Obtaining app token...");let s=new FormData;s.set("client_name","Lightingale Silk"),s.set("redirect_uris","http://127.0.0.1:19810/"),s.set("website","https://mlp.ltgc.cc/silk/");let i=await(await fetch(`https://${t}/api/v1/apps`,{method:"post",body:s})).json();console.error(`Registered Silk as app ${i.id}.`),console.info(`Client ID: ${i.client_id}`),console.info(`Client Secret: ${i.client_secret}`),WingBlade.serve(async()=>(WingBlade.sleep(1e3).then(()=>{console.error("Login success."),WingBlade.exit(0)}),new Response("OK")),{onListen:()=>{console.error(`Open https://${t}/oauth/authorize?response_type=code&client_id=${i.client_id}&redirect_uri=${encodeURIComponent("http://127.0.0.1:19810/")}`)},port:19810});break}case"serve":{let t=WingBlade.getEnv("LIST_SERVER")?.split(",")||[],s=WingBlade.getEnv("LIST_SERVER_CW")?.split(",")||[],i=WingBlade.getEnv("LIST_SERVER_TK")?.split(",")||[],r=WingBlade.getEnv("HOOK_SERVER"),a=WingBlade.getEnv("HOOK_AUTH"),n=WingBlade.getEnv("NO_BATCH_REQUEST")||WingBlade.variant=="Cloudflare";r||(console.error("Hook server not defined!"),WingBlade.exit(1)),a||(console.error("Hook server not logged in!"),WingBlade.exit(1)),i.forEach((l,u,p)=>{let c=l.indexOf("=");c>-1&&(p[u]=[l.slice(0,c),l.slice(c+1)])});let o={servers:t,serversCw:s,serversTk:i,instance:r,accessToken:a,streamOnly:n};console.info(o);let E=new h(o);WingBlade.serve(()=>new Response("Test me!"));break}default:console.error(`Unknown subcommand "${e.join(" ")}"`)}};})();
