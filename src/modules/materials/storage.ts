/** Almacenamiento de textos de material en IndexedDB (no cabe en localStorage). */
import type { ProcessedMaterial } from "./processor.ts";

const DB = "legal-life";
const STORE = "materials";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface StoredMaterial {
  text: string;
  processed: ProcessedMaterial | null;
}

export async function saveMaterial(id: string, value: StoredMaterial): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function loadMaterial(id: string): Promise<StoredMaterial | null> {
  const db = await open();
  return new Promise((res, rej) => {
    const req = db.transaction(STORE).objectStore(STORE).get(id);
    req.onsuccess = () => res((req.result as StoredMaterial) ?? null);
    req.onerror = () => rej(req.error);
  });
}

export async function deleteMaterial(id: string): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
