import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DAY_DEFS } from "../src/config.js";
import { parseLegacyRosterBackup } from "../src/domain/legacy.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, "..");
const sourcePath = process.argv[2];
const requestedOutputDir = process.argv[3];

if (!sourcePath) {
  throw new Error("Pass the Route 508 v0.6 backup path.");
}

const source = JSON.parse(await readFile(path.resolve(sourcePath), "utf8"));
const parsed = parseLegacyRosterBackup(source, source.exportedAt);
const outputDir = requestedOutputDir
  ? path.resolve(requestedOutputDir)
  : path.resolve(projectDir, "..", "Alpenglow Roster");

const roster = source.roster.map((entry) => ({
  id: entry.id,
  name: entry.name,
  nick: entry.nick || "",
  type: entry.type,
  freq: entry.freq,
  days: entry.days,
  order: entry.order
}));

const importFile = {
  exportType: "route508-roster-only",
  schemaVersion: 1,
  exportedAt: source.exportedAt,
  source: "Route 508 v0.6 legacy backup",
  accountCount: parsed.accountCount,
  roster
};

function csvValue(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const headers = [
  "accountNumber",
  "name",
  "nickname",
  "town",
  "storeNumber",
  "type",
  "frequency",
  "routeDays",
  ...DAY_DEFS.map((day) => `${day.label.toLowerCase()}Stop`)
];

const rows = Object.values(parsed.accounts).map((account) => {
  const routeDays = DAY_DEFS.filter((day) => parsed.routes[day.id].includes(account.id));
  return [
    account.accountNumber,
    account.name,
    account.nickname,
    account.town,
    account.storeNumber,
    account.type,
    account.frequency,
    routeDays.map((day) => day.label).join(" / "),
    ...DAY_DEFS.map((day) => {
      const index = parsed.routes[day.id].indexOf(account.id);
      return index < 0 ? "" : index + 1;
    })
  ];
});

await mkdir(outputDir, { recursive: true });
await writeFile(
  path.join(outputDir, "route508-v06-roster-import.json"),
  `${JSON.stringify(importFile, null, 2)}\n`,
  "utf8"
);
await writeFile(
  path.join(outputDir, "route508-v06-roster-audit.csv"),
  `${[headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n")}\n`,
  "utf8"
);

console.log(`Exported ${parsed.accountCount} unique accounts.`);
