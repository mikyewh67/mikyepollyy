(function HomeDashboard(){
'use strict';
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n)||0);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function funded(id,transfers){return transfers.filter(t=>t.goalId===id).reduce((sum,t)=>sum+(Number(t.amount)||0),0);}
function render(){
const state=window.EdgeboardDebug?.data;if(!state||!$('tab-home'))return;
const bets=Array.isArray(state.bets)?state.bets:[],transfers=Array.isArray(state.transfers)?state.transfers:[],goals=state.goals||[];
const placed=bets.reduce((s,b)=>s+(Number(b.stake)||0),0);
const settled=bets.filter(b=>b.status!=='pending'),returned=settled.reduce((s,b)=>s+(Number(b.payout)||0),0);
const settledStake=settled.reduce((s,b)=>s+(Number(b.stake)||0),0);
const totalTransfers=transfers.filter(t=>t.source==='bankroll').reduce((s,t)=>s+(Number(t.amount)||0),0);
const estimate=(Number(state.settings?.startingBankroll)||0)-placed+returned-totalTransfers;
const net=returned-settledStake;
const pending=bets.filter(b=>b.status==='pending');
$('homeBankroll').textContent=money(estimate);
$('homePL').textContent=(net>0?'+':'')+money(net);
$('homePL').className='home-metric '+(net>0?'positive':net<0?'negative':'');
$('homeWins').textContent=settled.filter(b=>b.status==='won').length+' won / '+settled.filter(b=>b.status==='lost').length+' lost';
$('homeOpen').textContent=String(pending.length);
$('homePendingList').innerHTML=pending.length?pending.slice().reverse().slice(0,4).map(b=>`<div class="home-active-row"><div><strong>${esc(b.matches)}</strong><small>${esc(b.sport)} · ${money(b.stake)} at ${Number(b.odds||0).toFixed(2)}×</small></div><span class="badge amber">PENDING</span></div>`).join(''):'<p class="helper">No active bets recorded. Add a wager after you actually place it on Polymarket.</p>';
const target=goals.reduce((s,g)=>s+(Number(g.target)||0),0);
const saved=goals.reduce((s,g)=>s+funded(g.id,transfers),0);
$('homeGoalTotal').textContent=money(saved)+' / '+money(target);
$('homeGoals').innerHTML=goals.map(g=>{const amount=funded(g.id,transfers),t=Number(g.target)||0,progress=t?Math.max(0,Math.min(100,amount/t*100)):100;return `<div class="home-goal-line"><div><strong>${esc(g.emoji)} ${esc(g.name)}</strong><small>${money(amount)} / ${money(t)} · ${Math.round(progress)}%</small></div><div class="home-goal-track"><span style="width:${progress}%"></span></div></div>`;}).join('');
const incoming=state.incoming||{},arrival=new Date((incoming.date||'2026-11-05')+'T12:00:00'),days=Math.ceil((+arrival-Date.now())/86400000);
$('homeIncoming').textContent=incoming.received?'Payment received and allocated':`${money(incoming.amount||900)} expected ${arrival.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})} · ${days>0?days+' days away':days===0?'due today':'not yet confirmed received'}`;
$('homeSync').textContent=state.settings?.sheetsUrl?'Google Sheets configured — sync when app is open':'Google Sheets not connected yet';
$('homeAlert').textContent=state.settings?.alerts?'🔔 Alerts on':'🔕 Enable alerts';
}
async function enableAlerts(){
const state=window.EdgeboardDebug?.data;if(!state)return;
if(state.settings.alerts){state.settings.alerts=false;}
else{if(!('Notification'in window)){alert('System notifications are not available in this browser. In-app updates work while Edgeboard is open.');return;}
if(Notification.permission!=='granted'){const permission=await Notification.requestPermission().catch(()=>null);if(permission!=='granted'){alert('Notifications were not allowed. Change browser notification permissions to enable alerts.');return;}}
state.settings.alerts=true;
}
try{localStorage.setItem('edgeboard-v1',JSON.stringify(state))}catch{}
render();
}
function init(){
if(!$('tab-home'))return;
$('homeAlert')?.addEventListener('click',enableAlerts);
document.addEventListener('edgeboard:updated',render);
document.addEventListener('edgeboard:feed-updated',render);
window.addEventListener('focus',render);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
render();
}
window.EdgeboardHome={render};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
