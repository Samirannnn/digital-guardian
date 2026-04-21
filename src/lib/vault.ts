import { useSyncExternalStore } from "react";
import type { ScanResult } from "./dna";

export type VaultItem = {
  id: string;
  name: string;
  url: string;
  size: number;
  uploadedAt: string;
  result: ScanResult;
};

let items: VaultItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const vault = {
  add(item: VaultItem) {
    items = [item, ...items];
    emit();
  },
  remove(id: string) {
    items = items.filter((i) => i.id !== id);
    emit();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get() {
    return items;
  },
};

export function useVault() {
  return useSyncExternalStore(
    vault.subscribe,
    vault.get,
    vault.get,
  );
}
