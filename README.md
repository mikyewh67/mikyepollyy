# Edgeboard · Personal Polymarket Companion

Five simple tabs: **Home · Games · Combos · My Bets · Goals**. A small gear in the header opens Settings.

## Your defaults
- Estimated starting bankroll: **$25**
- Fixed stake: **$5**; optional branching starting at **$1**
- Savings: **iPhone $1,100**, **shopping $800**, **Big Bear $1,200** (total **$3,100**)
- Incoming crypto payment: **$900 expected November 5, 2026**; not counted until you manually mark it received.

## What each screen does

**Home:** Estimated bankroll (based on entries, not your live account), settled P/L, active bets, goal progress and the Make Me a Combo button.

**Games:** Live/soon-to-start Polymarket markets with sport, competitors, start time and price. Search by sport/team/player. Sports are discovered from the feeds; listings are not guaranteed exhaustive. Prices may be indicative and different from your available executable US quote.

**Combos:** Choose sport and approximately **2×, 3×, 4× or 5×**. The app combines prices from eligible markets and displays competitors, start times and a rough combined payout. A draft is **not a native Combo order**; find and verify the actual supported ticket and payout in Polymarket US. "Conditional rollover simulator" is optional and assumes earlier wagers settle before the next leg is funded.

**My Bets:** Enter a wager only **after you really placed it**. Record its actual stake, actual filled multiplier and selections. Follow pending/won/lost/cashed-out status, net P/L, performance charts and bankroll. Gamma-linked single wagers can sometimes be auto-settled; **native Combos and unlinked markets must be reconciled manually**. The app cannot see your Polymarket US account without authenticated integration.

**Goals:** Track money actually moved to savings; edit targets and allocate the November 5 payment when received. The $25 bankroll, unsettled winnings and $900 expected payment are not the same cash bucket.

**Research:** Tap **Recent results** for independently retrieved last 5/10/20 and head-to-head stats on ESPN-covered team sports (NBA, NFL, CFB, etc.). Coverage is unofficial and incomplete. Tennis/table tennis/esports need dedicated dependable sources. The app never invents true win probabilities, injuries, injuries news, Elo or an edge when the data are missing. You can enter your own research estimate, clearly identified as user input.

## Notifications

Enable on **Home → Enable alerts** and grant your browser notification permission. New matching-market alerts are in-browser and may be shown while Edgeboard is open/active. Static GitHub Pages cannot deliver guaranteed background iPhone/Telegram push notifications when the app is closed. Those require a separate server/Telegram Bot/push service.

## Google Sheets (bet ledger, winnings and losses)

You can back up your recorded **Bets, Summary, Goals and Transfers** to a Google Sheet. This is one-way sync, not a verified Polymarket transaction feed. Each snapshot replaces the current rows rather than duplicating bets.

1. Open [Google Sheets](https://sheets.google.com) and create a **new, private sheet** named **Edgeboard Bets**.
2. In the sheet choose **Extensions → Apps Script**.
3. Remove the example code. Copy the complete repository file **`sheets.gs`** into the editor and save.
4. Click the **Project Settings** gear → **Script properties** → **Add script property**. Name it `BACKUP_TOKEN` and use a **private random string at least 12 characters**.
5. Choose **Deploy → New deployment → Web app**. Select **Execute as Me** and **Who has access: Anyone**. Authorize the script and deploy.
6. Copy its complete HTTPS **/exec** URL. In Edgeboard, open the **gear → Google Sheets & data connections**. Paste the URL and the **same private token**. Press **Save settings**.
7. Open **My Bets → Send to Sheets**. Open your Google Sheet and check the generated **Bets**, **Summary**, **Goals** and **Transfers** tabs.
8. After the initial setup, saves to Edgeboard send a **debounced sync request** while the app is open and online. Because the Google Apps Script endpoint doesn't expose a readable browser acknowledgement, check the Sheet to confirm it succeeded. Export JSON backups periodically.

**Privacy:** The GitHub source is public. Keep the token out of your repository. Anyone with both your endpoint URL and private token can submit updates to that Sheet. Only use the receiver with a sheet you control. Data are also stored locally; uninstalling or clearing browser data may erase local state.

## Browser-only GitHub Pages deployment

1. Extract the GitHub project ZIP.
2. Open the target public GitHub repository in a Chromebook browser → **Add file → Upload files**.
3. Upload all root app files, including `index.html`, `app.js`, `style.css`, `fast-feed.js`, `quick-combo.js`, `trade.js`, `home.js`, `research-lite.js`, `manifest.webmanifest`, `sw.js` and the three PNG icons. You may upload the extra source scripts and README too.
4. Commit changes. Open **Settings → Pages** → branch **main** and folder **/(root)**.
5. Visit the Pages URL and hard refresh on Chromebook with **Ctrl + Shift + R**. If an installed PWA holds an old shell, close it, open the website in Safari, and reload.
6. Optional API CORS workaround: use the included **worker.js** in Cloudflare Workers, deploy it, and set its HTTPS `*.workers.dev` base URL in the app's gear settings. Re-deploy the Worker after changes to `worker.js`.

## Known limits

- Public sports data sources may not cover every active event. An empty list can mean API or filtering problems, not necessarily no games.
- Odds imply a *market price*, not a validated forecast. Selecting the biggest favorite is not evidence of a profitable edge.
- Native Combo payout and eligible legs must be verified on Polymarket US. Product-of-prices estimates do not account for dependence, fees or fill differences.
- This app does not place, authenticate, or confirm any bet. Only enter actual placed transactions into the tracker; do not mark suggestions as real wagers.
- Spreadsheet one-way sync requires the user-owned Apps Script deployment above.
