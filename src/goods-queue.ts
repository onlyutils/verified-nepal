import type { CreateEntryBody } from "./api.ts";

export interface QueuedEntry {
  id: string;
  centerId: string;
  body: CreateEntryBody;
  queuedAt: string;
}

const STORAGE_KEY = "vn:goods-queue";

function generateId(): string {
  try {
    const c = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    // ignore
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function enqueue(list: QueuedEntry[], centerId: string, body: CreateEntryBody): QueuedEntry[] {
  const item: QueuedEntry = {
    id: generateId(),
    centerId,
    body,
    queuedAt: new Date().toISOString(),
  };
  return [...list, item];
}

export function dequeue(list: QueuedEntry[], id: string): QueuedEntry[] {
  return list.filter((e) => e.id !== id);
}

export function load(): QueuedEntry[] {
  try {
    const g = globalThis as unknown as { localStorage?: Storage };
    if (!g.localStorage) return [];
    const raw = g.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as QueuedEntry[];
  } catch {
    return [];
  }
}

export function save(list: QueuedEntry[]): void {
  try {
    const g = globalThis as unknown as { localStorage?: Storage };
    if (!g.localStorage) return;
    g.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export async function flush(
  list: QueuedEntry[],
  send: (item: QueuedEntry) => Promise<unknown>,
): Promise<QueuedEntry[]> {
  const remaining: QueuedEntry[] = [];
  for (const item of list) {
    try {
      await send(item);
    } catch (err) {
      const isNetwork =
        err instanceof TypeError ||
        (err !== null &&
          typeof err === "object" &&
          "status" in (err as Record<string, unknown>) &&
          (err as Record<string, unknown>).status === 0);
      if (isNetwork) {
        remaining.push(item);
      }
    }
  }
  return remaining;
}
