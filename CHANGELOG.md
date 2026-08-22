# Changelog

## Data refresh - 2026-08-22

- Added dated Elite assignments, preorder, and PFP scorecard snapshots from the August 22 source captures.
- Updated preorder goals and actuals for 17 item-number keyed products.
- Updated all six PFP volume buckets and validated execution to 5 of 78 objectives.
- Retained stable Elite assignment identities and documented the source screenshot's hidden-completion limitation instead of inventing unseen rows.

## 1.1.0 - 2026-08-16

- Added live PFP projection from exact campaign-matched local Elite completions, with source/local attribution and remaining potential kept separate from committed pay.
- Added report-confirmed Independent/Chain hierarchy for route-performance filtering while preserving specialized DSD and On-Premise field classifications.
- Added "Not suitable for account" as a protected per-account preorder response.
- Daily summaries now keep only each opportunity's final status for the day.
- Added a compact Gains/Declines switch to Customer Movers and centered the Route Health legend.
- Added "On Shelf" as a resolved opportunity state, with legacy "Already in Account" normalization.
- PFP volume bars now show the 70% payout gate; campaign rows use a clearer bounded scroll list.
- Upgraded the account Price Book with a shared SKU catalog, automatic unit/margin math, optional 2-for pricing, and account-specific retail values.
- Added attachment deletion with undo, fixed same-day compliance counting, and removed the nested Elite objective scroller so checklist position is retained.
- Normalized legacy "No Fit" opportunity states to "Not in Set" and corrected Route Health calendar selection and weekend contrast.
- Added a protected execution layer for Elite assignments and account-specific completion states.
- Added a global preorder catalog with per-account buyer responses, quantities, and notes.
- Added the PFP v1 payout engine, August scorecard, volume gates, execution pace, and estimated-pay views.
- Added distinct Account Performance, Segment Performance, and Customer Movers imports with truthful MTD/YTD controls.
- Added the Perfect Launch catalog CSV as product-level context without inventing account or item-number links.
- Added an optional August execution pack that stages supplied source data without seeding a clean install.
- Advanced storage migrations to schema 3 while preserving report/field isolation and undo behavior.
- Versioned the complete JavaScript module graph so installed PWAs cannot mix old and new modules during an update.
- Brought Route Health calendar controls to a true 44px minimum target at iPhone 15 Pro width.
- Reordered Activity so daily follow-ups stay with the daily summary instead of below long-form analytics.
- Collapsed detailed PFP calculations, route and account performance, and import-format guidance behind compact summaries.
- Revised the offline-shell cache so the final layout audit reaches already-open previews and installed PWAs cleanly.

## 1.0.13 - 2026-07-30

- Propagated the release key through the performance screen module graph so the MTD/YTD source-state control cannot be hidden by a stale imported module.
- Replaced search-agnostic cache matching with exact asset versions and a one-time release loader that refreshes when a new offline worker takes control.

## 1.0.12 - 2026-07-30

- Versioned first-party entry assets so browser and installed-PWA refreshes reliably load the current UI instead of a stale JavaScript module graph.

## 1.0.11 - 2026-07-30

- Moved service-worker registration into the network-loaded HTML shell so new offline versions reliably replace stale cached modules.

## 1.0.10 - 2026-07-30

- Kept the MTD/YTD control visible when a workbook lacks those periods, with disabled states and a clear source-data explanation.

## 1.0.9 - 2026-07-29

- Added a shared MTD/YTD selector wherever the imported report provides both periods.
- Kept comparison-only reports in their truthful year-vs-year mode instead of relabeling them.

## 1.0.8 - 2026-07-29

- Fixed performance imports by mapping columns from their semantic headers instead of fixed positions.
- Added explicit support for both MTD/YTD summaries and two-year Case Equiv comparison reports.
- Labeled performance values with their actual period and comparison year across Home, Activity, and account details.
- Unsupported performance layouts now fail clearly instead of producing misleading figures.

## 1.0.7 - 2026-07-28

- Moved the lower atmospheric fade from the inner sheet to the full screen so
  content scrolls naturally beneath it and the bottom navigation remains above.
- Tightened the account visit objective to the annotated 15px treatment.
- Limited Route Health month choices to Alpenglow history from July 2026
  forward, automatically adding each new month while retaining recorded data.
- Added a validated roster-only export from the 46-account Route 508 v0.6
  source, preserving permanent account numbers and per-day route order.

## 1.0.6 - 2026-07-28

- Refined Home with full weekday names, clean circular route-health grades, a
  finished bottom gradient, and route-level Segment Performance filters.
- Added month switching to the Route Health calendar.
- Rebuilt Activity around compact health-style counters, account-level
  performance, account-specific end-of-day summaries, and a collapsed
  today-only field timeline.
- Simplified Settings and updated the app credit to Payton Stone.
- Kept the offline shell while allowing new app versions to refresh cleanly.

## 1.0.3 - 2026-07-28

- Added a dedicated inner sheet gutter so cards, lists, and full-width CTAs
  retain visible space from the working page edges across every screen.
- Kept headers, segmented controls, sheets, and bottom navigation at their
  established widths.

## 1.0.2 - 2026-07-28

- Made account number the permanent account identity for the explicit v0.6
  roster import, preserving nicknames, weekday order, and twice-weekly stops.
- Added item-number-ready SKU identity. Current July reports fall back to a
  normalized product name because those exports do not contain item numbers.
- Unified opportunity progress by account and SKU across Chain Mod, Scale Up,
  and Perfect Launch while keeping report membership replace-only.
- Migrated existing tracker-specific progress safely, preferring retained
  `Sold In` state when old tracker states conflict.
- Standardized the top inset of every working page and updated offline caching.

## 1.0.1 - 2026-07-28

- Added a slightly wider shared content inset across all working cards.
- Rebuilt Account Details as collapsed disclosure cards with useful summaries.
- Added full stop editing from Route Editor, including frequency and route days,
  without changing saved route order.
- Added note deletion with Undo and delayed cleanup of unreferenced media.
- Added in-app photo viewing, voice-note playback, media downloads, and a
  reliable close control for every bottom sheet.
- Added resilient iPhone-compatible voice capture with offline media storage.
- Added segment performance as an explicit 25% health component. High End is
  10% of that component; the other four segments split the remaining 90%.
- Removed performance rows from opportunity counts.

## 1.0.0 - 2026-07-27

- Rebuilt Alpenglow as a clean-install, offline-first iPhone PWA.
- Added weekday routes, Focus mode, visit tracking, account details, structured
  notes, photo and voice attachments, follow-ups, compliance, price books, and
  user-owned opportunity states.
- Added explainable account and route health, historical health snapshots, and
  the Route Health Map with distinct no-data and F-grade states.
- Added strict Excel parsing for performance, Chain Void, ScaleUp, and Perfect
  Launch reports with a Review queue for every uncertain match.
- Physically separated field records from replace-only report imports and added
  automated tests that reject import-side field mutations.
- Added JSON and full ZIP backups, route editing, optional sample data, dusk
  mode, safe-area support, service-worker caching, and offline status.
- Verified the primary and secondary workflows at 393 by 852 pixels with
  44-pixel minimum controls, no horizontal overflow, and offline boot.
