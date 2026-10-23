# canada

カナダワーホリ（2027年4月1日 入国予定）でやらなければいけない手続きを、出発前から到着後・働き始めまで管理する自分専用の PWA。
白ベースの Liquid Glass UI をオレンジで、Cloudflare Workers + D1、Google ログインのみ。

| 操作 | 動き |
| --- | --- |
| 開く | 入国までの残り日数・進捗・次にやること5件・結果メモが出る |
| 項目をタップ | やり方（手順・持ち物・注意点）と公式ページのリンクが読め、結果メモを書いて「完了にする」 |
| 完了した項目をタップ | メモを直す／未完了に戻す（閉じただけでもメモは残る） |
| セクション見出しをタップ | 開く・閉じる |

項目はセクションごと（入国の条件／退職・税金／役所の手続き／出発・入国の日／到着／働き始め）に `src/lib/checklist.ts` にまとまっている。
やり方は IRCC・Service Canada・CRA・日本年金機構・国税庁・総務省・外務省などの公式ページで確認した内容で、確認日は `SOURCES_CHECKED_ON`。制度は変わるので、手続きの前にリンク先を確認する。

---

## 構成

```
src/                フロントエンド（React 19、esbuild）
  index.html        JS より先に出る全画面スケルトン（CSS はビルド時にインライン化）
  App.tsx           画面（進捗・次にやること・結果メモ・セクション・項目シート）
  lib/checklist.ts  項目・やり方・公式ページのデータ
  lib/store.ts      ローカル優先ストア（localStorage キャッシュ・送信キュー・Last-Write-Wins）
  components/       シート・ログイン・スケルトンなど
  sw.js             Service Worker（2回目以降は圏外でも開ける）
worker/             Cloudflare Worker（API・Google 認証）
migrations/         D1 スキーマ
scripts/            ビルド・アイコン生成・テスト用ローカルサーバー
tests/              Playwright E2E（iPhone 15 Pro 相当）
```

API は `GET /api/checklist` と `PUT /api/checklist/:id` だけ。D1 にはユーザーが変えた項目の `checked`・`note`・`updated_at` だけを保存する。
書き込みは `x-gt: 1` ヘッダー必須（CSRF 対策）、セッションは60日・Cookie は HttpOnly、DB にはトークンの SHA-256 だけを保存。

## 開発

```bash
npm install
npx playwright install chromium   # テストを回す場合
npm test                          # ビルド → E2E テスト
npm run local                     # http://localhost:8788 （/auth/dev-login でログイン）
```

## デプロイ（Cloudflare と GitHub の連携）

D1 データベース `canada` は作成済みで、`migrations/0001_init.sql` も本番に適用済み。

1. **Google のリダイレクト URI を追加**：Google Cloud Console →「API とサービス」→「認証情報」→ tasks で使っている OAuth クライアント ID を開き、承認済みのリダイレクト URI に
   `https://canada.challenger1124kt.workers.dev/auth/callback` を追加して保存。
2. **Cloudflare に Worker を作る**：Cloudflare ダッシュボード →「Workers & Pages」→「作成」→「Git リポジトリをインポート」→ `Moana73/canada` を選ぶ。
   - プロジェクト名：`canada`
   - ビルドコマンド：`npm run build`
   - デプロイコマンド：`npx wrangler deploy`
3. **秘密情報を登録**：作成した Worker の「設定」→「変数とシークレット」で、種類を「シークレット」にして追加。
   - `GOOGLE_CLIENT_SECRET`：tasks と同じクライアントシークレット
   - `ALLOWED_EMAILS`：ログインを許すGmail（自分専用にする）
4. `main` に push すると自動でビルド・デプロイされる。iPhone の Safari で `https://canada.challenger1124kt.workers.dev` を開き、共有ボタン →「ホーム画面に追加」。

## ライセンス
MIT
