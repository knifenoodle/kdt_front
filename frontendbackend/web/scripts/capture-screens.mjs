/**
 * 실제 실행 화면 캡처 — 시연·공유용.
 *
 * 문서의 주장("터치 76/88", "오류 색 없음", "글자 없이 작동")을 말로만 두지 않고
 * 실물 스크린샷으로 남긴다. 규칙 4 검증(글자 전부 끄기)도 함께 캡처한다.
 *
 * 사용: BFF(:8100) + web(:3000) 이 떠 있는 상태에서
 *   node scripts/capture-screens.mjs
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'screenshots');
mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--font-render-hinting=none', '--mute-audio'],
});

const page = await browser.newPage();
// 태블릿 세로 — 만 4~6세가 실제로 쓰는 형태
await page.setViewport({ width: 820, height: 1180, deviceScaleFactor: 2 });

// TTS 는 헤드리스에서 콜백이 오지 않으므로 즉시 완료되게 스텁을 넣는다.
// (화면 전환 로직 자체는 그대로 돈다)
await page.evaluateOnNewDocument(() => {
  // window.speechSynthesis 는 읽기 전용 접근자다 — 단순 대입은 조용히 실패한다.
  // (실제로 그 함정에 빠져 첫 캡처가 고지 화면에서 멈췄다)
  const stub = {
    speak: (u) => setTimeout(() => u.onend && u.onend(), 300),
    cancel: () => {},
    getVoices: () => [],
    onvoiceschanged: null,
  };
  Object.defineProperty(window, 'speechSynthesis', {
    value: stub, configurable: true, writable: true,
  });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    value: function (t) { this.text = t; this.onend = null; this.onerror = null; },
    configurable: true, writable: true,
  });
});

const bubbleText = async (p = page) => {
  try { return await p.$eval('main p', (e) => e.textContent.trim()); } catch { return ''; }
};
const shot = async (name, note) => {
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  const b = await bubbleText();
  console.log(`  ✅ ${name}.png  — ${note}${b ? `\n        말풍선: "${b}"` : ''}`);
};

console.log('캡처 시작\n');

// ── 1. 시작 화면 ────────────────────────────────────────────────
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' });
await wait(700);
await shot('01-start', '시작 화면 · 송편 + "오늘은 싫다고 말하기"');

// 터치 타깃 실측 (문서 주장 검증)
const taps = await page.$$eval('button', (els) =>
  els.map((e) => {
    const r = e.getBoundingClientRect();
    return { label: e.getAttribute('aria-label'), w: Math.round(r.width), h: Math.round(r.height) };
  }),
);
console.log('     터치 타깃 실측:', JSON.stringify(taps));

// ── 2. 규칙 4 검증: 글자 전부 끄기 ──────────────────────────────
await page.addStyleTag({ content: '.txt{visibility:hidden !important}' });
await wait(200);
await shot('02-start-no-text', '규칙 4 · 글자를 전부 숨겨도 다음 행동을 알 수 있는가');
await page.evaluate(() => {
  document.querySelectorAll('style').forEach((s) => {
    if (s.textContent.includes('visibility:hidden')) s.remove();
  });
});

// ── 3. 세션 시작 → Talk 화면 ────────────────────────────────────
await page.click('button[aria-label="시작하기"]');
await wait(150);
await shot('03-talk-disclosure', 'AI 고지 재생 중 · "나는 컴퓨터가 만든 친구야"');

// 인트로(백엔드 background 주입) 가 뜰 때까지 기다린다
for (let i = 0; i < 20; i++) {
  await wait(120);
  if ((await bubbleText()).includes('싫으면 싫다고')) break;
}
await shot('04-talk-intro', '상황 안내 · 백엔드 background 주입');

// 시범 3줄 → turn 1 ask 까지
for (let i = 0; i < 20; i++) {
  await wait(120);
  if ((await bubbleText()).includes('안 돼. 이건')) break;
}
await shot('05-talk-demo', '시범 · 송편이 단호하게 거절하는 모범 시연 (아이는 듣기만)');

// 🚨 지연 은닉(M5) 이 실제로 작동하는 순간 — 로딩 스피너가 아니라 캐릭터 thinking 상태
for (let i = 0; i < 30; i++) {
  await wait(150);
  if ((await bubbleText()).includes('기다려줘')) break;
}
await shot('06-thinking', '지연 은닉 · 로딩 스피너 대신 캐릭터 thinking + "조금만 기다려줘"');

// LLM 응답이 도착해 turn 1 ask 로 넘어갈 때까지 (실측 6~9초)
const SYSTEM_LINES = ['컴퓨터가 만든', '보여줄게', '싫으면 싫다고', '안 돼. 이건', '알았어', '기다려줘'];
for (let i = 0; i < 90; i++) {
  await wait(200);
  const b = await bubbleText();
  if (b && !SYSTEM_LINES.some((x) => b.includes(x))) break;
}
await shot('07-talk-turn1', 'turn 1 · 백엔드 LLM 이 생성한 대사가 말풍선 + TTS 로');

// ── 4. 접근성: 움직임 최소화 ────────────────────────────────────
const p2 = await browser.newPage();
await p2.setViewport({ width: 820, height: 1180, deviceScaleFactor: 2 });
await p2.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await p2.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle0' });
await wait(700);
await p2.screenshot({ path: join(OUT, '08-reduced-motion.png') });
console.log('  ✅ 08-reduced-motion.png — prefers-reduced-motion: reduce');

// ── 5. 개발 하네스 ──────────────────────────────────────────────
const p3 = await browser.newPage();
await p3.setViewport({ width: 1000, height: 1300, deviceScaleFactor: 2 });
await p3.goto('http://127.0.0.1:3000/__dev', { waitUntil: 'networkidle0' });
await wait(900);
await p3.screenshot({ path: join(OUT, '09-dev-harness.png') });
console.log('  ✅ 09-dev-harness.png — /__dev 헬스체크 (제품 경로 아님)');

await browser.close();
console.log('\n완료 →', OUT);
