-- ユーザー（Google の sub を ID に使う）
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  picture TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

-- セッション（Cookie にはランダムトークン、DB には SHA-256 ハッシュだけ保存）
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- チェック状態と結果メモ。
-- 項目そのもの（文言・やり方・リンク）はフロントエンドの src/lib/checklist.ts に定義し、
-- ここにはユーザーが変えた項目の checked / note / updated_at だけを持つ。
CREATE TABLE IF NOT EXISTS checklist_checks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_id)
);
