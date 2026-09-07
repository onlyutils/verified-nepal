export const OUTBOX_STORAGE_KEY = "vn:outbox";

export interface OutboxItem {
  id: string;
  path: string;
  method: string;
  body: unknown;
  needsAuth: boolean;
  createdAt: string;
  attempts: number;
}

export interface EnqueueInput {
  path: string;
  method: string;
  body?: unknown;
  needsAuth: boolean;
}

export interface FlushOptions {
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response>;
  getToken: () => string | null | undefined | Promise<string | null | undefined>;
}

export interface FlushResult {
  sent: number;
  failed: number;
  dropped: number;
}

const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function notify() {
  for (const listener of listeners) listener();
}

function read(): OutboxItem[] {
  try {
    const raw = storage()?.getItem(OUTBOX_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: OutboxItem[]) {
  try {
    storage()?.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage can be unavailable or full; the request still returns its local id.
  }
  notify();
}

function newId(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  } catch {
    // Fall through for older test/browser runtimes.
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function queuedBody(body: unknown, id: string): Record<string, unknown> {
  let value = body;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      value = {};
    }
  }
  return {
    ...(value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}),
    submissionId: id,
  };
}

export function enqueue(input: EnqueueInput): OutboxItem {
  const id = newId();
  const item: OutboxItem = {
    id,
    path: input.path,
    method: input.method,
    body: queuedBody(input.body, id),
    needsAuth: input.needsAuth,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  write([...read(), item]);
  return item;
}

export function list(): OutboxItem[] {
  return read();
}

export function remove(id: string): void {
  write(read().filter((item) => item.id !== id));
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function isOffline(error: unknown): boolean {
  const navigatorOffline = typeof navigator !== "undefined" && "onLine" in navigator && !navigator.onLine;
  return error instanceof TypeError || navigatorOffline;
}

function updateAttempts(id: string): OutboxItem | undefined {
  const items = read();
  const current = items.find((item) => item.id === id);
  if (!current) return undefined;
  const updated = { ...current, attempts: current.attempts + 1 };
  write(items.map((item) => (item.id === id ? updated : item)));
  return updated;
}

async function sendItem(item: OutboxItem, options: FlushOptions, token: string | null | undefined): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (item.needsAuth && token) headers.Authorization = `Bearer ${token}`;
  return options.fetchImpl(item.path, {
    method: item.method,
    headers,
    body: JSON.stringify(item.body),
  });
}

export async function flush(options: FlushOptions): Promise<FlushResult> {
  const result: FlushResult = { sent: 0, failed: 0, dropped: 0 };
  for (const original of list()) {
    const item = updateAttempts(original.id);
    if (!item) continue;
    let response: Response;
    try {
      const token = await options.getToken();
      response = await sendItem(item, options, token);
      if (response.status === 401) {
        const refreshedToken = await options.getToken();
        response = await sendItem(item, options, refreshedToken);
      }
    } catch (_error) {
      result.failed += 1;
      continue;
    }

    if (response.ok) {
      remove(item.id);
      result.sent += 1;
    } else if (response.status >= 400 && response.status < 500 && response.status !== 401 && response.status !== 429) {
      remove(item.id);
      result.dropped += 1;
    } else {
      result.failed += 1;
    }
  }
  return result;
}
