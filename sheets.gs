/* Optional ONE-WAY backup to a private Google Sheet.
 * 1. In your Sheet choose Extensions > Apps Script.
 * 2. Paste all this code; choose Project Settings > Script properties.
 * 3. Add BACKUP_TOKEN with the same random token set in Edgeboard Settings.
 * 4. Deploy > New deployment > Web app, Execute as: Me, Who has access: Anyone.
 * 5. Copy its /exec URL into Edgeboard Settings.
 * Note: Anyone with your endpoint URL AND token can write backups.
 */
function doPost(e) {
  try {
    var expected=PropertiesService.getScriptProperties().getProperty('BACKUP_TOKEN');
    var received=e&&e.parameter&&e.parameter.token;
    if (!expected || !received || received !== expected) return respond('Unauthorized');
    if (e.parameter.action !== 'backup') return respond('Unsupported');
    var raw=e.parameter.payload||'';
    if (raw.length>1000000) return respond('Too large');
    var payload=JSON.parse(raw);
    if (!Array.isArray(payload.bets) || !Array.isArray(payload.goals)) return respond('Bad format');
    var lock=LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      var sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Edgeboard Backups');
      if (!sheet) {
        sheet=SpreadsheetApp.getActiveSpreadsheet().insertSheet('Edgeboard Backups');
        sheet.appendRow(['Time (UTC)','Number of bets','Number of transfers','Snapshot JSON']);
      }
      sheet.appendRow([new Date(),payload.bets.length,(payload.transfers||[]).length,raw]);
    } finally {lock.releaseLock();}
    return respond('Backup stored');
  } catch(error) {return respond('Failed: '+error.message);}
}
function doGet(e) {return respond('Edgeboard backup service: POST only');}
function respond(message) {return ContentService.createTextOutput(message).setMimeType(ContentService.MimeType.TEXT);}
