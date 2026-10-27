/**
 * Edgeboard -> Google Sheets (personal one-way sync)
 * Create a Google Sheet, Extensions > Apps Script, replace the script with this file.
 * In Apps Script Project Settings > Script properties set BACKUP_TOKEN to a long private token.
 * Deploy > New deployment > Web app: Execute as Me; Access: Anyone.
 * Paste the /exec URL and the same token into Edgeboard > Settings.
 * GitHub Pages cannot run this server-side Apps Script for you.
 * Never put the token in the public GitHub repository.
 */
function doGet() {
  return ContentService.createTextOutput('Edgeboard Sheet receiver online; POST required');
}
function doPost(e) {
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(15000))return response_('busy');
  try{
    var expected=PropertiesService.getScriptProperties().getProperty('BACKUP_TOKEN');
    var received=e&&e.parameter&&String(e.parameter.token||'');
    if(!expected||expected.length<12||received!==expected)return response_('unauthorized');
    if(e.parameter.action!=='backup')return response_('unsupported');
    var body=String(e.parameter.payload||'');
    if(body.length>850000)return response_('payload too large');
    var info=JSON.parse(body);
    if(!Array.isArray(info.bets)||!Array.isArray(info.goals)||!Array.isArray(info.transfers))return response_('invalid payload');
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    if(!ss)return response_('not bound to a spreadsheet');
    var bets=info.bets||[],goals=info.goals||[],transfers=info.transfers||[],start=Number(info.settings&&info.settings.startingBankroll)||0;
    var totalBet=0,returned=0,closedStake=0,wins=0,losses=0,cashouts=0,settledNet=0;
    var pending=0;
    var betRows=bets.map(function(b){
      var stake=num_(b.stake),payout=num_(b.payout),status=String(b.status||'pending');
      totalBet+=stake;
      if(status==='pending')pending++;
      else{closedStake+=stake;returned+=payout;settledNet+=payout-stake;if(status==='won')wins++;if(status==='lost')losses++;if(status==='cashed_out')cashouts++;}
      return [safe_(b.id),safe_(b.date),safe_(b.settledAt),safe_(b.sport),safe_(b.matches),safe_(b.mode),stake,num_(b.odds),status,payout,status==='pending'?'':round_(payout-stake),safe_(b.marketId),safe_(b.branchId)];
    });
    var moves=transfers.map(function(t){return[safe_(t.date),safe_(t.goalId),num_(t.amount),safe_(t.source),safe_(t.reason),safe_(t.betId)];});
    var goalRows=goals.map(function(g){
      var paid=transfers.filter(function(t){return t.goalId===g.id;}).reduce(function(sum,t){return sum+num_(t.amount);},0);
      return[safe_(g.id),safe_(g.name),num_(g.target),round_(paid),round_(Math.max(0,num_(g.target)-paid)),num_(g.target)>0?round_(paid/num_(g.target)*100):100];
    });
    var bankMoves=transfers.filter(function(t){return t.source==='bankroll';}).reduce(function(sum,t){return sum+num_(t.amount);},0);
    var bankroll=start-totalBet+returned-bankMoves;
    var goalTarget=goalRows.reduce(function(s,r){return s+r[2];},0);
    var goalSaved=goalRows.reduce(function(s,r){return s+r[3];},0);
    var summary=[
      ['Last sync (UTC)',new Date().toISOString()],['Starting bankroll',start],['Estimated bankroll',round_(bankroll)],
      ['Wagers recorded',bets.length],['Pending wagers',pending],['Won wagers',wins],['Lost wagers',losses],['Cashed out wagers',cashouts],
      ['Total staked',round_(totalBet)],['Gross payouts received',round_(returned)],['Realized net P/L',round_(settledNet)],
      ['ROI on settled stakes (%)',closedStake?round_(settledNet/closedStake*100):0],
      ['Win rate on won/lost bets (%)',wins+losses?round_(wins/(wins+losses)*100):0],
      ['Goals saved',round_(goalSaved)],['Goal target',round_(goalTarget)],
      ['Expected crypto payment',num_(info.incoming&&info.incoming.amount)],['Payment date',safe_(info.incoming&&info.incoming.date)],
      ['Payment received',!!(info.incoming&&info.incoming.received)?'Yes':'No']
    ];
    table_(ss,'Bets',['ID','Placed (UTC)','Settled (UTC)','Sport','Selection(s)','Mode','Stake ($)','Multiplier','Status','Payout ($)','Net P/L ($)','Market ID','Branch ID'],betRows);
    table_(ss,'Goals',['Goal ID','Goal','Target ($)','Saved ($)','Remaining ($)','Progress (%)'],goalRows);
    table_(ss,'Transfers',['Date (UTC)','Goal ID','Amount ($)','Source','Reason','Related bet'],moves);
    table_(ss,'Summary',['Metric','Value'],summary);
    return response_('updated '+bets.length+' bets');
  }catch(error){return response_('error: '+String(error&&error.message||error));}
  finally{lock.releaseLock();}
}
function num_(value){var x=Number(value);return isFinite(x)?x:0;}
function round_(value){return Math.round((num_(value)+Number.EPSILON)*100)/100;}
function safe_(value){var s=String(value==null?'':value);return /^[=+@-]/.test(s)?"'"+s:s.slice(0,3000);}
function table_(ss,name,header,rows){
  var sheet=ss.getSheetByName(name)||ss.insertSheet(name),width=header.length;
  if(sheet.getMaxColumns()<width)sheet.insertColumnsAfter(sheet.getMaxColumns(),width-sheet.getMaxColumns());
  var needed=Math.max(2,rows.length+1);
  if(sheet.getMaxRows()<needed)sheet.insertRowsAfter(sheet.getMaxRows(),needed-sheet.getMaxRows());
  sheet.clearContents();
  sheet.getRange(1,1,1,width).setValues([header]).setFontWeight('bold').setBackground('#17263d').setFontColor('#ffffff');
  if(rows.length)sheet.getRange(2,1,rows.length,width).setValues(rows);
  sheet.setFrozenRows(1);
  if(sheet.getFilter())sheet.getFilter().remove();
  sheet.getRange(1,1,Math.max(2,rows.length+1),width).createFilter();
  sheet.autoResizeColumns(1,Math.min(width,12));
  if(name==='Bets')sheet.getRange(2,7,Math.max(1,rows.length),1).setNumberFormat('$#,##0.00');
}
function response_(text){return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.TEXT);}
