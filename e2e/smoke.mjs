// Smoke test against the built web bundle: npm run build, then
//   node e2e/smoke.mjs
// Requires playwright (any install). If Playwright's own browser
// download is unavailable, point CHROMIUM_BIN at any Chrome/Chromium
// headless binary (e.g. Chrome for Testing's chrome-headless-shell).

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const DIST = new URL('../dist', import.meta.url).pathname;
const CHS = process.env.CHROMIUM_BIN;
const PORT = 8123;

const ok = (m) => console.log(`  ok  ${m}`);
const fail = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };

const server = spawn('python3', ['-m', 'http.server', String(PORT), '-d', DIST]);
process.on('exit', () => server.kill());
await new Promise((r) => setTimeout(r, 800));

const browser = await chromium.launch(CHS ? { executablePath: CHS } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });

// Seed: TMs set, 531 week, all features on; an old squat session
// (baseline for PR detection) and a bench session from today (for the
// duplicate-save guard).
await ctx.addInitScript(() => {
  const old = new Date(Date.now() - 10 * 86400000).toISOString();
  const today = new Date().toISOString();
  localStorage.setItem('gymtracker_lifts', JSON.stringify({
    squat: { tm: 315, assistance: '' },
    bench: { tm: 225, assistance: '' },
    deadlift: { tm: 405, assistance: '' },
    ohp: { tm: 135, assistance: '' },
  }));
  localStorage.setItem('gymtracker_settings', JSON.stringify({
    unit: 'lb', repScheme: '531', darkMode: 'light',
  }));
  localStorage.setItem('gymtracker_logs', JSON.stringify([
    { id: 'seed-bench', liftKey: 'bench', repScheme: '531', date: today,
      sets: [{ weight: 170, reps: 5 }, { weight: 190, reps: 3 }, { weight: 215, reps: 1 }] },
    { id: 'seed-squat', liftKey: 'squat', repScheme: '555', date: old,
      sets: [{ weight: 205, reps: 5 }, { weight: 235, reps: 5 }, { weight: 250, reps: 5 }] },
  ]));
});

const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
await page.waitForSelector('text=Training Max', { timeout: 20000 });
ok('app booted with seeded data');

// 1. Pinned Save visible without scrolling
const save = page.locator('text=Save Squat').first();
await save.waitFor({ timeout: 8000 });
const box = await save.boundingBox();
if (!box || box.y + box.height > 780) fail(`Save button not in viewport: ${JSON.stringify(box)}`);
ok('Save button pinned inside the viewport');

// 2. Warm-up section (feature on) expands
await page.locator('text=/^Warm-up/').first().click();
await page.waitForSelector('text=40% · 5 reps', { timeout: 5000 });
ok('warm-up rows expand with 40/50/60 ramp');

// 3. AMRAP stepper on the top set, e1RM hint reacts
await page.waitForSelector('text=1+ target', { timeout: 5000 });
// exact-match: 'text=+' would substring-match "1+ target"; all four
// pager pages are in the DOM, squat is first.
const plus = page.locator('text="+"').first();
for (let i = 0; i < 4; i++) await plus.click(); // 1 → 5 reps
await page.waitForSelector('text=/e1RM 350 lb/', { timeout: 5000 });
ok('AMRAP stepper live-updates e1RM (300×5 → 350)');

// 4. Save → toast + section shows in Log with PR chip
await save.click();
await page.waitForSelector('text=Squat logged', { timeout: 5000 });
ok('save shows toast feedback (web!)');

// 5. Duplicate save prompts a confirm
let dialogMsg = '';
page.once('dialog', (d) => { dialogMsg = d.message(); d.dismiss(); });
await save.click();
await page.waitForFunction(() => true); // yield
if (!dialogMsg.includes('Already logged today')) fail(`no dup guard, dialog: "${dialogMsg}"`);
ok('duplicate save guarded by confirm');

// 6. Log tab: PR chip, pluralization
await page.locator('text=Log').last().click();
await page.waitForSelector('text=Recent Sessions', { timeout: 8000 });
await page.waitForSelector('text=2 entries', { timeout: 5000 });
ok('section header pluralizes correctly ("2 entries")');
await page.waitForSelector('text=PR', { timeout: 5000 });
ok('PR chip shown for the new squat e1RM');

// 7. Trend renders without crash
await page.locator('text=/Show trend/').click();
await page.waitForSelector('text=/Hide trend/', { timeout: 5000 });
ok('trend chart toggles');

// 8. Settings: switch warm-ups off → Train hides the section
await page.locator('text=Settings').last().click();
await page.waitForSelector('text=Features', { timeout: 8000 });
const switches = page.locator('input[type="checkbox"], [role="switch"]');
await switches.nth(1).click(); // second row = Warm-up sets
await page.locator('text=Train').last().click();
await page.waitForSelector('text=Training Max', { timeout: 8000 });
// tab screens stay mounted, so Settings' "Warm-up sets" row is still in
// the DOM — only the Train section header carries the chevron
if (await page.locator('text=/^Warm-up [▾▴]/').count() > 0) {
  fail('warm-ups still visible after toggle off');
}
ok('feature toggle hides warm-ups');

await browser.close();
console.log('PASS');
process.exit(0);
