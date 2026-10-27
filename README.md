# Edgeboard — Polymarket Sports Market Scanner

A complete static, mobile-first PWA with five tabs: Picks, Combos, Tracker, Goals, Settings. It never connects to a wallet, signs orders, or places bets. Written in plain HTML, CSS, and JavaScript; no npm, backend, or terminal required.

## File-by-file contents

**Upload these eight files to the GitHub repository root:**

- `index.html` — complete five-tab UI, paste box, modal, Telegram Mini App loader.
- `style.css` — complete mobile-first dark theme, responsive layout.
- `app.js` — Gamma API scanner, strict filters, combo scenarios, records, charts, goals, alerts, browser storage, exports/imports.
- `manifest.webmanifest` — PWA install information.
- `sw.js` — offline static-asset cache.
- `icon-192.png` — install icon.
- `icon-512.png` — large install icon.
- `apple-touch-icon.png` — iPhone icon.

**Do not upload these optional setup files to the Pages root unless you want them publicly visible:**

- `worker.js` — standalone Cloudflare Worker proxy for Gamma JSON requests.
- `sheets.gs` — optional Apps Script source for private Google Sheets backup.
- `README.md` — these instructions (fine to upload; not required).

All source code is present, complete, and editable. There is no build step.

## GitHub Pages — Chromebook / browser only

1. Sign in to `github.com` and open **New repository** from the **+** menu.
2. Choose **Public** and name it **`YOUR_GITHUB_USERNAME.github.io`** if you want the short personal-site URL. *Example:* if your GitHub username is `mikyewh67`, use `mikyewh67.github.io`. A project repo such as `polymarket-sports-picks` also works and will have a `/polymarket-sports-picks/` path.
3. Check **Add a README** so the `main` branch exists. Click **Create repository**.
4. Click **Add file → Upload files**. Unzip the source archive in ChromeOS Files first. Select the **eight root app files** listed above (not the zip itself). Click **Commit changes**.
5. Go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, branch **`main`**, folder **`/(root)`**, then **Save**.
6. Open **Settings → Pages → Visit site** after the deployment finishes. Refresh once if it shows an old version.
7. Use **Picks → ↻** to load open markets. If the API is blocked, deploy the Worker below.

**iPhone installation:** In Safari, open the published HTTPS site; tap **Share → Add to Home Screen → Add**. This installs the PWA UI. Data are stored locally in that browser's storage and are **not automatically synced** between Safari, the installed iPhone app and Telegram. Export JSON often.

## Cloudflare Worker proxy — no terminal

1. Sign in to `dash.cloudflare.com`, open **Workers & Pages → Create application → Create Worker → Deploy**. If the dashboard shows **Start with Hello World**, use that option.
2. Open the new Worker and choose **Edit code** / **Quick edit**.
3. Delete the starter script; paste **all of** `worker.js` into the editor, then click **Deploy / Save and deploy**.
4. Copy its HTTPS **`*.workers.dev`** URL, without a trailing slash.
5. In **Edgeboard → Settings → Connections**, paste the URL into **Cloudflare Worker base URL**; click **Save settings**, then return to **Picks → ↻**.
6. Test the Worker manually by opening its URL followed by `/sports` in a Chrome tab. You should see JSON if Gamma is reachable.

This is a restricted read-only proxy with CORS headers. It does not need an API key or payment method on the Workers Free tier (subject to Cloudflare's free quotas). If upstream limits you, use Paste markets; the app never fabricates live prices.

## Paste markets — backup mode

Go to **Picks → + Paste markets**, then paste one per line:

```text
Tennis | Red Player vs Blue Player | 2026-10-27 20:00 | 79/21 | 15000 | 0.01 | https://polymarket.com/event/example-slug
NBA | Red Team vs Blue Team | 2026-10-27 21:30 | 83/17 | 25000 | 0.015
```

Those lines are **format examples only**, not real matches or live betting opportunities. Enter a **real match**, **local date/time**, both prices, and ideally its live liquidity/spread. Use `%` values (`79/21`) or decimal prices (`0.79/0.21`). Spread is the decimal dollar-per-share difference (for example, `0.01` = 1 cent). Liquidity, spread and link may be blank; missing quote-quality inputs get `UNVERIFIED` and are excluded from SAFE. All manual quotes are user provided and not automatically verified.

The app requires a known game-start time and only accepts live matches if the data explicitly calls them live, the market is still open and its start was within the last eight hours. Soccer three-way markets/draws are excluded. You can edit thresholds and the 1/3/6/12/24-hour window in Settings/Picks.

## Combos — important practical limitation

**These are conditional rollover scenarios, not bets and not a native Polymarket combo ticket.** The projected multiplier assumes every leg wins **and its gross proceeds become available before the next leg's market closes**. Simultaneous match starts typically make such a payout impossible to execute with a single initial stake. Edgeboard flags risky timing. If you independently stake each leg upfront, the returns **do not multiply**. Actual buy prices, payout delays, fees, limits, order fills, and correlations are not modelled.

The "probability" shown is the **product of market-implied prices under an independence assumption**, not a validated forecast. **True winning chance and real expected value cannot be determined from public Gamma prices alone.** SAFE, BALANCED and AGGRESSIVE are payout-target/scanning presets, not guarantees. Before a wager, compare prices and read the contract's resolution terms on the actual available Polymarket site.

The **Log** buttons open a local manual entry form. Only press **Save wager** if you really placed the wager. Settlement checks operate conservatively on **linked individual Gamma market IDs** and use an estimated return; confirm the actual paid amount by editing the record. No authenticated auto-settlement of an arbitrary multi-bet rollover, cash-out, or wallet history is possible with this anonymous static site.

## Tracker, Goals, branching

- Track amount staked, amount returned, net realized P/L, ROI on settled bets, streaks, bankroll, weekly performance and grouped win rates.
- Branch mode: Settings → Staking system → Branching → Save settings; Tracker → Create root branch. Record the root bet manually. On a confirmed win, child allocations are created from its recorded gross return; log each actual child bet independently. Unplaced child budgets are not real wagers and do not change your balance.
- A **positive cash-out profit** entered in the tracker automatically creates **bookkeeping transfers to the three goals** using the current November-payment split weights. This subtracts those transfers from the estimated bankroll; no bank/crypto transfer is executed. Editing/deleting that cashout reverses the linked automatic goal records.
- Incoming $900 expected on **November 5, 2026** only credits goals **after you mark it received**. Edit the distribution so it adds to exactly $900 first; it will never be credited just because the calendar date passed.
- The threshold/move amount setting is a **reminder only**; manually record any real additional transfer in Goals.
- Use Tracker → **Export JSON** regularly. JSON restore includes goals/settings/branches/records; CSV exports/imports tracker records only.

## Optional Google Sheets snapshot backup

1. Create a Google Sheet and open **Extensions → Apps Script**.
2. Delete the default code and paste **all of** `sheets.gs`. Save.
3. In Apps Script, open **Project Settings → Script properties → Add script property**. Set name `BACKUP_TOKEN`; choose a long private random value, and save.
4. Choose **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**, then authorize the script and deploy. Copy the `/exec` web-app URL.
5. In Edgeboard **Settings**, enter the web-app URL and the **same** `BACKUP_TOKEN` value, then Save. In **Tracker → Send to Sheets**. Inspect the `Edgeboard Backups` sheet for a new timestamped row.

**Security:** This is an append-only full JSON snapshot (including local settings). Anyone with your secret token and public web-app URL can append data. Never commit the token to GitHub, and do not share exported backups. The browser uses a `no-cors` form POST: it can send data but **cannot verify receipt**, so check the sheet. This does not provide two-way live sync.

## Optional Telegram Mini App — BotFather

1. In Telegram open **@BotFather**, send `/newbot`, follow the prompts to set its display name and unique username. Keep its **bot token** private; Edgeboard never needs it.
2. Send `/setmenubutton`, select your bot, and enter your published **GitHub Pages HTTPS URL** for the Mini App. Choose button text such as **Open Edgeboard**.
3. Optionally use **Bot Settings → Configure Mini App / Main Mini App** to set the same URL and get the profile launch button (the exact label can vary).
4. Open your bot and use the menu button. Edgeboard checks for `window.Telegram.WebApp`, expands its viewport and supports in-app alerts/haptics if enabled.

**Telegram limitation:** without a bot server, Telegram cannot proactively DM alerts to you while the Mini App is closed. The optional alert is only while the app is open. Browser notifications require permission and likewise have no background condition monitor.

## Known limits

- The free public Gamma API may fail due to CORS, rate limits, geography or changing schemas; the Worker only addresses browser CORS. Results depend on Gamma's event feed and game-start timestamps. Scanning doesn't guarantee exhaustive coverage of every sport or market.
- Sports filtering uses team-vs-team or player-vs-player **two-outcome match-winner** markets. Markets with draw/third outcome are rejected rather than treating Yes/No as the entire game.
- No wallet login, real money transfers, order placement, independent predictive model, guaranteed "true" win probabilities, or push messages from a closed tab.
- A roughly 100% sum can indicate consistent *displayed* two-sided quotes, not a profitable arbitrage. Prices can change before a trade and may not be executable at the displayed level.
