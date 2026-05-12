# Alpenglow v0.10 Changelog

Last updated: 2026-05-11

Source of truth:

`C:\Users\xyzas\Documents\Codex\2026-05-03\files-mentioned-by-the-user-route\Alpenglow v0.10`

Do not assume the OneDrive copy is current.

## Current Build

- App name: Route 508 - Alpenglow v0.10
- Runtime: static offline-first PWA for GitHub Pages
- Current cache: `r508-alpenglow-v0-10-package-72-account-task-ctas`
- Current background: `assets/dark-liquid-bg.jpg`
- Current visual direction: iOS-style Liquid Glass shell, dark liquid background, amber action color, true dark mode option.
- Current seed refresh: 2026-05-11 local files, with On-Prem Distro Drive only because Off-Prem is complete.
- Historical docs, QA screenshots, and old CSS backups have been pruned from the root and moved to `archive\`.

## Runtime Surface

- Dashboard-first startup.
- Bottom navigation: Dashboard, Accounts, Activity, More.
- Accounts route list with day/filter/search/sort controls.
- Account landing page with Today, Details, Notes tabs.
- Activity page with daily summary, weekly 1-on-1 prep, summary archive, activity log.
- More page with Settings, Structured Notes shortcut, Route Editor, Legacy v0.6 import, Backups.
- Local storage app state.
- IndexedDB media helper for note attachments.
- Quick JSON and Full ZIP backup affordances.
- Legacy v0.6 JSON import.
- Undo toast for meaningful mutations.

## Data Model Notes

- Account number is the unique account identifier.
- Chain accounts may also show store number, but account number remains the key.
- Legacy notes import as structured legacy notes.
- Route day/order/nickname/frequency starts from legacy backup truth.
- Voids live per SKU, per account, under the Details tab `Void Tracker`.
- The correct void buckets are:
  - Chain Mod Voids
  - Scale Up
  - Perfect Launch
- The Today tab no longer has a duplicate `Voids & Opportunities` tracker.
- Visited status is separate from task completion.
- Notes support type, follow-up date, photo affordance, and voice-note affordance.
- Pricing tracker is manual/flexible for now and can calculate margin from entered values.
- Distro Drive seed data now imports only the `PAYTON STONE` sheet from the On-Prem Spring Distro workbook.

## 2026-05-11 Data Refresh

- Repointed seed generation to the local `Data\` folder.
- Imported 26 On-Prem Distro Drive opportunities from `On-Prem Spring Distro Drive GI-Fairbury 5.7.26.xlsx`.
- Imported 44 Elite Tasks from the weekly screenshot notes, including pricing surveys and targeted display tasks.
- Bumped seed schema to `11` so the browser refreshes onto the new weekly data.
- Kept Off-Prem distro items out of the seed because Off-Prem is 100% complete.

## Package 72 Account Task CTAs

- Moved Distro Drive and Elite Tasks add forms below their existing item lists.
- Added bottom CTA buttons: `Add new distro item` and `Add new Elite task`.
- Forms stay hidden until opened, then close again after a successful add.
- Sorted Distro Drive and Elite Tasks so open/to-do work stays above completed work.

## v1.0 Readiness Audit

- Passed mobile render audit at `393 x 852` and desktop render audit at `1280 x 900`.
- Verified Dashboard, Accounts, Account Today, Account Details, Account Notes, Activity, and More render without console errors or horizontal overflow.
- Verified scoreboard stepping, account search, Distro add CTA, Elite Task add CTA, Details expansion, undo toast, and Dark Mode toggle.
- Verified all cached service worker assets exist.
- Verified runtime JavaScript and service worker syntax checks pass.

## Current Screens

### Dashboard

- Hero: route/day, greeting, accounts-left message.
- Day tabs.
- Route Progress card.
- Today at a Glance with Distro Drive strip and day signals.
- Elite Scoreboard with Displays, PODs, Taps, Resets steppers.
- Start Route CTA opens the current day route.
- Dashboard is the visual design reference for future pages.

### Accounts

- Route-style account list.
- Shows route order chip, account name/nickname, account number, chain store number when available, health score, Survey/OOC/Opps signals, visit action.
- Filters: Today, All, Priority, Not Done, DSD, Chain, Independent, On-Prem.
- Sort options include route order, account name, open opps, total opps, survey needed, OOC needed, type, last visit.
- Search targets account name, nickname, account number, town-like text, type/tags, chain/store number.
- Route order chip is black with white number/check and white outline.

### Account Today

- Account hero contains identity, health score, and visit action.
- Today Signals card.
- Collapsed by default:
  - Compliance Checklist
  - Distro Drive
  - Elite Tasks
- Last Two Notes preview.
- No void tracker here; all void work is centralized in Details.

### Account Details

- This Week's Objective.
- Account Info, collapsed by default.
- Pricing Tracker, collapsed by default.
- Void Tracker, with Chain Mod Voids, Scale Up, and Perfect Launch.
- Void row clicks retain scroll position.

### Account Notes

- Structured Note form.
- Note Type: General, Opportunity, Issue, Follow Up, Order.
- Follow-up date.
- Photo and Voice Note affordances.
- Notes Timeline collapsed by default.

### Activity

- End of Day Summary.
- Weekly 1-on-1 Prep.
- Summary Archive.
- Activity Log.
- Long Activity panels scroll internally.

### More

- Settings Defaults: Accent, Glass, Dark Mode.
- Structured Notes shortcut.
- Route Editor.
- Legacy v0.6 Import.
- Backups.
- Long More panels scroll internally.

## Visual System

- Primary material: Liquid Glass-inspired app shell over background.
- Parent shells/panels use frosted glass.
- Action color: amber.
- Main CTAs remain amber-filled.
- True dark mode makes shells, cards, tabs, inputs, account rows, summaries, route editor rows, and bottom nav black/charcoal with white outlines and white text.
- Dark mode keeps amber for primary actions and selected emphasis.
- Avoid old chain/independent/on-premise color identity.
- Avoid day-color system.
- Avoid generic SaaS dashboard styling.

## Package Timeline

### Foundation

- Package 1: imported seed/legacy data and generated first import report.
- Package 2: created static PWA app frame, manifest, service worker, local store, core selectors, and seed data.
- Package 3: added field-sales workflows: Dashboard, route accounts, account work, notes, summary.
- Package 4: added media/backups affordances and IndexedDB media helper.
- Package 5: added settings and route manager.
- Package 6: added Activity weekly summary surfaces.
- Package 7: visual/PWA QA pass.

### Prototype Visual Migration

- Package 8: dropdown/glass refresh.
- Package 9: prototype vibe pass.
- Package 10: Today at a Glance glass pass.
- Package 11: hero health and route editor improvements.
- Package 12: prototype cockpit pass.
- Package 13: dashboard overflow audit.
- Package 14: iOS edge fit.
- Package 15: migrated to floating glass shell pattern.
- Package 16: ported preview dashboard.
- Package 17: annotated dashboard fit.
- Package 18: dashboard micro-polish.
- Package 19: final dashboard calibration.
- Package 20: alpenglow photo crop.
- Package 21: clearer dashboard base.
- Package 22: clearer shell and insight tile alignment.
- Package 23: Distro Drive strip and scoreboard panel.
- Package 24: Elite Scoreboard glass panel.
- Package 25: centered section titles and Route Progress alignment.
- Package 27: title-case labels and spacing polish.
- Package 28: universal type and spacing rhythm.
- Package 29: matched Today at a Glance and Elite Scoreboard padding.
- Package 30: universal tab title heights.
- Package 33: locked Dashboard labels: Day Health, score, no repeated Scoreboard subtitles.

### Background And Glass Calibration

- Package 37: short Safari-like viewport bottom alignment.
- Package 38: switched to `assets/alpenglow-mountain.png`.
- Package 39: softened side shadow and shell blur.
- Package 41: shell set near 90% transparent.
- Package 42: milkier card glass with grain texture.
- Package 43: denser frosted cards.
- Package 44: iOS pull-tab shelf.
- Package 45: fixed pull-tab shelf inheritance.
- Package 46: increased blur and fixed desktop background crop.
- Package 47: clearer fill with more optical distortion.
- Package 48: high blur / low fill Liquid Glass experiment.
- Package 49: switched to abstract alpenglow background.
- Package 50: added reusable dark Liquid Glass tokens.
- Package 51: removed green glaze and added neutral duplicated-background blur plate.
- Package 53: switched to `assets/508BG.png` and neutral frost noise.
- Package 54: increased white-frost blur and contrast.
- Package 55: switched to `assets/dark-liquid-bg.jpg`; verified Dashboard fit and favicon.

### Accounts And Account Pages

- Package 56: rebuilt Accounts screen from Dashboard visual system.
- Package 57: replaced New filter with Not Done and restored compact sort.
- Package 58: removed unused grid button and tightened search.
- Package 59: replaced Tags stats with Survey/OOC/Opps, added related sort options.
- Package 60: rebuilt tapped Account page with Today/Details/Notes tabs.
- Package 61: removed Account Brief, moved visit action into hero, converted work cards to glass wrappers.
- Package 62: made Compliance, Distro, Elite, and old Voids preview collapsible; fixed row containment.
- Package 63: restored Dashboard Start Route CTA and standardized Details/Notes wrappers.
- Package 64: preserved Account Details scroll after void changes; compacted Notes; moved Activity/More to the same shell system.
- Package 65: self-audit cleanup, safer account search refresh, no full rerender on native form/select changes, larger scoreboard steppers.

### Final Utility, Theme, And Safety Passes

- Package 66: fixed Activity/More expanded-card scrolling, added utility scroll memory, repaired Accent/Dark Mode readability.
- Package 67: converted Dark Mode into true black/white-outline dark mode.
- Package 68: extended true dark mode to Dashboard Route Progress and removed duplicate Today-tab void preview.
- Package 69: made Accounts route-order chip white-on-black and verified void tracker centralization.
- Package 70: added global Undo toast for meaningful mutations.
- Cleanup: compressed docs into this changelog and archived historical docs, QA screenshots, and old CSS backup files.

## Verification Snapshot

Current passing checks:

- `node --check js/app.js`
- `node --check js/core/store.js`
- `node --check sw.js`
- Render checks at `393 x 852` CSS pixels.
- Dashboard, Accounts, Account Today, Account Details, Account Notes, Activity, and More have no horizontal overflow in the latest checks.
- Undo toast verified:
  - Scoreboard `+` shows `Scoreboard changed` and Undo restores count.
  - Dark Mode toggle shows `Settings changed` and Undo restores light mode.

## Known Risks / Next Work

- CSS is still layered from many visual packages; preserve the look, but consolidate the cascade before production transfer.
- Excel import/data refresh is not yet a polished in-app workflow.
- Health grades are simplistic.
- Skipped accounts and true week-over-week score deltas are not fully tracked.
- Future production transfer should keep the Dashboard visual as the reference and avoid broad CSS selectors.

## Data Drop Location

Put new weekly Excel files here:

`C:\Users\xyzas\Documents\Codex\2026-05-03\files-mentioned-by-the-user-route\Alpenglow v0.10\Data`

Preferred: upload/place the raw `.xlsx` files unchanged, keeping original filenames.
