(function SportsFeedV13(){
'use strict';
const $=id=>document.getElementById(id);
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PAGE_SIZE=150, FIRST_BATCH_PAGES=5, LOAD_MORE_PAGES=5, MAX_PAGES=100;
const aliases={'table-tennis':'Table Tennis','table tennis':'Table Tennis','ping-pong':'Table Tennis','tennis':'Tennis','atp':'Tennis','wta':'Tennis','esports':'Esports','esport':'Esports','cs2':'Esports','counter-strike':'Esports','dota':'Esports','dota2':'Esports','valorant':'Esports','league of legends':'Esports','lol':'Esports','nba':'NBA','wnba':'WNBA','nfl':'NFL','cfb':'CFB','ncaaf':'CFB','college football':'CFB','college-football':'CFB','ncaab':'NCAAB','college basketball':'NCAAB','nhl':'NHL','mlb':'MLB','mls':'Soccer','soccer':'Soccer','uefa':'Soccer','epl':'Soccer','premier league':'Soccer','la liga':'Soccer','serie a':'Soccer','ufc':'UFC/MMA','mma':'UFC/MMA','f1':'F1','formula 1':'F1'};
const fixed=['All','Tennis','Table Tennis','Esports','NFL','CFB','NBA','NCAAB','NHL','MLB','Soccer','UFC/MMA','F1','Other'];
const slugBySport={'Tennis':'tennis','Table Tennis':'table-tennis','Esports':'esports','NFL':'nfl','CFB':'ncaaf','NBA':'nba','NCAAB':'ncaab','NHL':'nhl','MLB':'mlb','Soccer':'soccer','UFC/MMA':'ufc','F1':'f1'};
let busy=false,baseTag='sports',nextOffset=0,ended=false,seen=new Map(),raw=new Map(),pageCount=0,errors=[],usedEndpoint='',cacheData=[],chosenSport='All',resultLimit=80,runToken=0,updateQueued=false,hasEverLoaded=false;
const metaSport=(event)=>{
  const texts=[event.sport,event.sportsCategory,event.sportSlug,event.category,event.league,event.series?.[0]?.slug,event.series?.[0]?.title,...(Array.isArray(event.tags)?event.tags.flatMap(t=>[t.slug,t.label]):[])].filter(Boolean).map(s=>String(s).toLowerCase());
  // Avoid "sports" as sport type; choose more specific metadata.
  const pairs=Object.entries(aliases).sort((a,b)=>b[0].length-a[0].length);
  for(const [term,value] of pairs)if(texts.some(t=>t===term||new RegExp('(^|[^a-z])'+term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'([^a-z]|$)').test(t)))return value;
  return 'Other';
};
function displaySport(event,tag){
 const resolved=metaSport(event);
 if(resolved!=='Other')return resolved;
 if(tag!=='sports'&&tag!=='All')return aliases[tag]||'Other';
 return 'Other';
}
function apiPath(tag,offset){
  const params=new URLSearchParams({active:'true',closed:'false',tag_slug:tag,limit:String(PAGE_SIZE),offset:String(offset),order:'endDate',ascending:'true'});
  return '/events?'+params.toString();
}
async function fetchPage(url){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const res=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'},cache:'no-store'});
  if(!res.ok)throw Error('HTTP '+res.status);
  const json=await res.json();
  if(Array.isArray(json))return json;
  if(Array.isArray(json.events))return json.events;
  if(Array.isArray(json.data))return json.data;
  throw Error('API returned an unexpected event format');
 }finally{clearTimeout(timer);}
}
async function fetchFromAPI(tag,offset){
  const stored=String(window.EdgeboardDebug?.data?.settings?.proxyUrl||'').trim().replace(/\/+$/,'');
  const bases=[stored,'https://gamma-api.polymarket.com'].filter((x,i,a)=>x&&a.indexOf(x)===i);
  const suffix=apiPath(tag,offset),attempts=[];
  for(const base of bases){
    const options=[suffix,suffix.replace(/&order=endDate&ascending=true/,'')];
    for(const path of options){
      try{
        const out=await fetchPage(base+path);
        usedEndpoint=base.includes('workers.dev')?'Cloudflare proxy':'Gamma public API';
        return out;
      }catch(e){attempts.push(String(e.message||e));if(!/HTTP 400|HTTP 422/.test(String(e)))break;}
    }
  }
  throw Error(attempts.join(' / ').slice(0,170)||'No API connection');
}
function adapt(ev,tag){
  const guess=displaySport(ev,tag);
  const next={...ev,_edgeSource:'gamma',_sportGuess:guess==='Other'?null:guess};
  if(!next.gameStartTime&&ev.game?.startTime)next.gameStartTime=ev.game.startTime;
  return next;
}
function extract(event){
  const normalise=window.EdgeboardDebug?.normaliseEvent;
  if(!normalise)return [];
  const arr=normalise(event);
  if(arr.length)return arr.map(x=>({...x,source:'gamma',venue:'Polymarket global'}));
  // Keep an event visible for browsing if it is a clear two-participant game,
  // even when the API lacks usable winner prices. Never put it in combos.
  if(!event.markets?.length||event.closed===true)return [];
  const match=String(event.title||'').match(/^(.+?)\s+(?:vs\.?|v\.?|versus|@)\s+(.+?)(?:\s*\([^)]*\))?$/i);
  if(!match)return [];
  const stamp=event.gameStartTime||event.sportsStartTime||event.eventStartTime||event.game?.startTime||null;
  const m=event.markets[0];
  return [{id:'unpriced-'+String(event.id||event.slug),matchId:'event-'+String(event.id||event.slug),sport:event._sportGuess||'Other',league:event.series?.[0]?.title||'Sports',teams:[match[1].trim(),match[2].trim()],prices:[],liquidity:null,spread:null,start:stamp,live:event.live===true,open:event.active!==false&&event.closed!==true&&m.closed!==true,url:'https://polymarket.com/event/'+encodeURIComponent(event.slug||''),source:'gamma',venue:'Polymarket global',technicalReject:'Winner price unavailable; browse only'}];
}
function ingest(events,tag){
  let additions=0;
  for(const input of events){
    if(!input||(!input.id&&!input.slug))continue;
    const ev=adapt(input,tag),key=String(ev.id||ev.slug);
    if(seen.has(key))continue;
    seen.set(key,ev);additions++;
    for(const market of extract(ev))if(market.id&&!raw.has(market.id))raw.set(market.id,market);
  }
  return additions;
}
function status(message,warning=false){
  const notice=$('feedNotice');
  if(notice){notice.textContent=message;notice.className=warning?'notice warn':'notice';}
  const btn=$('loadMoreEvents');
  if(btn){btn.disabled=busy||ended;btn.textContent=busy?'Loading events…':ended?'All available pages loaded':'Load more Polymarket events';}
  const count=$('apiCoverage');if(count)count.textContent=`${seen.size.toLocaleString()} API events · ${raw.size.toLocaleString()} extracted markets · ${pageCount} page${pageCount===1?'':'s'} · ${usedEndpoint||'Gamma API'}`;
}
function updated(){
 if(updateQueued)return;
 updateQueued=true;
 // Keep UI responsive by coalescing repeated updates into one paint.
 setTimeout(()=>{
  updateQueued=false;
  window.EdgeboardDebug?.setMarkets([...raw.values()]);
  render();
  document.dispatchEvent(new Event('edgeboard:feed-updated'));
 },140);
}
async function loadPages(pageLimit,reset=false){
 if(busy)return;
 const token=++runToken;
 if(reset){seen=new Map();raw=new Map();pageCount=0;nextOffset=0;ended=false;errors=[];usedEndpoint='';hasEverLoaded=false;}
 busy=true;status('Contacting Polymarket Gamma API and loading sports events in pages…');
 const filter=baseTag;
 try{
  for(let page=0;page<pageLimit&&!ended&&pageCount<MAX_PAGES;page++){
   if(token!==runToken)break;
   try{
     const payload=await fetchFromAPI(filter,nextOffset);
     ingest(payload,filter);
     pageCount++;
     nextOffset+=PAGE_SIZE;
     hasEverLoaded=true;
     ended=payload.length<PAGE_SIZE;
     updated();
     status(`${seen.size.toLocaleString()} active ${filter==='sports'?'sports':'selected sport'} events retrieved · ${raw.size.toLocaleString()} market listings. More pages ${ended?'not needed':'available'}.`);
   }catch(err){
     errors.push('Page '+(pageCount+1)+': '+String(err.message||err));
     // A transient error must not silently be labeled "all loaded".
     break;
   }
  }
  if(pageCount>=MAX_PAGES)ended=true;
 }finally{
  busy=false;
  const notice=errors.length?`API partially unavailable: ${errors[errors.length-1]}. Loaded ${seen.size.toLocaleString()} events; retry refresh or use the proxy.`:
    `Loaded ${seen.size.toLocaleString()} active events, ${raw.size.toLocaleString()} parsed winner markets. ${ended?'Finished available pages for this query.':'More pages are available.'} Prices are Polymarket global reference quotes; US availability and execution prices are not confirmed.`;
  status(notice,errors.length>0);
  updated();
 }
}
async function scan(){
  if(busy)return;
  await loadPages(FIRST_BATCH_PAGES,true);
}
function getSportSelection(){
  const node=$('sportFilters')?.querySelector('.active');
  return node?.dataset.sport||chosenSport||'All';
}
function render(){
  const debug=window.EdgeboardDebug;
  if(!debug?.rawMarkets)return;
  const selected=chosenSport;
  const search=($('gameSearch')?.value||'').trim().toLowerCase();
  const windowValue=$('gameTimeFilter')?.value||'all',now=Date.now();
  const visible=debug.rawMarkets.map(debug.screenOne).filter(m=>{
    if(m.open===false)return false;
    if(selected!=='All'&&(selected==='CFB'?m.sport!=='NCAAF'&&m.sport!=='CFB':selected==='Other'?fixed.includes(m.sport):m.sport!==selected))return false;
    if($('browsePassed')?.checked&&!m.passed)return false;
    if(search&&!([m.sport,m.league,...(m.teams||[])].join(' ').toLowerCase().includes(search)))return false;
    const start=Date.parse(m.start);
    if(!Number.isFinite(start))return windowValue==='all';
    if(start<now)return windowValue==='live'&&m.live&&now-start<8*3600000;
    if(windowValue==='live')return false;
    if(windowValue==='all')return true;
    const hours=Number(windowValue)||24;
    return start<=now+hours*3600000;
  }).sort((a,b)=>{
    const at=Date.parse(a.start),bt=Date.parse(b.start);
    return (Number.isFinite(at)?at:Infinity)-(Number.isFinite(bt)?bt:Infinity);
  });
  if($('browseCount'))$('browseCount').textContent=`${visible.length.toLocaleString()} games match filters`;
  const box=$('browseGames');
  if(box){
    box.innerHTML=visible.slice(0,resultLimit).map(p=>{
      const prices=p.prices?.length===2&&p.prices.every(x=>Number.isFinite(x))?p.prices:null;
      const best=prices?(prices[0]>=prices[1]?0:1):-1;
      const start=Date.parse(p.start);
      const time=Number.isFinite(start)?new Date(start).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Start time unverified';
      const priceText=prices?`${(100*prices[0]).toFixed(1)}¢ / ${(100*prices[1]).toFixed(1)}¢`:'No verified winner prices';
      const fav=best>=0?`${p.teams[best]} · ${prices[best]? (1/prices[best]).toFixed(2)+'×':''}`:'Favorite unknown';
      return `<article class="browse-game"><div class="browse-head"><span>${safe(p.sport)} · ${safe(p.league)}</span><b class="${p.passed?'good':'neutral'}">${p.passed?'SCREENED':'REFERENCE'}</b></div><strong>${safe((p.teams||[]).join(' vs '))}</strong><p>${safe(time)} · ${safe(priceText)}</p><p>Market favorite: ${safe(fav)}</p><p>Global odds reference · not verified as tradable on Polymarket US</p><div class="row-actions wrap"><button class="ghost-btn small" data-action="auto-research" data-id="${safe(p.id)}">Research</button>${prices?`<button class="primary-btn small" data-action="trade" data-id="${safe(p.id)}">Plan bet ↗</button>`:''}${p.url?`<a href="${safe(p.url)}" target="_blank" rel="noopener noreferrer">Source ↗</a>`:''}</div></article>`;
    }).join('')||'<div class="empty-state"><h3>No games shown for these filters</h3><p>Try All sports or All upcoming. If the scanner retrieved zero events, check Settings → Cloudflare proxy.</p></div>';
  }
  if($('moreVisibleGames')){$('moreVisibleGames').hidden=visible.length<=resultLimit;$('moreVisibleGames').textContent=`Show more games (${Math.max(0,visible.length-resultLimit)} remaining)`;}
  const all=debug.rawMarkets.map(m=>m.sport||'Other');
  const counts=new Map();
  all.forEach(s=>counts.set(s,(counts.get(s)||0)+1));
  const sportList=[...fixed,...[...counts.keys()].filter(s=>!fixed.includes(s))];
  if($('sportFilters'))$('sportFilters').innerHTML=sportList.map(s=>`<button class="filter-chip ${s===selected?'active':''}" data-sport="${safe(s)}">${s==='All'?'All sports':safe(s)} <small>${s==='All'?all.length:counts.get(s)||0}</small></button>`).join('');
}
function init(){
 const more=$('loadMoreEvents');
 if(more)more.addEventListener('click',()=>loadPages(LOAD_MORE_PAGES,false));
 $('moreVisibleGames')?.addEventListener('click',()=>{resultLimit+=80;render();});
 $('gameTimeFilter')?.addEventListener('change',()=>{resultLimit=80;render();});
 document.addEventListener('click',event=>{
  const chip=event.target.closest('[data-sport]');
  if(chip){chosenSport=chip.dataset.sport;resultLimit=80;render();}
 });
 document.addEventListener('input',event=>{if(event.target.id==='gameSearch'||event.target.id==='browsePassed'){resultLimit=80;render();}});
}
window.EdgeV3={scan,render,loadMore:()=>loadPages(LOAD_MORE_PAGES,false),get coverage(){return {events:seen.size,markets:raw.size,pages:pageCount,hasMore:!ended,errors:[...errors],tag:baseTag}}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
