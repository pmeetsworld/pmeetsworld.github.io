import {
  clearDatabase,
  getAllRecords,
  putRecord
} from "../state/idb.js?v=1.1.0";

const BACKUP_VERSION = 1;

function buildEnvelope(state) {
  return {
    format: "alpenglow-backup",
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    field: state.field,
    report: state.report
  };
}

export function jsonBackup(state) {
  return JSON.stringify(buildEnvelope(state), null, 2);
}

export async function fullBackup(state) {
  if (!globalThis.JSZip) throw new Error("The offline ZIP utility is unavailable.");
  const zip = new JSZip();
  zip.file("alpenglow.json", jsonBackup(state));
  const media = await getAllRecords("media");
  const snapshots = await getAllRecords("snapshots");
  const importFiles = await getAllRecords("importFiles");

  zip.file("indexeddb/manifest.json", JSON.stringify({
    media: media.map(({ blob, ...record }) => record),
    snapshots,
    importFiles: importFiles.map(({ blob, ...record }) => record)
  }, null, 2));

  for (const record of media) {
    if (record.blob) zip.file(`indexeddb/media/${record.id}`, record.blob);
  }
  for (const record of importFiles) {
    if (record.blob) zip.file(`indexeddb/imports/${record.id}`, record.blob);
  }

  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export function validateBackup(envelope) {
  if (!envelope || envelope.format !== "alpenglow-backup") {
    throw new Error("This is not an Alpenglow backup.");
  }
  if (!envelope.field || !envelope.report) {
    throw new Error("The backup is missing required state layers.");
  }
  return envelope;
}

export async function readBackupFile(file) {
  if (/\.zip$/i.test(file.name)) {
    if (!globalThis.JSZip) throw new Error("The offline ZIP utility is unavailable.");
    const zip = await JSZip.loadAsync(file);
    const stateFile = zip.file("alpenglow.json");
    if (!stateFile) throw new Error("The ZIP does not contain alpenglow.json.");
    const envelope = validateBackup(JSON.parse(await stateFile.async("text")));
    const manifestFile = zip.file("indexeddb/manifest.json");
    const manifest = manifestFile ? JSON.parse(await manifestFile.async("text")) : {};
    return { envelope, zip, manifest };
  }
  return { envelope: validateBackup(JSON.parse(await file.text())), zip: null, manifest: null };
}

export async function restoreIndexedData({ zip, manifest }) {
  if (!zip || !manifest) return;
  await clearDatabase();
  for (const record of manifest.snapshots || []) await putRecord("snapshots", record);
  for (const metadata of manifest.media || []) {
    const archived = zip.file(`indexeddb/media/${metadata.id}`);
    if (!archived) continue;
    const blob = await archived.async("blob");
    await putRecord("media", { ...metadata, blob });
  }
  for (const metadata of manifest.importFiles || []) {
    const archived = zip.file(`indexeddb/imports/${metadata.id}`);
    if (!archived) continue;
    const blob = await archived.async("blob");
    await putRecord("importFiles", { ...metadata, blob });
  }
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
