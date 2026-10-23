import { test, expect, type Page } from '@playwright/test';

const uid = () => `u${Math.random().toString(36).slice(2, 10)}`;

/** テスト専用ログイン（ローカルかつ DEV_LOGIN=true のときだけ存在するルート） */
async function login(page: Page, u = uid()) {
  await page.goto(`/auth/dev-login?u=${u}`);
  await expect(page.getByTestId('app')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('avatar')).toBeVisible();
  return u;
}

async function serverChecks(page: Page): Promise<Record<string, { checked: boolean; note: string }>> {
  const res = await page.request.get('/api/checklist');
  expect(res.status()).toBe(200);
  return (await res.json()).checks;
}

test('ログインしていないときは Google ログインだけが出る', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('login')).toBeVisible();
  await expect(page.getByTestId('google-login')).toHaveText('Googleでログイン');
  await expect(page.getByTestId('next')).toHaveCount(0);
});

test('JS 到着前から全画面スケルトンが出て、React の画面に置き換わる', async ({ page }) => {
  await page.route('**/assets/app-*.js', async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.getByTestId('boot')).toBeVisible();
  await expect(page.getByTestId('boot').locator('.sk-row')).toHaveCount(6);
  await expect(page.getByTestId('boot')).toHaveCount(0, { timeout: 10_000 });
});

test('入国までの日数・進捗・次にやること・結果メモの欄が出る', async ({ page }) => {
  await login(page);
  await expect(page.getByTestId('days')).toContainText('日後に入国');
  await expect(page.getByTestId('progress')).toHaveText('0%');
  await expect(page.getByTestId('next').locator('.cl-item')).toHaveCount(5);
  await expect(page.getByTestId('memos')).toContainText('ここにまとまります');
  // 最初のセクションだけ開いている
  await expect(page.getByTestId('section-entry')).toHaveAttribute('data-open', 'true');
  await expect(page.getByTestId('section-city')).toHaveAttribute('data-open', 'false');
});

test('項目を開くとやり方と公式ページが読め、結果メモを書いて完了にできる', async ({ page }) => {
  await login(page);
  await page.getByTestId('next').getByTestId('item-entry-insurance').click();
  const sheet = page.getByTestId('sheet');
  await expect(sheet).toBeVisible();
  await expect(page.getByTestId('sheet-label')).toHaveText('海外医療保険に加入（4月1日から約1年間）');
  await expect(page.getByTestId('sheet-how')).toContainText('本国送還');
  await expect(page.getByTestId('sheet-how').locator('a.cl-source').first()).toHaveAttribute('href', /canada\.ca/);

  await page.getByTestId('sheet-note').fill('ABC保険 証券番号 12345');
  await page.getByTestId('sheet-done').click();

  const row = page.getByTestId('section-entry').getByTestId('item-entry-insurance');
  await expect(row).toHaveAttribute('data-done', 'true');
  await expect(row.locator('.cl-item-note')).toHaveText('ABC保険 証券番号 12345');
  await expect(page.getByTestId('memo-entry-insurance')).toContainText('ABC保険 証券番号 12345');
  await expect(page.getByTestId('done-count')).toHaveText(/^1\/\d+ 完了$/);

  await expect
    .poll(async () => (await serverChecks(page))['entry-insurance'])
    .toEqual(expect.objectContaining({ checked: true, note: 'ABC保険 証券番号 12345' }));
});

test('完了した項目は未完了に戻せる。閉じただけでもメモは残る', async ({ page }) => {
  await login(page);
  await page.getByTestId('next').getByTestId('item-entry-stay').click();
  await page.getByTestId('sheet-done').click();
  const row = page.getByTestId('section-entry').getByTestId('item-entry-stay');
  await expect(row).toHaveAttribute('data-done', 'true');

  await row.click();
  await expect(page.getByTestId('sheet-reopen')).toBeVisible();
  await page.getByTestId('sheet-reopen').click();
  await expect(row).toHaveAttribute('data-done', 'false');

  // 完了にせず閉じても、書いたメモは残る
  await row.click();
  await page.getByTestId('sheet-note').fill('候補：ダウンタウンのホステル');
  await page.keyboard.press('Escape');
  await expect(row).toHaveAttribute('data-done', 'false');
  await expect(row.locator('.cl-item-note')).toHaveText('候補：ダウンタウンのホステル');
  await expect
    .poll(async () => (await serverChecks(page))['entry-stay'])
    .toEqual(expect.objectContaining({ checked: false, note: '候補：ダウンタウンのホステル' }));
});

test('チェックとメモは再読み込みしても、別の端末でも残る', async ({ page, browser }) => {
  const u = await login(page);
  await page.getByTestId('next').getByTestId('item-entry-flight').click();
  await page.getByTestId('sheet-note').fill('ANA 4/1 成田→バンクーバー');
  await page.getByTestId('sheet-done').click();
  await expect.poll(async () => (await serverChecks(page))['entry-flight']?.checked).toBe(true);

  await page.reload();
  await expect(page.getByTestId('memo-entry-flight')).toContainText('ANA 4/1');

  const other = await browser.newContext();
  const p2 = await other.newPage();
  await login(p2, u);
  await expect(p2.getByTestId('memo-entry-flight')).toContainText('ANA 4/1');
  await expect(p2.getByTestId('section-entry').getByTestId('item-entry-flight')).toHaveAttribute('data-done', 'true');
  await other.close();
});

test('セクションは開いたり閉じたりできる', async ({ page }) => {
  await login(page);
  const city = page.getByTestId('section-city');
  await city.locator('.cl-section-head').click();
  await expect(city).toHaveAttribute('data-open', 'true');
  await expect(city.getByTestId('item-city-move-out')).toBeVisible();
  await city.locator('.cl-section-head').click();
  await expect(city).toHaveAttribute('data-open', 'false');
});

test('ほかの人のデータは見えない', async ({ page, browser }) => {
  await login(page);
  await page.getByTestId('next').getByTestId('item-entry-flight').click();
  await page.getByTestId('sheet-note').fill('自分だけのメモ');
  await page.getByTestId('sheet-done').click();
  await expect.poll(async () => (await serverChecks(page))['entry-flight']?.note).toBe('自分だけのメモ');

  const other = await browser.newContext();
  const p2 = await other.newPage();
  await login(p2);
  await expect(p2.getByTestId('memos')).toContainText('ここにまとまります');
  expect((await serverChecks(p2))['entry-flight']).toBeUndefined();
  await other.close();
});

test('書き込み API はカスタムヘッダーがないと拒否する（CSRF 対策）', async ({ page }) => {
  await login(page);
  const res = await page.request.put('/api/checklist/entry-flight', {
    data: { checked: true, note: '', updatedAt: Date.now() },
  });
  expect(res.status()).toBe(403);
});

test('ログアウトするとログイン画面に戻り、ローカルのデータも消える', async ({ page }) => {
  await login(page);
  await page.getByTestId('avatar').click();
  await expect(page.getByTestId('menu-email')).toContainText('@example.com');
  await page.getByTestId('logout').click();
  await expect(page.getByTestId('login')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('ca.v1.checks'))).toBeNull();
});
