(function TradeDesk(){
  'use strict';
  const $=id=>document.getElementById(id);
  const fmt=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
  const cats={NFL:'nfl',CFB:'cfb',NCAAF:'cfb',NBA:'nba',NHL:'nhl',MLB:'mlb',Tennis:'tennis','Table Tennis':'table-tennis',Esports:'esports',Soccer:'soccer','UFC/MMA':'mma',F1:'f1'};
  const good=x=>{try{const u=new URL(x);return u.protocol==='https:'&&u.hostname==='polymarket.us'?u.href:''}catch{return''}};
  let active=null,mode='MANUAL';
  function source(m){
    const exact=good(m.usMarketUrl)||((m.source==='us'&&String(m.url||'').match(/^https:\/\/polymarket\.us\/sports\/[^/]+\/.+$/))?good(m.url):'');
    const section=good(m.usCategoryUrl)||'https://polymarket.us/'+(cats[m.sport]?'sports/'+cats[m.sport]:'');
    return {href:exact||section,exact:!!exact};
  }
  function value(){const ix=Number($('tradeSide').value),price=Number($('tradePrice').value)/100,stake=Number($('tradeStake').value);return {ix,price,stake,valid:!!active&&ix>=0&&ix<2&&price>0&&price<1&&stake>0&&Number.isFinite(stake)};}
  function calc(){const c=value();$('tradeGross').textContent=c.valid?fmt(c.stake/c.price):'—';$('tradeNet').textContent=c.valid?fmt(c.stake/c.price-c.stake):'—';}
  function show(m,ix=null,stake=null,betMode='MANUAL'){
    if(!m||m.teams?.length!==2)return;
    active=m;mode=betMode;
    let side=Number.isInteger(ix)?ix:Number.isInteger(m.selectedSide)?m.selectedSide:Number.isInteger(m.favorite)?m.favorite:0;
    side=Math.max(0,Math.min(1,side));
    $('tradeHeading').textContent=m.sport+' · Bet ticket';
    $('tradeMatch').textContent=m.teams.join(' vs ');
    $('tradeVenue').textContent=m.start?'Start: '+new Date(m.start).toLocaleString():'Start time not verified';
    $('tradeSide').replaceChildren(...m.teams.map((name,i)=>{const el=document.createElement('option');el.value=String(i);el.textContent=name;return el;}));
    $('tradeSide').value=String(side);
    $('tradeStake').value=Number(stake||window.EdgeboardDebug?.data?.settings?.flatStake||5).toFixed(2);
    const price=Number(m.prices?.[side]);$('tradePrice').value=price>0&&price<1?(price*100).toFixed(1):'';
    const url=source(m);$('openTradeVenue').href=url.href;$('openTradeVenue').textContent=url.exact?'Open matching US event ↗':'Browse sport on Polymarket US ↗';
    $('tradeBrowseNotice').textContent=url.exact?'Verify this winner market and live price on Polymarket US.':'This opens the US sport listing, NOT the exact match. Locate the same competitors before trading. International .com prices and US prices may differ.';
    $('tradeDialog').showModal();calc();
  }
  function byId(id){const d=window.EdgeboardDebug;const raw=[...(d?.rawMarkets||[]),...(d?.data?.manual||[])].find(m=>m.id===id);return raw?d.screenOne(raw):null;}
  function openMarket(id){const m=byId(id);if(m)show(m);}
  function openCombo(index,legIndex){const d=window.EdgeboardDebug,c=d?.combos?.[index],m=c?.legs?.[legIndex];if(!m)return;let amount=Number(d.data.settings.staking==='branch'?d.data.settings.branchStake:d.data.settings.flatStake);for(let i=0;i<legIndex;i++){const p=c.legs[i].prices[c.legs[i].selectedSide];if(!(p>0))return;amount/=p;}show(m,m.selectedSide,amount,c.mode);$('tradeBrowseNotice').textContent+=' Rollover stakes are illustrative. You must wait until each earlier leg settles before funding the next.';}
  function log(){const c=value();if(!c.valid)return alert('Enter a valid side, stake and price.');$('tradeDialog').close();window.EdgeboardDebug?.openWagerLog?.({...active,selectedSide:c.ix},c.stake,c.price,mode);}
  function ticket(){const c=value();if(!c.valid)return '';return `EDGEBOARD TICKET — NOT AN ORDER\n${active.teams.join(' vs ')}\nSide: ${active.teams[c.ix]}\nPlanned stake: ${fmt(c.stake)}\nEntered price: ${(c.price*100).toFixed(1)} cents\nIllustrative gross: ${fmt(c.stake/c.price)}\nPolymarket US: ${source(active).href}\nConfirm the exact market, live quote, rules, fees and eligibility before submitting.`;}
  function init(){
    if(!$('tradeDialog'))return;
    $('closeTrade').addEventListener('click',()=>$('tradeDialog').close());
    $('tradeSide').addEventListener('change',()=>{const p=active?.prices?.[Number($('tradeSide').value)];$('tradePrice').value=p>0&&p<1?(p*100).toFixed(1):'';calc();});
    $('tradeStake').addEventListener('input',calc);
    $('tradePrice').addEventListener('input',calc);
    $('confirmTradeLogged').addEventListener('click',log);
    $('copyTrade').addEventListener('click',async()=>{const t=ticket();if(!t)return alert('Enter valid ticket details.');try{await navigator.clipboard.writeText(t);$('copyTrade').textContent='Copied';setTimeout(()=>$('copyTrade').textContent='Copy ticket',1600)}catch{alert(t)}});
  }
  window.EdgeboardTrade={openMarket,openCombo,source};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
