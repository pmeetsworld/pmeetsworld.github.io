const DB_NAME = "alpenglow-offline";
const DB_VERSION = 1;
const STORES = ["media", "snapshots", "importFiles"];

let databasePromise;
const memoryFallback = new Map(STORES.map((name) => [name, new Map()]));

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function openDatabase() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const store of STORES) {
        if (!database.objectStoreNames.contains(store)) {
          database.createObjectStore(store, { keyPath: "id" });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return databasePromise;
}

async function withStore(storeName, mode, operation) {
  if (!STORES.includes(storeName)) throw new Error(`Unknown IndexedDB store: ${storeName}`);
  const database = await openDatabase();

  if (!database) {
    return operation(null, memoryFallback.get(storeName));
  }

  const transaction = database.transaction(storeName, mode);
  const store = transaction.objectStore(storeName);
  return operation(store, null);
}

export function putRecord(storeName, record) {
  return withStore(storeName, "readwrite", (store, memory) => {
    if (memory) {
      memory.set(record.id, structuredClone(record));
      return record;
    }
    return requestResult(store.put(record));
  });
}

export function getRecord(storeName, id) {
  return withStore(storeName, "readonly", (store, memory) => {
    if (memory) return structuredClone(memory.get(id) || null);
    return requestResult(store.get(id));
  });
}

export function getAllRecords(storeName) {
  return withStore(storeName, "readonly", (store, memory) => {
    if (memory) return [...memory.values()].map((value) => structuredClone(value));
    return requestResult(store.getAll());
  });
}

export function deleteRecord(storeName, id) {
  return withStore(storeName, "readwrite", (store, memory) => {
    if (memory) return memory.delete(id);
    return requestResult(store.delete(id));
  });
}

export function clearStore(storeName) {
  return withStore(storeName, "readwrite", (store, memory) => {
    if (memory) {
      memory.clear();
      return true;
    }
    return requestResult(store.clear());
  });
}

export async function clearDatabase() {
  await Promise.all(STORES.map((store) => clearStore(store)));
}
