# Alpenglow v0.10 Current Status

Last refreshed: 2026-05-11

## Source Of Truth

`C:\Users\xyzas\Documents\Codex\2026-05-03\files-mentioned-by-the-user-route\Alpenglow v0.10`

Do not assume the OneDrive copy is current. Earlier OneDrive writes failed with `Access is denied`.

## Read First

- `CHANGELOG.md`

Historical docs, QA screenshots, and CSS backups are archived under `archive\`. Prefer `CHANGELOG.md` as the compressed source of truth.

## Current App Summary

This is a local static PWA/offline prototype for Route 508 `Alpenglow v0.10`.

It includes:

- Dashboard-first startup.
- Bottom navigation.
- Dashboard, Accounts/My Route, Account Today/Details/Notes, Activity, More/Settings.
- Legacy v0.6 JSON import.
- Generated seed data.
- Local storage state.
- IndexedDB media helper.
- Quick JSON and Full ZIP backup affordances.
- Route Manager.
- Structured notes with type, follow-up date, photo, and voice affordances.

The Dashboard visual is locked as the current design reference for the next screens. Other pages should be updated to mimic its iOS/Liquid Glass hierarchy before production transfer.

## Key Runtime Files

- `index.html`
- `style.css`
- `manifest.json`
- `sw.js`
- `js/app.js`
- `js/core/store.js`
- `js/core/selectors.js`
- `js/core/pricing.js`
- `js/core/media.js`
- `js/data/seed.js`
- `js/data/migration.js`

## Current Cache

`r508-alpenglow-v0-10-package-72-account-task-ctas`

## Current Verification

- JavaScript syntax check passes across `js/**/*.js`.
- Service worker syntax check passes.
- Service worker cache list has no missing files.
- Runtime render check confirms the Dashboard uses `page--with-hero`, `hero-band`, `glass-shell--floating`, and bottom nav inside the floating shell.
- Scoreboard +/- steppers update tracked local scoreboard state.
- Annotated Dashboard render check confirms five glance tiles, four scoreboard cards, WIP Sell This By Then card, no duplicate Distro Progress card, and working Taps stepper.
- Package 18 render check confirms Sell This By Then is removed, five glance tiles and four scoreboard cards still render, and scoreboard steppers still update local state.
- Package 19 render check confirms the hero shows accounts left plus a short quote, does not mention Distro, shortened glance labels render, Distro remains in the glance strip, and score steppers still work.
- Package 20 CSS check confirms the mobile-only alpenglow photo crop override is present without broad selectors or CSS brace errors.
- Package 21 CSS check confirms clearer Dashboard base glass opacity is present without broad selectors or CSS brace errors.
- Package 22 CSS check confirms the clearer shell opacity and aligned insight tile grid rows are present without broad selectors or CSS brace errors.
- Package 23 render check confirms Distro Drive is a full-width progress strip, the glance grid is four equal tiles, and scoreboard steppers still work.
- Package 24 render check confirms Elite Scoreboard is now a glass section with four flat score tiles and working steppers.
- Package 25 CSS check confirms centered Dashboard section titles and aligned Route Progress header/badge rules are present.
- Package 27 checks confirm Dashboard title-case, section title color/padding, spacing variables, Distro strip, four glance tiles, four score tiles, and working steppers.
- Package 28 checks confirm universal type/spacing tokens, title-case utility labels, day badge uppercase preservation, Dashboard render, and working steppers.
- Package 29 CSS check confirms Today at a Glance and Elite Scoreboard now share the exact same final panel padding and header margin rules.
- Package 30 CSS/render checks confirm day tabs, Distro Drive title, glance tile titles, and score tile titles share universal height/line-height treatment.
- Package 33 audit confirms the locked Dashboard labels are current: `Day Health`, `score`, no repeated `Scoreboard` subtitles inside Elite Scoreboard tiles, and cache version `r508-alpenglow-v0-10-package-33-glance-title-match`.
- iPhone 15 Pro viewport QA passes at `393 x 852` CSS pixels: no horizontal overflow, no console errors, Dashboard shell/nav fit in the visible viewport, and the scoreboard `+` interaction updates local UI state.
- Shorter Safari-like viewport QA passes at `393 x 700` CSS pixels: one-page fit, no horizontal overflow, no console errors, nav visible, and scoreboard `+` interaction updates local UI state.
- Package 37 shifts the short Safari-like layout downward so the bottom nav aligns more naturally near the bottom of the viewport while preserving one-page fit.
- Package 38 switches the app background to `assets/alpenglow-mountain.png`, copied from `bg.png` (`908 x 1968`), and aligns both normal and Safari-like Dashboard views to the same lower top offset.
- Package 39 reduces the side-shadow effect by softening the outer shell shadow and switching background attachment to scroll, while making only the back shell more opaque with less blur. Inner transparent cards/panels remain unchanged.
- Package 41 sets the back shell to roughly 90% transparent (`rgba(..., 0.10)`), reduces shell blur to `1.5px`, and leaves only a tiny Vista-style window lift shadow.
- Package 42 keeps the shell unchanged but makes the card-level glass surfaces milkier and blurrier (`rgba(..., 0.28)`, `blur(24px)`) with a subtle frosted/grain texture overlay. Solid white data tiles remain unchanged.
- Package 43 keeps the shell clear but makes card-level glass denser (`rgba(..., 0.48)`, `blur(34px)`) with quieter grain so panels feel more frosted and less transparent.
- Package 44 gives the Dashboard pull handle a dedicated iOS sheet-tab shelf, increasing the top breathing room before the day tabs while preserving the locked one-page fit target.
- Package 45 fixes the pull-tab shelf inheritance bug by giving the shelf full width and making its fill nearly transparent, restoring the mountain visibility while keeping the handle breathing room.
- Package 46 increases card-level glass blur by 50% (`34px` to `51px`) and pins the portrait mountain background to the phone-stage width on desktop so PC browsers do not crop into only the pale sky.
- Package 47 backs card-level glass fill down to `rgba(..., 0.32)` and doubles the original blur to `68px`, so the material feels clearer but more optically distorted instead of thicker.
- Package 48 pushes card-level blur to `200px` and lowers fill to `rgba(..., 0.16)` for a clear, heavily refracted Liquid Glass feel.
- Package 49 switches the active background to `assets/alpenglow-abstract-bgv2.png`, while keeping `assets/alpenglow-mountain.png` available as the previous mountain option.
- Package 50 adds reusable dark Liquid Glass tokens and a `.liquid-glass-surface` class, maps the Dashboard parent glass surfaces to dark translucent material with `200px` blur and green refraction, removes the page-wide background overlays, and preserves solid white content tiles plus amber active states.
- Package 51 removes the green/refraction glaze and adds a neutral duplicated-background blur plate inside parent glass surfaces (`filter: blur(58px) saturate(135%)`) so the card plane visibly flattens/smudges the background instead of relying only on `backdrop-filter`.
- Package 71 refreshes seed data from local 2026-05-11 workbooks, imports only On-Prem Distro Drive items, imports the pasted weekly Elite Tasks, and bumps seed schema to `11`.
- Package 72 moves Account Today Distro Drive and Elite Tasks add forms behind bottom CTA buttons so the cards read as task lists first.
- v1.0 readiness audit passes: mobile/desktop render, no console errors, no horizontal overflow, scoreboard interaction, account search, Distro add, Elite Task add, Details expansion, undo toast, Dark Mode toggle, service worker cache asset existence, and runtime syntax checks.
- Package 66 fixes Activity/More expanded-card usability: utility pages now keep scroll memory, expanded utility cards no longer flex-shrink, long utility card bodies scroll internally, accent options update the full amber/ember token set, and dark mode preserves charcoal text on solid white content surfaces.
- Package 66 mobile render checks pass at `393 x 700` and `393 x 852`: no console errors, no horizontal overflow, expanded Activity/More panels remain scrollable, Route Editor and Activity Log get internal scrolling, and Accent/Dark Mode controls are clickable/readable.
- Package 67 converts Dark Mode into true dark mode: page shells, cards, tabs, inputs, account rows, summaries, route editor rows, and bottom nav switch to black/charcoal surfaces with white outlines and white text. Primary CTAs retain amber fill for action contrast.
- Package 67 render checks pass at `393 x 852`: Dashboard, Accounts, Account Today/Details/Notes, Activity, and More stay dark/readable with no white-card remnants, no console errors, and no horizontal overflow.
- Package 68 extends true dark mode to the Dashboard Route Progress header/circle text and removes the duplicate Today-tab `Voids & Opportunities` preview. The Details tab `Void Tracker` is now the single void-management surface for Chain Mod Voids, Scale Up, and Perfect Launch.
- Package 69 makes the Accounts route-order chip black with white number/check symbol and a white outline in light and dark modes.
- Package 69 render check confirms Accounts route-order chip is white-on-black, Dashboard Route Progress is dark/readable in Dark Mode, Today no longer shows `Voids & Opportunities`, Details still shows `Void Tracker` plus Chain Mod Voids, Scale Up, and Perfect Launch, with no console errors or horizontal overflow at `393 x 852`.
- Package 70 adds a global Undo toast for meaningful mutations: scoreboard, visit status, compliance, void/distro/task/pricing/note changes, route edits, settings, import, reset, and debounced account/objective/nickname text edits. Undo restores both data and relevant UI/settings state.
- Package 70 render check confirms scoreboard `+` shows `Scoreboard changed` toast and Undo restores the count, Dark Mode shows `Settings changed` toast and Undo restores light mode, with no console errors or horizontal overflow at `393 x 852`.
- Package 53 switches the active background to `assets/508BG.png` and replaces the visible ring pattern with a neutral `assets/frost-noise.svg` texture.
- Package 54 makes the glass parent surfaces more white-frost in nature, increases `backdrop-filter` to `320px`, pushes the duplicated background plate to `blur(260px) saturate(28%)`, and adds small contrast adjustments for text/buttons.
- Package 55 switches the active background to `assets/dark-liquid-bg.jpg`, copied from the darker iOS-style reference image, while preserving the white-frost glass settings and amber active states.
- Package 55 render check confirms the darker background is active, Dashboard content fits at `393 x 852` and `1200 x 900`, no horizontal overflow is present, and the favicon now resolves to the existing app icon.
- Package 56 begins the Accounts screen rebuild: Dashboard-style hero plus floating glass shell, day/filter tabs, frosted search panel, solid white account list rows with route index, account number/store number, health score, visit action, internal list scrolling, and a `Start Next Stop` CTA that opens the next unvisited account.
- Package 56 render check confirms Accounts fits at `393 x 852`, has no horizontal overflow, search filters the list without console errors, and `Start Next Stop` opens an account detail view.
- Package 57 replaces the visible `New` filter with `Not Done`, restores the compact sort control, tightens the search field copy/spacing, and scopes search to account name, nickname, number, town-like aliases, type, tags, and chain/store number.
- Package 57 render check confirms `Not Done` is visible, `New` is not visible, sort can switch to `Open Opps`, search still filters, and the Accounts page has no horizontal overflow or console errors at `393 x 852`.
- Package 58 removes the unused grid button, lets the sort control span the full row, hides the account-list scrollbar while preserving internal scrolling, and tightens the search card so it fits its glass panel cleanly.
- Package 58 render check confirms no grid button remains, sort still works, account-list scrollbar styling is hidden, search fits the panel, and Accounts has no console errors or horizontal overflow at `393 x 852`.
- Package 59 replaces account-row `Tags`/display stats with field-facing signals for Survey, OOC, and total Opps; adds sort options for Total Opps, Survey Needed, and OOC Needed; and recenters the search card within its glass panel.
- Package 59 render check confirms `Tags` is removed from account rows, Survey/OOC/Opps render, the new sort options are present, search is centered within 1px, and Accounts has no console errors or horizontal overflow at `393 x 852`.
- Package 60 rebuilds the tapped Account landing page onto the Dashboard/Accounts hero + floating glass shell system, adds account identity, health score, Today/Details/Notes tabs, Account Brief, Today Signals, and preserves existing account data/actions.
- Package 60 fixes a card flex-shrink clipping bug and a health-badge CSS leak, then render-checks Account Today/Details/Notes at `393 x 852` with no console errors and no horizontal overflow.
- Package 61 removes the redundant Account Brief card, moves the visit action into the account hero, and converts Compliance, Distro Drive, Elite Tasks, and Voids & Opportunities into glass section wrappers with flat white header tabs and readable white inner rows.
- Package 61 render checks confirm Account Brief is gone, the hero visit button renders, section cards do not create horizontal overflow, Distro SKU rows keep status pills inside the card, and Today/Details/Notes still navigate at `393 x 852`.
- Package 62 makes Compliance Checklist, Distro Drive, Elite Tasks, and Voids & Opportunities collapsible using the existing collapsedPanels UI state; normalizes account-section header/action/row typography; and fixes Voids row containment so long labels and state pills stay inside their cards.
- Package 62 render checks confirm Account Brief remains removed, four collapsible account section cards render, collapse toggles hide/show card bodies, Voids rows stay within card bounds, per-bucket empty states no longer clutter the Voids card, and there is no horizontal overflow at `393 x 852`.
- Package 63 restores the Dashboard Start Route CTA above the frosted Route Progress card layers, defaults the Today account work sections to collapsed, and maps Details/Notes sections to the same glass wrapper + flat white content system used by Today.
- Package 63 render checks confirm the Start Route button is amber at z-index 3 above the card frost layer, Today sections default to `Show`, Details and Notes use static account section wrappers, no console errors are emitted, and Account Today/Details/Notes have no horizontal overflow at `393 x 852`.
- Package 64 preserves Account Details scroll position after cycling Void Tracker rows, defaults Account Info, Pricing Tracker, and Notes Timeline collapsed, compacts the Structured Note form to fit the first viewport, and moves Activity/More/Structured Notes index onto the Dashboard-style hero + floating glass shell system.
- Package 64 render checks confirm Account Details void-row clicks retain the inner panel scroll position, Notes fits without panel scrolling at `393 x 852`, Activity Log is collapsed by default, More sections use the same section-card system, no console errors are emitted, and Account/Activity/More pages have no horizontal overflow.
- Package 65 self-audit removes unused legacy helper functions, replaces account search row refresh with a safer debounced `replaceChildren` path, stops full rerenders during native form/select changes, and raises Dashboard scoreboard +/- controls to 24 x 24.
- Package 65 verification covers Dashboard, Accounts search/sort, Account Today/Details/Notes, Activity, and More at `393 x 852`: no console/page errors, no horizontal overflow, search returns rows, sort persists, Details scroll is retained after Void Tracker changes, Notes does not require panel scrolling, Activity Log is minimized by default, and More sections remain collapsed by default.
- Current background asset is `assets/dark-liquid-bg.jpg`.

## Main Risks

- CSS/style architecture is still layered from many Dashboard tuning packages. Preserve the final Dashboard visuals, but consolidate the cascade before production transfer.
- Current visual fit still needs live screenshot QA at real iPhone widths after any future visual edits.
- Historical package notes are archived under `archive\historical-docs`; prefer `CHANGELOG.md`.
- Health grades are simplistic.
- Skipped accounts and true week-over-week score deltas are not yet tracked.
- Excel import/data refresh is not a polished user workflow.

## Latest Change

Package 70 adds a global Undo toast, `CHANGELOG.md` compresses the scattered docs/package history into one source-of-truth handoff file, and old docs/screenshots/CSS backups have been moved into `archive\`.
