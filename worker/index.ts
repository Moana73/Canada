import type { Env, User } from './types';
import { currentUser, handleAuth } from './auth';
import { json } from './http';

const ITEM_ID_RE = /^[A-Za-z0-9-]{1,64}$/;

interface CheckRow {
  item_id: string;
  checked: number;
  note: string;
  updated_at: number;
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function isTs(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1e14;
}

async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  // 書き込み系はカスタムヘッダー必須（クロスサイトからは CORS プリフライトなしに付けられない＝CSRF 対策）
  if (req.method !== 'GET' && req.headers.get('x-gt') !== '1') {
    return json({ error: 'forbidden' }, 403);
  }

  const user = await currentUser(req, env);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const path = url.pathname;

  if (path === '/api/me' && req.method === 'GET') return json({ user });

  if (path === '/api/checklist' && req.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT item_id, checked, note, updated_at FROM checklist_checks WHERE user_id = ?')
      .bind(user.id)
      .all<CheckRow>();
    const checks: Record<string, { checked: boolean; note: string; updatedAt: number }> = {};
    for (const r of results) checks[r.item_id] = { checked: !!r.checked, note: r.note ?? '', updatedAt: r.updated_at };
    return json({ checks });
  }

  const m = path.match(/^\/api\/checklist\/([^/]+)$/);
  if (m && req.method === 'PUT') {
    const id = decodeURIComponent(m[1] ?? '');
    if (!ITEM_ID_RE.test(id)) return json({ error: 'bad_id' }, 400);
    return putItem(req, env, user, id);
  }

  return json({ error: 'not_found' }, 404);
}

async function putItem(req: Request, env: Env, user: User, id: string): Promise<Response> {
  const body = await readJson(req);
  if (!body || typeof body.checked !== 'boolean' || !isTs(body.updatedAt)) return json({ error: 'invalid' }, 400);
  const note = typeof body.note === 'string' ? body.note.slice(0, 2000) : '';
  // 項目は本人のものしかないので、新しい更新だけを反映する（Last-Write-Wins）
  await env.DB.prepare(
    `INSERT INTO checklist_checks (user_id, item_id, checked, note, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, item_id) DO UPDATE SET
       checked = excluded.checked, note = excluded.note, updated_at = excluded.updated_at
     WHERE excluded.updated_at >= checklist_checks.updated_at`,
  )
    .bind(user.id, id, body.checked ? 1 : 0, note, body.updatedAt)
    .run();
  return json({ ok: true });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith('/auth/')) return await handleAuth(req, env, url);
      if (url.pathname.startsWith('/api/')) return await handleApi(req, env, url);
      return await env.ASSETS.fetch(req);
    } catch (e) {
      console.error('unhandled', e);
      return json({ error: 'internal' }, 500);
    }
  },
};
