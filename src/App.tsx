import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { store } from './lib/store';
import { ALL_ITEMS, SECTIONS, SOURCES_CHECKED_ON, daysUntilDeparture, type ChecklistItem, type ChecklistSection } from './lib/checklist';
import { Avatar, ListSkeleton, LoginCard, Toast, type ToastData } from './components/Chrome';
import { Sheet } from './components/Sheet';
import { Check, Chevron, ChevronRight, Logout } from './components/icons';

const useStore = () => useSyncExternalStore(store.subscribe, store.get);

const ITEM_BY_ID = new Map(ALL_ITEMS.map((x) => [x.item.id, x]));

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${Number(y)}年${Number(m)}月${Number(d)}日`;
}

function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timers = useRef<number[]>([]);
  const show = useCallback((text: string, ms = 2600) => {
    timers.current.forEach(clearTimeout);
    const id = Date.now();
    setToast({ id, text });
    timers.current = [
      window.setTimeout(() => setToast((t) => (t && t.id === id ? { ...t, out: true } : t)), ms),
      window.setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), ms + 320),
    ];
  }, []);
  return { toast, show };
}

/** 1項目。タップするとやり方と結果メモのシートが開く */
function Item({ item, onOpen }: { item: ChecklistItem; onOpen(id: string): void }) {
  const done = store.isChecked(item.id);
  const note = store.noteOf(item.id);
  const open = () => onOpen(item.id);
  return (
    <div
      className="cl-item"
      data-done={done ? 'true' : 'false'}
      data-testid={`item-${item.id}`}
      role="button"
      aria-label={`${item.label}（${done ? '完了' : '未完了'}）`}
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      <span className="cl-check">
        <Check />
      </span>
      <span className="cl-item-body">
        <span className="cl-item-label">{item.label}</span>
        {note && <span className="cl-item-note">{note}</span>}
      </span>
      {item.how.length > 0 && (
        <span className="cl-item-more" aria-hidden="true">
          <ChevronRight />
        </span>
      )}
    </div>
  );
}

function Section({
  section,
  open,
  onToggleOpen,
  onOpenItem,
}: {
  section: ChecklistSection;
  open: boolean;
  onToggleOpen(): void;
  onOpenItem(id: string): void;
}) {
  const done = section.items.filter((i) => store.isChecked(i.id)).length;
  const complete = done === section.items.length;
  return (
    <section className="cl-section glass" data-open={open ? 'true' : 'false'} data-testid={`section-${section.id}`}>
      <button type="button" className="cl-section-head" onClick={onToggleOpen} aria-expanded={open}>
        <div className="cl-section-title">{section.title}</div>
        <span className="cl-count" data-complete={complete ? 'true' : 'false'}>
          {done}/{section.items.length}
        </span>
        <Chevron className="cl-chevron" />
      </button>
      {open && (
        <div className="cl-section-body">
          {section.items.map((it) => (
            <Item key={it.id} item={it} onOpen={onOpenItem} />
          ))}
        </div>
      )}
    </section>
  );
}

/** 書いた結果メモをまとめて見る場所 */
function MemoCard({ onOpenItem }: { onOpenItem(id: string): void }) {
  const memos = ALL_ITEMS.filter(({ item }) => store.noteOf(item.id).trim());
  return (
    <div className="cl-memos glass" data-testid="memos">
      <div className="cl-card-title">結果メモ</div>
      {memos.length === 0 ? (
        <p className="cl-memos-empty">項目を完了にするときに書いたメモが、ここにまとまります。</p>
      ) : (
        memos.map(({ item }) => (
          <button key={item.id} type="button" className="cl-memo" data-testid={`memo-${item.id}`} onClick={() => onOpenItem(item.id)}>
            <span className="cl-memo-label">{item.label}</span>
            <span className="cl-memo-text">{store.noteOf(item.id)}</span>
          </button>
        ))
      )}
    </div>
  );
}

/** 項目を開いたときのシート：やり方を読み、結果メモを書いて完了にする／完了を戻す */
function ItemSheet({ id, open, onClose }: { id: string | null; open: boolean; onClose(): void }) {
  const entry = id ? ITEM_BY_ID.get(id) : undefined;
  const [note, setNote] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = id ? store.isChecked(id) : false;

  useEffect(() => {
    if (id && open) setNote(store.noteOf(id));
  }, [id, open]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [note, open]);

  // 閉じるときは、完了ボタンを押していなくてもメモだけは残す
  const close = () => {
    if (id) store.update(id, { note });
    onClose();
  };
  const complete = () => {
    if (id) store.update(id, { checked: true, note });
    onClose();
  };
  const reopen = () => {
    if (id) store.update(id, { checked: false, note });
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} testid="sheet" label="やり方と結果メモ">
      {entry && (
        <>
          <div className="cl-sheet-head">
            <div className="cl-sheet-section">{entry.sectionTitle}</div>
            <div className="cl-sheet-label" data-testid="sheet-label">
              {entry.item.label}
            </div>
          </div>
          {(entry.item.how.length > 0 || entry.item.links.length > 0) && (
            <div className="cl-how" data-sheet-scroll data-testid="sheet-how">
              {entry.item.how.length > 0 && (
                <>
                  <div className="cl-how-title">やり方</div>
                  <ol className="cl-how-steps">
                    {entry.item.how.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ol>
                </>
              )}
              {entry.item.links.length > 0 && (
                <div className="cl-sources">
                  <div className="cl-sources-title">公式ページ</div>
                  {entry.item.links.map((l) => (
                    <a key={l.url} className="cl-source" href={l.url} target="_blank" rel="noopener noreferrer">
                      {l.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
          <textarea
            ref={ref}
            className="field"
            data-testid="sheet-note"
            aria-label="結果メモ"
            placeholder="結果メモ（例：どこで・何に決めたか、番号、日付）"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {done ? (
            <div className="row">
              <button type="button" className="btn btn-plain" data-testid="sheet-reopen" onClick={reopen}>
                未完了に戻す
              </button>
              <button type="button" className="btn cl-btn-primary" data-testid="sheet-save" onClick={close}>
                保存
              </button>
            </div>
          ) : (
            <button type="button" className="btn cl-btn-primary" data-testid="sheet-done" onClick={complete}>
              <Check />
              完了にする
            </button>
          )}
        </>
      )}
    </Sheet>
  );
}

const AUTH_ERRORS: Record<string, string> = {
  denied: 'このアカウントでは使えません',
  google_access_denied: 'Googleでアクセスが拒否されました',
  secret: 'サーバーにクライアントシークレットが未登録です',
  token: 'クライアントシークレットが一致しません',
  state: 'もう一度ログインしてください',
  token_invalid_grant: 'もう一度ログインしてください（Googleの確認コードが無効）',
};

export function App() {
  const s = useStore();
  const { toast, show } = useToast();
  const [menu, setMenu] = useState(false);

  // 静的スケルトン（#boot）から React の画面へ、描画前に差し替える
  useLayoutEffect(() => {
    document.getElementById('boot')?.remove();
  }, []);

  useEffect(() => {
    void store.boot();
    const params = new URLSearchParams(location.search);
    if (params.has('auth_error')) {
      const code = params.get('auth_error') ?? '';
      show(`ログインできませんでした：${AUTH_ERRORS[code] ?? code}`, 8000);
      history.replaceState(null, '', '/');
    }
    const resync = () => document.visibilityState === 'visible' && void store.sync(true);
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('online', resync);
    return () => {
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('online', resync);
    };
  }, [show]);

  const days = useMemo(() => daysUntilDeparture(new Date()), []);

  // 初期状態：まだ終わっていない項目がある最初のセクションだけ開く
  const firstOpenId = useMemo(
    () => SECTIONS.find((sec) => sec.items.some((i) => !store.isChecked(i.id)))?.id ?? null,
    // 読み込み完了時点の状態で決める
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.ready],
  );
  const [openIds, setOpenIds] = useState<Set<string> | null>(null);
  const effectiveOpen = openIds ?? new Set(firstOpenId ? [firstOpenId] : []);
  const toggleOpen = (id: string) => {
    const next = new Set(effectiveOpen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpenIds(next);
  };

  // 開いている項目（シートを閉じるアニメーション中も中身を保つ）
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const openItem = (id: string) => {
    setSheetId(id);
    setSheetOpen(true);
  };

  const totalDone = ALL_ITEMS.filter(({ item }) => store.isChecked(item.id)).length;
  const totalAll = ALL_ITEMS.length;
  const pct = totalAll ? totalDone / totalAll : 0;
  const R = 31;
  const C = 2 * Math.PI * R;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nextUp = useMemo(() => ALL_ITEMS.filter(({ item }) => !store.isChecked(item.id)).slice(0, 5), [s]);

  return (
    <>
      <div className="app" data-testid="app" data-ready={s.ready ? 'true' : 'false'}>
        <header className="top">
          <div className="bar cl-head">
            <div className="cl-head-text">
              <div className="cl-title">カナダワーホリ準備</div>
              <div className="cl-sub">入国予定 2027年4月1日</div>
            </div>
            <Avatar user={s.user} onClick={() => setMenu(true)} />
          </div>
        </header>

        <main className="list" data-testid="list">
          {!s.ready ? (
            <ListSkeleton />
          ) : !s.user ? (
            <LoginCard />
          ) : (
            <>
              <div className="cl-hero glass">
                <div className="cl-ring">
                  <svg viewBox="0 0 76 76">
                    <circle className="cl-ring-track" cx="38" cy="38" r={R} />
                    <circle className="cl-ring-bar" cx="38" cy="38" r={R} strokeDasharray={`${C * pct} ${C}`} />
                  </svg>
                  <div className="cl-ring-label" data-testid="progress">
                    {Math.round(pct * 100)}%
                  </div>
                </div>
                <div className="cl-hero-body">
                  <div className="cl-days" data-testid="days">
                    {days >= 0 ? days : 0}
                    <span>日後に入国</span>
                  </div>
                  <div className="cl-phase" data-testid="done-count">
                    {totalDone}/{totalAll} 完了
                  </div>
                </div>
              </div>

              {nextUp.length > 0 && (
                <div className="cl-next glass" data-testid="next">
                  <div className="cl-card-title">次にやること</div>
                  {nextUp.map(({ item }) => (
                    <Item key={item.id} item={item} onOpen={openItem} />
                  ))}
                </div>
              )}

              <MemoCard onOpenItem={openItem} />

              {SECTIONS.map((sec) => (
                <Section
                  key={sec.id}
                  section={sec}
                  open={effectiveOpen.has(sec.id)}
                  onToggleOpen={() => toggleOpen(sec.id)}
                  onOpenItem={openItem}
                />
              ))}

              <p className="cl-foot">
                やり方は {fmtDate(SOURCES_CHECKED_ON)} 時点の公式情報です。制度は変わるので、手続きの前にリンク先で最新の内容を確認してください。
              </p>
            </>
          )}
        </main>
      </div>

      <ItemSheet id={sheetId} open={sheetOpen} onClose={() => setSheetOpen(false)} />

      <Sheet open={menu} onClose={() => setMenu(false)} testid="menu" label="アカウント">
        <div className="menu-email" data-testid="menu-email">
          {s.user?.email}
        </div>
        <button
          type="button"
          className="btn btn-plain"
          data-testid="logout"
          onClick={async () => {
            setMenu(false);
            await store.logout();
          }}
        >
          <Logout />
          ログアウト
        </button>
      </Sheet>

      <Toast toast={toast} />
    </>
  );
}
