(function edgeboardV3(){
'use strict';
let busy=false, chosen='All';
const $=id=>document.getElementById(id);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kind=s=>({ncaaf:'NCAAF',cfb:'NCAAF','table-tennis':'Table Tennis','table_tennis':'Table Tennis',esports:'Esports',cs2:'Esports',lol:'Esports',valorant:'Esports',ufc:'UFC/MMA',mma:'UFC/MMA',atp:'Tennis',wta:'Tennis'}[String(s||'').toLowerCase()]||String(s||'Other').replace(/(^|[_-])([a-z])/g,(m,p,l)=>' '+l.toUpperCase()).trim());
const fixed=['All','Tennis','Table Tennis','Players','Esports','NFL','CFB','NBA','NCAAB','NHL','MLB','Soccer','UFC/MMA','F1'];
const slugs={Tennis:['tennis','atp','wta'],'Table Tennis':['table-tennis'],'Players':['tennis','table-tennis'],Esports:['esports','cs2','lol'],NFL:['nfl'],CFB:['ncaaf'],NBA:['nba'],NCAAB:['ncaab'],NHL:['nhl'],MLB:['mlb'],Soccer:['soccer'],'UFC/MMA':['ufc'],F1:['f1']};
function allow(p){return chosen==='All'||p.sport===chosen||(chosen==='CFB'&&p.sport==='NCAAF')||(chosen==='Players'&&['Tennis','Table Tennis','UFC/MMA'].includes(p.sport));}
function active(){return $('sportFilters')?.querySelector('.active')?.dataset.sport||chosen;}
function render(){
  const debug=window.EdgeboardDebug;if(!debug?.rawMarkets)return;
  const all=debug.rawMarkets.map(debug.screenOne);
  const visible=all.filter(p=>allow(p)&&p.open!==false&&(!p.start||+new Date(p.start)>=Date.now()||(p.live&&+new Date(p.start)>=Date.now()-8*3600000))).filter(p=>!$('browsePassed')?.checked||p.passed).filter(p=>!$('gameSearch')?.value||[p.sport,p.league,...(p.teams||[])].join(' ').toLowerCase().includes($('gameSearch').value.toLowerCase())).sort((a,b)=>(a.start?+new Date(a.start):Infinity)-(b.start?+new Date(b.start):Infinity));
  if($('browseCount'))$('browseCount').textContent=visible.length+' shown · '+all.length+' markets';
  if($('browseGames'))$('browseGames').innerHTML=visible.slice(0,90).map(p=>`<article class="browse-game"><div class="browse-head"><span>${safe(p.sport)} · ${safe(p.league)}</span><b class="${p.passed?'good':'neutral'}">${p.passed?'PASSES':'BROWSE'}</b></div><strong>${safe((p.teams||[]).join(' vs '))}</strong><p>${p.start?new Date(p.start).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Start time not verified'} · ${p.prices?.length===2?p.prices.map(n=>Number.isFinite(n)?(n*100).toFixed(1)+'%':'—').join(' / '):'Odds unavailable'}</p><p>${safe(p.errors?.length?p.errors.slice(0,2).join(' · '):'Meets current pick filters')}</p>${p.url?`<a href="${safe(p.url)}" target="_blank" rel="noopener noreferrer">View source ↗</a>`:''} <button class="primary-btn small" data-action="trade" data-id="${safe(p.id)}">Bet / open market ↗</button></article>`).join('')||'<div class="empty-state"><h3>No matching games</h3><p>Try All sports, a larger start window, or clear search. US matches may need the Cloudflare proxy.</p></div>';
  const sports=[...new Set([...fixed,...all.map(x=>x.sport)])];
  if($('sportFilters'))$('sportFilters').innerHTML=sports.map(s=>`<button class="filter-chip ${s===chosen?'active':''}" data-sport="${safe(s)}">${s==='All'?'All sports':safe(s)} <small>${s==='All'?all.length:all.filter(p=>s==='Players'?['Tennis','Table Tennis','UFC/MMA'].includes(p.sport):s==='CFB'?['CFB','NCAAF'].includes(p.sport):p.sport===s).length||''}</small></button>`).join('');
}
async function fetchFeed(url){const c=new AbortController(),t=setTimeout(()=>c.abort(),6500);try{const r=await fetch(url,{signal:c.signal,headers:{Accept:'application/json'},cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}finally{clearTimeout(t);}}
function adapt(ev,source,tag){
  const out={...ev};
  const sportTag=(tag&&tag!=='US'&&tag!=='sports')?tag:ev.seriesSlug||ev.tags?.find(t=>t.sport)?.sport?.slug||ev.tags?.find(t=>t.league)?.league?.slug||ev.subcategory||ev.category||ev.sport||'Other';
  out._sportGuess=kind(sportTag);
  if(source==='us'){
    out.gameStartTime=ev.gameStartTime||ev.eventDate||ev.startTime||null;
    out.markets=(ev.markets||[]).map(m=>{
      const x={...m},sides=Array.isArray(x.marketSides)?x.marketSides:[];
      const names=sides.map(s=>String(s.team?.name||s.description||s.identifier||'').trim());
      if(sides.length===2&&names.every(n=>n.length>1&&!/^(yes|no|draw)$/i.test(n))){
        x.outcomes=JSON.stringify(names);
        x.outcomePrices=JSON.stringify(sides.map(s=>s.price??s.quote?.value??null));
      }
      x.sportsMarketType=x.sportsMarketType||x.sportsMarketTypeV2||x.marketType;
      x.liquidityNum=x.liquidityNum??ev.liquidity??null;
      x.spread=x.spread??(typeof x.bestAskQuote?.value==='number'&&typeof x.bestBidQuote?.value==='number'?x.bestAskQuote.value-x.bestBidQuote.value:null);
      x.gameStartTime=x.gameStartTime||ev.eventDate||ev.startTime;
      return x;
    });
  }
  out._edgeSource=source;
  return out;
}
function list(v){return Array.isArray(v)?v:Array.isArray(v?.events)?v.events:Array.isArray(v?.data)?v.data:[];}
async function scan(){
  if(busy||!window.EdgeboardDebug)return;
  busy=true;const refresh=$('refreshBtn');if(refresh)refresh.disabled=true;
  const pill=$('connectionPill');if(pill)pill.textContent='● Loading';
  const info=$('feedNotice');if(info)info.textContent='Loading sports feeds… results appear as each request finishes.';
  const user=window.EdgeboardDebug.data;
  const proxy=String(user.settings.proxyUrl||'').trim().replace(/\/+$/,'');
  const gamma=proxy||'https://gamma-api.polymarket.com';
  const us=proxy?proxy+'/us':'https://gateway.polymarket.us';
  const age=new Date(Date.now()-8*3600000).toISOString();
  const gargs='active=true&closed=false&end_date_min='+encodeURIComponent(age)+'&order=endDate&ascending=true';
  const tags=chosen==='All'?['sports','tennis','table-tennis','esports','nfl','ncaaf','nba','ufc','soccer']:['sports',...(slugs[chosen]||[chosen.toLowerCase()])];
  const jobs=[{source:'us',tag:'US',url:us+'/v1/events?active=true&closed=false&limit=100&offset=0'},...(chosen==='All'?[{source:'us',tag:'US',url:us+'/v1/events?active=true&closed=false&limit=100&offset=100'}]:[{source:'us',tag:'US',url:us+'/v1/events?active=true&closed=false&limit=100&tagSlug='+encodeURIComponent((slugs[chosen]||[chosen.toLowerCase()])[0])}]),...[...new Set(tags)].map(tag=>({source:'gamma',tag,url:gamma+'/events?tag_slug='+encodeURIComponent(tag)+'&'+gargs+'&limit='+(tag==='sports'?160:75)}))];
  let i=0,finished=0,errors=[];
  const seenEvents=new Map(),normalise=window.EdgeboardDebug.normaliseEvent;
  function process(job,payload){
    for(const original of list(payload)){
      const key=job.source+':'+(original.id||original.slug);if(!original.id&&!original.slug)continue;
      if(!seenEvents.has(key))seenEvents.set(key,adapt(original,job.source,job.tag));
    }
    const markets=[];for(const event of seenEvents.values()){const items=normalise(event);
      if(!items.length&&Array.isArray(event.markets)&&event.markets.length){
        const hit=String(event.title||'').match(/^(.+?)\s+(?:vs\.?|versus|@)\s+(.+?)(?:\s*\([^)]*\))?$/i);
        if(hit&&event.closed!==true&&event.ended!==true){
          const m=event.markets.find(x=>/moneyline|winner|match/i.test(String(x.sportsMarketType||x.sportsMarketTypeV2||x.question||'')))||event.markets[0];
          items.push({id:'browse-'+event._edgeSource+'-'+String(event.id||event.slug),matchId:'browse-'+String(event.id||event.slug),sport:event._sportGuess||'Other',league:event.seriesSlug||event.category||'Sports',teams:[hit[1].trim(),hit[2].trim()],prices:[],liquidity:null,spread:null,start:event.gameStartTime||m.gameStartTime||event.eventDate||null,live:event.live===true,open:event.active!==false&&event.closed!==true&&m.closed!==true&&m.active!==false,url:event._edgeSource==='us'?'https://polymarket.us/sports/'+({NFL:'nfl',CFB:'cfb',NCAAF:'cfb',NBA:'nba',NHL:'nhl',MLB:'mlb',Tennis:'tennis','Table Tennis':'table-tennis',Esports:'esports',Soccer:'soccer','UFC/MMA':'mma',F1:'f1'}[event._sportGuess]||''):'https://polymarket.com/event/'+encodeURIComponent(event.slug||''),source:'browse',technicalReject:'Winner prices not verified — browse only'});
        }
      }
      if(event._edgeSource==='us')for(const market of items){const slug={NFL:'nfl',CFB:'cfb',NCAAF:'cfb',NBA:'nba',NHL:'nhl',MLB:'mlb',Tennis:'tennis','Table Tennis':'table-tennis',Esports:'esports',Soccer:'soccer','UFC/MMA':'mma',F1:'f1'}[market.sport||event._sportGuess]||'';let exact='';try{const u=new URL(String(event.canonicalUrl||event.url||event.eventUrl||''));if(u.hostname==='polymarket.us'&&u.protocol==='https:'&&u.pathname.startsWith('/sports/'))exact=u.href;}catch{}market.usMarketUrl=exact;market.usCategoryUrl='https://polymarket.us/'+(slug?'sports/'+slug:'');market.url=exact||market.usCategoryUrl;market.source='us';}markets.push(...items);}
    window.EdgeboardDebug.setMarkets(markets);
    render();
    if(info)info.textContent=seenEvents.size+' events checked · '+markets.length+' markets · '+finished+'/'+jobs.length+' feeds complete. All games also shows markets rejected by your pick rules.';
  }
  async function worker(){while(i<jobs.length){const job=jobs[i++];try{const x=await fetchFeed(job.url);finished++;process(job,x);}catch(e){finished++;errors.push(job.tag+': '+(e?.message||e));if(info)info.textContent=seenEvents.size+' events loaded · '+finished+'/'+jobs.length+' feeds checked · '+errors.length+' unavailable';}}}
  try{await Promise.all(Array.from({length:Math.min(5,jobs.length)},worker));if(pill)pill.textContent=seenEvents.size?'● Connected':'● No feed';
    if(info)info.textContent=seenEvents.size?`${seenEvents.size} sports events · ${window.EdgeboardDebug.rawMarkets.length} candidate markets. ${errors.length?'Some sources unavailable. ':''}All games includes rejected markets; qualified picks retain the strict rules.`:`No games returned. ${errors.slice(0,2).join(' · ')}. US events can require a Cloudflare proxy.`;
    if(info)info.className=errors.length?'notice warn':'notice';
  }finally{busy=false;if(refresh)refresh.disabled=false;}
}
window.EdgeV3={scan,render};
document.addEventListener('click',e=>{const button=e.target.closest('[data-sport],[data-window]');if(button)setTimeout(()=>{chosen=button.dataset.sport||chosen;render();if(button.dataset.sport)scan();},0);});
document.addEventListener('input',e=>{if(e.target.id==='gameSearch'||e.target.id==='browsePassed')render();});
})();
