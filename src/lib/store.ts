// ローカル優先ストア。
// 項目の文言・やり方は checklist.ts の静的データ。チェック状態と結果メモだけをサーバー（D1）と同期する。
// - 表示データは localStorage にキャッシュ → 2回目以降は通信を待たずに一覧が出る
// - 変更は送信キューに積んでから送る → 圏外で書いたメモも消えない
// - サーバーとの競合は updatedAt による Last-Write-Wins
import { api, HttpError } from './api';
import type { User } from './types';
import { DEFAULT_CHECKED } from './checklist';

type Check = { checked: boolean; note: string; updatedAt: number };
type Op = { id: string; checked: boolean; note: string; ts: number };

export interface State {
  user: User | null;
  ready: boolean;
  checks: Record<string, Check>;
  offline: boolean;
}

const K = { user: 'ca.v1.user', checks: 'ca.v1.checks', outbox: 'ca.v1.outbox', owner: 'ca.v1.owner' } as const;

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* プライベートモード等では保存しない */
  }
}

let state: State = {
  user: read<User | null>(K.user, null),
  ready: false,
  checks: read<Record<string, Check>>(K.checks, {}),
  offline: false,
};
let outbox: Op[] = read<Op[]>(K.outbox, []);
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  if ('checks' in patch) write(K.checks, state.checks);
  if ('user' in patch) write(K.user, state.user);
  listeners.forEach((l) => l());
}

function enqueue(op: Op) {
  outbox = outbox.filter((o) => o.id !== op.id);
  outbox.push(op);
  write(K.outbox, outbox);
}

let lastTs = 0;
const now = () => (lastTs = Math.max(Date.now(), lastTs + 1));

let running: Promise<void> | null = null;
let again = false;
let againFull = false;

async function flush() {
  while (outbox.length) {
    const op = outbox[0]!;
    try {
      await api.put(op.id, op.checked, op.note ?? '', op.ts);
    } catch (e) {
      if (!(e instanceof HttpError) || e.status === 401 || e.status >= 500) throw e;
    }
    outbox = outbox.filter((o) => o !== op);
    write(K.outbox, outbox);
  }
}

function merge(server: Record<string, { checked: boolean; note?: string; updatedAt: number }>): Record<string, Check> {
  const out: Record<string, Check> = {};
  for (const [id, c] of Object.entries(server)) out[id] = { checked: c.checked, note: c.note ?? '', updatedAt: c.updatedAt };
  for (const op of outbox) out[op.id] = { checked: op.checked, note: op.note ?? '', updatedAt: op.ts };
  return out;
}

function handleSyncError(e: unknown) {
  if (e instanceof HttpError && e.status === 401) set({ user: null, ready: true });
  else set({ offline: true, ready: true });
}

export const store = {
  get: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  isChecked(id: string): boolean {
    return state.checks[id]?.checked ?? DEFAULT_CHECKED[id] ?? false;
  },

  /** 完了にしたときなどに書いた結果メモ */
  noteOf(id: string): string {
    return state.checks[id]?.note ?? '';
  },

  async boot() {
    try {
      const { user } = await api.me();
      const owner = read<string | null>(K.owner, null);
      if (owner && owner !== user.id) {
        // 別のアカウントでログインし直した：前のユーザーのローカルデータは持ち込まない
        outbox = [];
        write(K.outbox, outbox);
        set({ checks: {} });
      }
      write(K.owner, user.id);
      set({ user });
      await store.sync(true);
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) set({ user: null, ready: true });
      else set({ offline: true, ready: true });
    }
  },

  sync(full = false): Promise<void> {
    if (!state.user) return Promise.resolve();
    if (running) {
      again = true;
      againFull ||= full;
      return running;
    }
    running = (async () => {
      let doFull = full;
      do {
        again = false;
        await flush();
        if (doFull) {
          const { checks } = await api.checklist();
          set({ checks: merge(checks), offline: false, ready: true });
        } else if (state.offline) {
          set({ offline: false });
        }
        doFull = againFull;
        againFull = false;
      } while (again);
    })()
      .catch(handleSyncError)
      .finally(() => {
        running = null;
        if (!state.ready) set({ ready: true });
      });
    return running;
  },

  /** チェック状態・結果メモを更新（変わっていなければ何もしない） */
  update(id: string, patch: { checked?: boolean; note?: string }) {
    const checked = patch.checked ?? store.isChecked(id);
    const note = (patch.note ?? store.noteOf(id)).slice(0, 2000);
    if (checked === store.isChecked(id) && note === store.noteOf(id)) return;
    const ts = now();
    set({ checks: { ...state.checks, [id]: { checked, note, updatedAt: ts } } });
    enqueue({ id, checked, note, ts });
    void store.sync();
  },

  async logout() {
    try {
      await api.logout();
    } catch {
      /* 圏外でもローカルは消す */
    }
    outbox = [];
    set({ user: null, checks: {}, ready: true });
    // set() は checks と user を localStorage に書き戻すので、消すのはその後
    for (const k of Object.values(K)) write(k, null);
  },
};
