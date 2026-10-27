(function EvidenceModule(){
'use strict';
const $=id=>document.getElementById(id);
const leagues={NBA:['basketball','nba'],WNBA:['basketball','wnba'],NCAAB:['basketball','mens-college-basketball'],NFL:['football','nfl'],NCAAF:['football','college-football'],CFB:['football','college-football'],NHL:['hockey','nhl'],MLB:['baseball','mlb']};
const cache=new Map(),busy=new Set();
const clean=x=>String(x||'').toLowerCase().replace(/\b(the|fc|cf|team|university|univ|city)\b/g,' ').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function similar(a,b){a=clean(a);b=clean(b);if(!a||!b)return 0;if(a===b)return 1;const aa=new Set(a.split(' ')),bb=new Set(b.split(' ')),overlap=[...aa].filter(x=>bb.has(x)).length;return Math.max(overlap/Math.max(aa.size,bb.size),a.includes(b)&&b.length>=6?.82:0,b.includes(a)&&a.length>=6?.82:0);}
function name(t){return String(t.displayName||t.name||t.shortDisplayName||'');}
function resolve(teams,q){const ranked=teams.map(t=>({item:t,score:Math.max(...[t.displayName,t.name,t.shortDisplayName,t.abbreviation].filter(Boolean).map(v=>similar(v,q)))})).sort((a,b)=>b.score-a.score);return ranked[0]?.score>=.78&&(!ranked[1]||ranked[0].score-ranked[1].score>=.11)?ranked[0].item:null;}
function rawData(url){return cache.get(url)?.until>Date.now()?cache.get(url).value:null;}
async function get(category,league,path){
const proxy=String(window.EdgeboardDebug?.data?.settings?.proxyUrl||'').trim().replace(/\/+$/,'');
const full=proxy?`${proxy}/research/espn/${category}/${league}/${path}`:`https://site.api.espn.com/apis/site/v2/sports/${category}/${league}/${path}`;
const cached=rawData(full);if(cached)return cached;
const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),8000);
try{const res=await fetch(full,{signal:ctrl.signal,headers:{Accept:'application/json'},cache:'default'});if(!res.ok)throw Error('Research feed HTTP '+res.status);const json=await res.json();cache.set(full,{until:Date.now()+15*60000,value:json});return json;}finally{clearTimeout(timer);}
}
function games(payload,id,before){
const results=[];
for(const e of payload?.events||[]){
const c=e.competitions?.[0],xs=c?.competitors||[],ours=xs.find(t=>String(t.team?.id||t.id)===String(id)),rival=xs.find(t=>t!==ours);
const when=Date.parse(e.date||c?.date||'');
if(!ours||!rival||!Number.isFinite(when)||when>=before||e.status?.type?.completed!==true)continue;
const a=Number(ours.score?.value??ours.score),b=Number(rival.score?.value??rival.score);
if(!Number.isFinite(a)||!Number.isFinite(b)||a===b)continue;
results.push({id:e.id,when,won:a>b,opponentId:rival.team?.id,opponent:name(rival.team||{}),a,b});
}
return [...new Map(results.map(x=>[x.id,x])).values()].sort((a,b)=>b.when-a.when);
}
function recent(list,n){const taken=list.slice(0,n),wins=taken.filter(x=>x.won).length;return `${wins}–${taken.length-wins} (of ${taken.length})`;}
async function analyze(m){
if(!m?.teams?.length||m.teams.length!==2)return {status:'unavailable',explanation:'Two named opponents needed'};
const info=leagues[m.sport];
if(!info)return{status:'unsupported',explanation:`Reliable recent results are not connected for ${m.sport||'this sport'} yet. This market's price is not independent research.`};
const [category,league]=info;
try{
const listing=await get(category,league,'teams?limit=500');
const teams=(listing?.sports||[]).flatMap(x=>(x.leagues||[]).flatMap(y=>y.teams||[])).concat(listing?.teams||[]).map(t=>t.team||t).filter(t=>t?.id);
const first=resolve(teams,m.teams[0]),second=resolve(teams,m.teams[1]);
if(!first||!second||first.id===second.id)return{status:'unmatched',explanation:'Could not match both opponents unambiguously to the sports database; no form estimate.'};
const before=Math.min(Date.now(),Date.parse(m.start)||Date.now());
const [a,b]=await Promise.all([get(category,league,`teams/${first.id}/schedule`),get(category,league,`teams/${second.id}/schedule`)]);
const ga=games(a,first.id,before),gb=games(b,second.id,before);
const h2h=ga.filter(x=>String(x.opponentId)===String(second.id)).slice(0,10),hWins=h2h.filter(x=>x.won).length;
return {status:Math.min(ga.length,gb.length)>=5?'results':'insufficient',names:[name(first),name(second)],recent:[ga,gb],h2h:[h2h.length,hWins,h2h.length-hWins],explanation:Math.min(ga.length,gb.length)>=5?'Verified completed-match counts. These do not account for injuries, opponent strength, lineups or a calibrated win probability.':'Too few verifiable recent results to draw a reliable conclusion.',source:`ESPN ${league}`};
}catch(err){return{status:'unavailable',explanation:`Live stats couldn't load (${String(err.message||err)}). Try adding the Cloudflare Worker URL in Settings. No data was invented.`};}
}
function html(result,m){
if(!result)return '';
if(!result.recent)return`<p>${esc(result.explanation)}</p>`;
return `<p>${esc(result.explanation)}</p><div class="recent-table"><b>Measure</b><b>${esc(result.names[0])}</b><b>${esc(result.names[1])}</b>${[5,10,20].map(n=>`<span>Last ${n}</span><span>${recent(result.recent[0],n)}</span><span>${recent(result.recent[1],n)}</span>`).join('')}<span>Head-to-head (${result.h2h[0]})</span><span>${result.h2h[1]} wins</span><span>${result.h2h[2]} wins</span></div><small class="helper">Source: ${esc(result.source)} · No independent winning probability calculated.</small>`;
}
function byId(id){const d=window.EdgeboardDebug;const m=[...(d?.rawMarkets||[]),...(d?.data?.manual||[])].find(x=>x.id===id);return m?d.screenOne(m):null;}
async function load(m,showModal){
if(!m)return;
const box=$('autoResearchContent');
if(showModal){
$('autoResearchTitle').textContent=m.teams.join(' vs ');
box.textContent='Checking recent results for both competitors…';
$('autoResearchDialog').showModal();
}
const key=m.teams.join('|')+':'+m.sport;const cached=cache.get('result:'+key);
if(cached&&cached.until>Date.now()){if(showModal)box.innerHTML=html(cached.value,m);return cached.value;}
if(busy.has(key))return;
busy.add(key);
try{const result=await analyze(m);cache.set('result:'+key,{until:Date.now()+10*60000,value:result});if(showModal)box.innerHTML=html(result,m);return result;}
finally{busy.delete(key);}
}
function open(id){load(byId(id),true);}
function schedule(){
const pending=(window.EdgeboardDebug?.passed||[]).filter(m=>leagues[m.sport]&&m.start&&Date.parse(m.start)>Date.now()).slice(0,2);
for(const m of pending)load(m,false).catch(()=>{});
}
function init(){
$('autoResearchClose')?.addEventListener('click',()=>$('autoResearchDialog').close());
document.addEventListener('click',e=>{const b=e.target.closest('[data-action="auto-research"]');if(b){e.preventDefault();open(b.dataset.id);}});
document.addEventListener('edgeboard:feed-updated',()=>{setTimeout(schedule,1200)});
}
window.EdgeboardResearch={open,analyze,schedule,html};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
