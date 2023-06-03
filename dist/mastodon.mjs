var d="currentTarget,explicitOriginalTarget,originalTarget,srcElement,target".split(",");var l={account:"user",application:"app",content:"text",created_at:"atNew",edited_at:"atEdit",favourites_count:"sumFav",in_reply_to_account_id:"replyUser",in_reply_to_id:"replyPost",language:"lang",media_attachments:"media",mentions:"ats",reblog:"boost",reblogs_count:"sumBoost",replies_count:"sumReply",sensitive:"cwReal",spoiler_text:"cwText",visibility:"access",followers_count:"sumFan",following_count:"sumSub",display_name:"dispName",avatar_static:"avatarStatic",header_static:"headerStatic",statuses_count:"sumPost",last_status_at:"atLastPost",noindex:"noIndex",verified_at:"atVerify",shortcode:"code",static_url:"static",visible_in_picker:"inPicker",expires_at:"atExpire",votes_count:"sumVote",voters_count:"sumVoter",website:"site",preview_url:"preview",remote_url:"remote",preview_remote_url:"previewRemote",text_url:"text",description:"alt"},c={update:"postNew","status.update":"postEdit",delete:"postDel"},h=class extends EventTarget{#l=40;#r=80;#h=2592e5;#o="";#n="";#u;#s=[];#a={};#f=[];#p=[];#E=[];#e=[];#i={};USER_NORMAL=0;USER_NOEXEMPT=1;USER_EXCLUDED=2;#c(e,t){return(t.atNew||0)-(e.atNew||0)}#m(){}#_(){}#w(){}#t(e){for(let t in e)l[t]&&(e[l[t]]=e[t],delete e[t]);return e.atNew&&(e.atNew=new Date(e.atNew).getTime()),e.atEdit&&(e.atEdit=new Date(e.atEdit).getTime()),e.atVerify&&(e.atVerify=new Date(e.atVerify).getTime()),e.atExpire&&(e.atExpire=new Date(e.atExpire).getTime()),e.app&&this.#t(e.app),e.user&&this.#t(e.user),e.media?.forEach(t=>{this.#t(t)}),e.emojis?.forEach(t=>{this.#t(t)}),e.ats?.forEach(t=>{this.#t(t)}),e.user&&e.user.fields?.forEach(t=>{this.#t(t)}),e.poll&&(e.poll.options?.forEach(t=>{this.#t(t)}),this.#t(e.poll)),e}#d(e,t){return this.#t(e),e?.user?.username&&(e.handle=`@${e.user.username}@${t.domain}`),e.rid=`${e.id}@${t.domain}`,e}receiver(e,t){let s,r=!0;switch(t.event){case"update":case"status.update":{let i=t.payload.constructor==String?JSON.parse(t.payload):t.payload;if(this.#d(i,e),this.#i[i.rid]){let o=this.#e.indexOf(this.#i[i.rid]);o>-1?(this.#e[o]=i,this.#i[i.rid]=i,console.error(`MODIFY Post ${i.rid} success.`)):console.error(`MODIFY Post ${i.rid} not found in postStore.`)}else console.error(`MODIFY Post ${i.rid} not found in postRef. Creating.`),this.#e.unshift(i),this.#i[i.rid]=i,console.error(`CREATE Post ${i.rid} success.`);s=i;break}case"delete":{let i=`${t.payload}@${e.domain}`;if(this.#i[i]){let o=this.#e.indexOf(this.#i[i]);o>-1?(this.#e.splice(o,1),console.error(`DELETE Post ${i} success.`)):console.error(`DELETE Post ${i} not found in postStore.`)}else console.error(`DELETE Post ${i} not found in postRef.`);s=t.payload;break}default:console.error(`Unknown message type ${t.event}.`),console.error(t)}this.#e.sort(this.#c),this.#e.length>this.#r&&this.#e.splice(this.#r,this.#e.length-this.#r).forEach(i=>{delete this.#i[i.rid]}),r?this.dispatchEvent(new MessageEvent(c[t.event]||t.event,{data:s})):console.error("Event dispatch aborted.")}getPosts(){return this.#e}startFor(e){e.ws=new WebSocket(`wss://${e.domain}/api/v1/streaming/`),e.ws.addEventListener("open",()=>{e.ws.send('{"type":"subscribe","stream":"public:local"}'),e.domain==this.#o&&e.ws.send(`{"type":"subscribe","stream":"user","access_token":"${this.#n}"}`)}),e.ws.addEventListener("message",t=>{let s=JSON.parse(t.data);this.receiver.call(this,e,s)}),e.ws.addEventListener("close",()=>{AbortSignal.timeout(3e3).onabort=()=>{this.startFor(e)}}),console.info(`Started for ${e.domain}.`)}launch(e){this.#s.forEach(async t=>{if(console.info(`Starting for ${t.domain}.`),this.startFor.call(this,t),!e){let s={headers:{}};t.auth&&(s.headers.Authorization=`Bearer ${t.auth}`);let r=await fetch(`https://${t.domain}/api/v1/timelines/public?local=true&only_media=false&limit=${this.#l}`);r.status==200?(await r.json())?.forEach(i=>{this.receiver(t,{event:"update",payload:i})}):console.error(`Post fetching for ${t.domain} failed: ${r.status} ${r.statusText}`)}})}constructor({servers:e,serversCw:t,instance:s,accessToken:r,serversTk:i,streamOnly:o=!1}){super(),e?.forEach(a=>{let n={domain:a,ws:void 0,cw:!1};this.#a[a]=this.#s.length,this.#s.push(n)}),t?.forEach(a=>{let n={domain:a,ws:void 0,cw:!0};this.#a[a]=this.#s.length,this.#s.push(n)}),i?.forEach(a=>{this.#s[this.#a[a[0]]].auth=a[1]}),this.#o=s,this.#n=r,this.launch(o)}};export{h as MastodonClient};
