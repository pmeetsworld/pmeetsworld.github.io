# Alpenglow

Alpenglow is an offline-first iPhone PWA for one beverage field-sales rep.
It has no backend, account system, or runtime network dependency.

## Fresh install

A clean install contains no accounts, notes, visits, tasks, or imported
reports. Build the route from **More > Route editor**, or use the optional
**Load sample route** action in Settings for evaluation.

## Data boundaries

- `alpenglow.field.v1` stores the rep's accounts, route, notes, tasks,
  follow-ups, visits, compliance, prices, opportunity decisions, and settings.
- `alpenglow.report.v1` stores imported report data, match links, review rows,
  and snapshot metadata.
- IndexedDB stores photos, voice notes, and full import snapshot bodies.

The report importer receives a read-only copy of field data for matching. It
can only replace the report store. Automated tests protect this boundary.

## Report imports

Open **More > Report imports** and select one or more current Excel reports:

- Customer Performance Summary
- Chain Void Report
- ScaleUp Report
- Perfect Launch Report

The parser identifies reports from their worksheets and headers, not their
filenames. It matches explicit account numbers first, then unique chain store
numbers, then exact names. Anything uncertain remains in **Review** until it is
explicitly linked, used to create an account, or excluded. Each committed
import replaces that report type and preserves a dated snapshot.

## Backups

- **JSON backup** includes both state layers without media or imported files.
- **Full ZIP backup** includes state, media, import files, and snapshot bodies.
- Restoring a backup is an explicit full replacement and never happens during
  an Excel report import.

## Run locally

Serve this directory with any static HTTP server, then open the local URL.
Service workers and installable PWA behavior require HTTP or HTTPS rather than
opening `index.html` directly.

To run the automated boundary and health tests:

```text
npm test
```

## Deployment

Upload the contents of this folder, including `vendor`, `assets`, `src`,
`styles`, and `sw.js`, to a GitHub Pages repository. Keep the relative paths
intact. No build step or runtime connection is required.
