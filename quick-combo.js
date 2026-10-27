(function QuickComboModule(){
  'use strict';
  const $=id=>document.getElementById(id);
  const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtUSD=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n)||0);
  const pct=n=>(Number(n)*100).toFixed(1)+'%';
  const timestamp=()=>Date.now();
  const timeString=s=>new Date(s).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'});
  const sports=['All','Tennis','Table Tennis','Esports','NFL','CFB','NBA','NCAAB','NHL','MLB','Soccer','UFC/MMA','F1','Other'];
  let proposals=[],generatedAt=0;
  const data=()=>window.EdgeboardDebug?.data||null;
  function marketSource(m){try{const u=new URL(m.url||'');return /(^|\.)polymarket\.us$/.test(u.hostname)?'US venue':'international reference'}catch{return 'no verified market URL'}}
  function eligibleMarkets(){
    const debug=window.EdgeboardDebug;if(!debug)return [];
    const all=Array.isArray(debug.passed)?debug.passed:[];
    const chosen=$('qcSport')?.value||'All';
    const horizon=(Number(data()?.settings?.window)||3)*3600000,now=timestamp();
    return all.filter(m=>{
      const sp=String(m.sport||'');
      if(chosen!=='All' && (chosen==='CFB'?!['NCAAF','CFB'].includes(sp):sp!==chosen))return false;
      if(!m.open||!m.passed||m.teams?.length!==2||m.prices?.length!==2||m.unverified)return false;
      const sel=Number.isInteger(m.selectedSide)?m.selectedSide:m.favorite;
      if(sel!==0 && sel!==1)return false;
      const price=m.prices[sel];
      if(!(price>0&&price<1))return false;
      const st=+new Date(m.start);
      return Number.isFinite(st)&&st>=now&&st<=now+horizon;
    }).sort((a,b)=>{
      const researchA=Number(a.edge>0),researchB=Number(b.edge>0);
      const tA=+new Date(a.start),tB=+new Date(b.start);
      return researchB-researchA||tA-tB||((b.liquidity||0)-(a.liquidity||0));
    }).slice(0,24);
  }
  function generate(){
    const markets=eligibleMarkets(),maxDepth=5,minTarget=3,maxTarget=5;
    const suggestions=[], seen=new Set(),maxCandidates=4000;
    function go(legs,next,prob){
      if(suggestions.length>maxCandidates)return;
      if(legs.length>=2){
        const multiplier=1/prob;
        if(multiplier>=minTarget&&multiplier<=maxTarget){
          const age=legs.reduce((sum,p)=>sum+(+new Date(p.start)-timestamp())/3600000,0)/legs.length;
          const userResearched=legs.filter(p=>p.edge>0).length;
          const averageQuality=legs.reduce((s,p)=>s+(p.confidence==='High'?1:p.confidence==='Med'?.5:0),0)/legs.length;
          const hasUSPrice=legs.filter(m=>m.source==='us'||String(m.url||'').includes('polymarket.us')).length;
          const score=Math.abs(Math.log(multiplier/3.6))*5 + legs.length*.15 + age*.22 - userResearched*.12 - averageQuality*.25 - hasUSPrice*.08;
          suggestions.push({id:legs.map(m=>m.id).sort().join('|'),legs:[...legs],multiplier,impliedProbability:prob,score,userResearched,hasUSPrice});
        }
      }
      if(legs.length>=maxDepth||prob<1/maxTarget)return;
      for(let i=next;i<markets.length;i++){
        const market=markets[i];
        if(legs.some(m=>m.matchId===market.matchId))continue;
        const p=market.prices[market.selectedSide];
        if(prob*p<1/maxTarget)continue;
        go([...legs,market],i+1,prob*p);
      }
    }
    go([],0,1);
    suggestions.sort((a,b)=>a.score-b.score);
    const result=[];
    for(const s of suggestions){
      if(result.length>=3)break;
      if(result.some(x=>x.legs.length===s.legs.length&&x.legs.filter(a=>s.legs.some(b=>a.matchId===b.matchId)).length>=s.legs.length-1))continue;
      if(seen.has(s.id))continue;
      seen.add(s.id);
      result.push(s);
    }
    return {markets,proposals:result};
  }
  function display(){
    const {markets,proposals:found}=generate();
    proposals=found;generatedAt=timestamp();
    const state=$('qcState'),box=$('qcResults');
    if(!state||!box)return;
    state.textContent=`${markets.length} eligible, pregame markets · ${found.length} draft combo${found.length===1?'':'s'} found · ${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`;
    const options=data()?.settings||{};
    const stake=Number(options.staking==='branch'?options.branchStake:options.flatStake)||5;
    if(!found.length){
      box.innerHTML=`<div class="empty-state"><h3>No verified ${escapeHTML($('qcSport')?.value||'')} combo matches 3–5× in this window</h3><p>Try All sports or extend the Picks start window. No matches or odds are invented. Check connection status and the Rejected list.</p></div>`;
      return;
    }
    box.innerHTML=found.map((s,i)=>{
      const ordered=[...s.legs].sort((a,b)=>+new Date(a.start)-+new Date(b.start));
      const places=ordered.map((m,k)=>{
        const side=m.selectedSide;
        const price=m.prices[side];
        const research=(m.modelP!==null&&m.edge>0)?`User-provided estimate ${pct(m.modelP)}; not independently verified`:'Market favorite only — research still needed';
        return `<div class="qc-leg"><span class="qc-number">${k+1}</span><div><strong>${escapeHTML(m.teams[side])} to win</strong><small>${escapeHTML(m.teams.join(' vs '))} · ${escapeHTML(m.sport)} · ${escapeHTML(timeString(m.start))}</small><small>${escapeHTML(research)} · ${escapeHTML(marketSource(m))}</small></div><span class="qc-odds">${(1/price).toFixed(2)}×</span></div>`;
      }).join('');
      return `<article class="qc-card"><div class="qc-head"><div><small>COMBO DRAFT ${i+1} · ${ordered.length} LEGS</small><h3>≈ ${s.multiplier.toFixed(2)}× <span class="qc-caveat">indicative</span></h3></div><span>${fmtUSD(stake)} → ${fmtUSD(stake*s.multiplier)}</span></div><div class="qc-legs">${places}</div><p class="helper">Quote-product implied chance ≈ ${pct(s.impliedProbability)} (assumes independent legs). This is not a validated true win probability or an executable Polymarket US quote. ${s.userResearched}/${s.legs.length} legs have a user-entered favorable research estimate.</p><div class="row-actions wrap"><button class="ghost-btn small" data-qc-copy="${i}">Copy all picks</button><button class="ghost-btn small" data-qc-log="${i}">Log an actual placed combo</button><a class="primary-btn small" href="https://polymarket.us/" target="_blank" rel="noopener noreferrer">Open Polymarket US ↗</a></div></article>`;
    }).join('');
  }
  async function copy(i){
    const s=proposals[i];if(!s)return;
    const lines=s.legs.map((m,n)=>`${n+1}. ${m.teams[m.selectedSide]} to win — ${m.teams.join(' vs ')} — ${m.sport} — ${timeString(m.start)} — reference ${(1/m.prices[m.selectedSide]).toFixed(2)}x`);
    const txt=`EDGEB0ARD QUICK COMBO — DRAFT, NOT A BET\n${lines.join('\n')}\nApprox ${s.multiplier.toFixed(2)}x from market-price product, not a native quote. Open Polymarket US app → Build a Combo → find these markets and verify each side and live quote.`;
    try{await navigator.clipboard.writeText(txt);$('qcState').textContent='Draft picks copied. Verify all legs in the Polymarket US app.';}catch{$('qcState').textContent=txt;}
  }
  function record(i){
    const s=proposals[i];if(!s)return;
    const cfg=data()?.settings||{},stake=Number(cfg.staking==='branch'?cfg.branchStake:cfg.flatStake)||5;
    if(!confirm('Only continue if you actually placed a native combo on Polymarket US. You must correct the stake and multiplier to your accepted fill. Continue to tracker?'))return;
    const log=window.EdgeboardDebug?.openComboLog;
    if(log)log(s,stake);
    else document.getElementById('manualLog')?.click();
  }
  function init(){
    if(!$('qcBuild'))return;
    const sport=$('qcSport');
    if(sport)sport.innerHTML=sports.map(x=>`<option value="${escapeHTML(x)}">${escapeHTML(x)}</option>`).join('');
    $('qcBuild').addEventListener('click',display);
    $('qcSport')?.addEventListener('change',display);
    document.addEventListener('click',e=>{
      const cp=e.target.closest('[data-qc-copy]');
      if(cp){copy(Number(cp.dataset.qcCopy));return;}
      const lg=e.target.closest('[data-qc-log]');
      if(lg)record(Number(lg.dataset.qcLog));
    });
    document.addEventListener('edgeboard:feed-updated',()=>{if(generatedAt)display();});
  }
  window.EdgeboardQuickCombo={generate,display,get proposals(){return proposals;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
