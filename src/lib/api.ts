import type { User } from './types';

export class HttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: { 'x-gt': '1', ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
  });
  if (!res.ok) throw new HttpError(res.status);
  return (await res.json()) as T;
}

export const api = {
  me: () => call<{ user: User }>('/api/me'),
  checklist: () => call<{ checks: Record<string, { checked: boolean; note?: string; updatedAt: number }> }>('/api/checklist'),
  put: (id: string, checked: boolean, note: string, updatedAt: number) =>
    call<{ ok: true }>(`/api/checklist/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ checked, note, updatedAt }),
    }),
  logout: () => call<{ ok: true }>('/auth/logout', { method: 'POST' }),
};
