/* Alpenglow offline media storage and full backup export. */
(function () {
  "use strict";

  const DB_NAME = "route508.alpenglow.media.v0.10";
  const STORE_NAME = "media";
  const encoder = new TextEncoder();

  function available() {
    return "indexedDB" in window;
  }

  function openDb() {
    if (!available()) return Promise.reject(new Error("IndexedDB is not available in this browser."));
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function withStore(mode, callback) {
    return openDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      const result = callback(store);
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    }));
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function cleanName(value) {
    return String(value || "attachment").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "attachment";
  }

  async function saveFile(file, kind) {
    const id = uid(kind || "media");
    const record = {
      id,
      kind: kind || "media",
      name: cleanName(file.name),
      type: file.type || "application/octet-stream",
      size: file.size || 0,
      createdAt: new Date().toISOString(),
      blob: file,
    };
    await withStore("readwrite", (store) => store.put(record));
    return {
      id: record.id,
      kind: record.kind,
      name: record.name,
      type: record.type,
      size: record.size,
      createdAt: record.createdAt,
    };
  }

  async function getAll() {
    return withStore("readonly", (store) => requestToPromise(store.getAll()));
  }

  function crc32(bytes) {
    let crc = -1;
    for (let i = 0; i < bytes.length; i += 1) {
      crc ^= bytes[i];
      for (let j = 0; j < 8; j += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ -1) >>> 0;
  }

  function dosTime(date) {
    return ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | ((date.getSeconds() / 2) & 31);
  }

  function dosDate(date) {
    return (((date.getFullYear() - 1980) & 127) << 9) | (((date.getMonth() + 1) & 15) << 5) | (date.getDate() & 31);
  }

  function u16(value) {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, value, true);
    return bytes;
  }

  function u32(value) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value, true);
    return bytes;
  }

  function concat(parts) {
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(length);
    let offset = 0;
    parts.forEach((part) => {
      out.set(part, offset);
      offset += part.length;
    });
    return out;
  }

  function zipStored(files) {
    const now = new Date();
    const fileParts = [];
    const centralParts = [];
    let offset = 0;

    files.forEach((file) => {
      const name = encoder.encode(file.path);
      const bytes = file.bytes;
      const crc = crc32(bytes);
      const local = concat([
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(dosTime(now)), u16(dosDate(now)),
        u32(crc), u32(bytes.length), u32(bytes.length), u16(name.length), u16(0), name, bytes,
      ]);
      const central = concat([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(dosTime(now)), u16(dosDate(now)),
        u32(crc), u32(bytes.length), u32(bytes.length), u16(name.length), u16(0), u16(0),
        u16(0), u16(0), u32(0), u32(offset), name,
      ]);
      fileParts.push(local);
      centralParts.push(central);
      offset += local.length;
    });

    const central = concat(centralParts);
    const end = concat([
      u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
      u32(central.length), u32(offset), u16(0),
    ]);
    return new Blob([concat([...fileParts, central, end])], { type: "application/zip" });
  }

  async function fullBackupZip(state) {
    let records = [];
    if (available()) {
      try {
        records = await getAll();
      } catch {
        records = [];
      }
    }
    const manifest = records.map((record) => ({
      id: record.id,
      kind: record.kind,
      name: record.name,
      type: record.type,
      size: record.size,
      createdAt: record.createdAt,
      path: `media/${record.kind}/${record.id}-${record.name}`,
    }));
    const files = [{
      path: "alpenglow-state.json",
      bytes: encoder.encode(JSON.stringify({ ...state, mediaManifest: manifest }, null, 2)),
    }];
    for (const record of records) {
      const path = `media/${record.kind}/${record.id}-${record.name}`;
      files.push({ path, bytes: new Uint8Array(await record.blob.arrayBuffer()) });
    }
    return zipStored(files);
  }

  window.AlpenglowMedia = {
    available,
    saveFile,
    fullBackupZip,
  };
}());
