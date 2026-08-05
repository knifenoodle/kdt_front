#!/usr/bin/env node
/**
 * 3턴 완주 → 보상 화면 실행 검증 + 캡처.
 *
 * "말했어요" 탭을 3회 눌러 턴 0→1→2를 전부 통과시키고 보상 화면 도달을 확인한다.
 * 이 스크립트는 시각 캡처인 동시에 **런타임 스모크 테스트**다 — 세션 흐름이
 * 실제로 reward 에 도달하지 못하면 실패로 종료한다(exit 1).
 *
 * 사용: BFF(:8100) + web(:3100 또는 인자로 지정) 이 떠 있는 상태에서
 *   node scripts/capture-full-session.mjs [web_port]
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = process.argv[2] || '3100';
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'screenshots');
mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--font-render-hinting=none', '--mute-audio'],
});

const page = await browser.newPage();
await page.setViewport({ width: 820, height: 1180, deviceScaleFactor: 2 });

// TTS 스텁 — window.speechSynthesis 는 읽기 전용 접근자라 defineProperty 로 교체해야 한다.
await page.evaluateOnNewDocument(() => {
  const stub = {
    speak: (u) => setTimeout(() => u.onend && u.onend(), 500),  // 실제 TTS 근사 — 너무 짧으면 폴링이 중간 상태를 놓친다
    cancel: () => {},
    getVoices: () => [],
    onvoiceschanged: null,
  };
  Object.defineProperty(window, 'speechSynthesis', { value: stub, configurable: true, writable: true });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    value: function (t) { this.text = t; this.onend = null; this.onerror = null; },
    configurable: true, writable: true,
  });
});

const bubbleText = async () => { try { return await page.$eval('main p', (e) => e.textContent.trim()); } catch { return ''; } };
const label = async () => { try { return await page.$eval('button[aria-label]', () => null); } catch { return null; } };
const hasButton = async (aria) => (await page.$(`button[aria-label="${aria}"]`)) !== null;

const waitFor = async (predicate, { tries = 200, interval = 50 } = {}) => {
  for (let i = 0; i < tries; i++) {
    if (await predicate()) return true;
    await wait(interval);
  }
  return false;
};

console.log(`대상: ${BASE}\n`);

await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
await page.click('button[aria-label="시작하기"]');
console.log('세션 시작');

let turnsCompleted = 0;
const MAX_TURNS = 3;

for (let turn = 0; turn < MAX_TURNS; turn++) {
  const gotButton = await waitFor(() => hasButton('말했어요'), { tries: 120, interval: 150 }); // 최대 18초 (LLM 대기 포함)
  if (!gotButton) {
    console.log(`  ❌ turn ${turn}: "말했어요" 버튼이 나타나지 않음`);
    await page.screenshot({ path: join(OUT, `fail-turn${turn}.png`) });
    await browser.close();
    process.exit(1);
  }
  const askLine = await bubbleText();
  console.log(`  turn ${turn} ask: "${askLine}"`);
  await page.screenshot({ path: join(OUT, `10-turn${turn}-ask.png`) });

  await page.click('button[aria-label="말했어요"]');
  const gotBack = await waitFor(async () => {
    const t = await bubbleText();
    return t && t !== askLine;
  });
  if (!gotBack) {
    console.log(`  ❌ turn ${turn}: back 대사가 재생되지 않음`);
    await browser.close();
    process.exit(1);
  }
  const backLine = await bubbleText();
  console.log(`  turn ${turn} back: "${backLine}"`);
  turnsCompleted++;
}

console.log(`\n${turnsCompleted}/${MAX_TURNS} 턴 완료. 보상 화면 대기...`);

const gotReward = await waitFor(() => hasButton('다시 하기'), { tries: 60, interval: 150 });
if (!gotReward) {
  console.log('  ❌ 보상 화면에 도달하지 못함 (다시 하기 버튼 없음)');
  await page.screenshot({ path: join(OUT, 'fail-no-reward.png') });
  await browser.close();
  process.exit(1);
}

await wait(400); // party 대사까지 잠깐 대기
const rewardLine = await bubbleText();
console.log(`  ✅ 보상 화면 도달. 문구: "${rewardLine}"`);
await page.screenshot({ path: join(OUT, '11-reward.png') });

// 터치 타깃 실측
const tapSize = await page.$eval('button[aria-label="다시 하기"]', (e) => {
  const r = e.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height) };
});
console.log(`  "다시 하기" 버튼 실측: ${tapSize.w}×${tapSize.h} (기대 ≥88)`);
if (tapSize.w < 88 || tapSize.h < 88) {
  console.log('  ❌ 주 버튼 크기 미달');
  await browser.close();
  process.exit(1);
}

// ── "다시 하기" 이후 처음부터 재시작되는지 ──────────────────────
await page.click('button[aria-label="다시 하기"]');
await wait(300);
const backToStart = await hasButton('시작하기');
console.log(`  "다시 하기" 이후 시작 화면 복귀: ${backToStart ? '✅' : '❌'}`);
if (!backToStart) {
  await browser.close();
  process.exit(1);
}

await browser.close();
console.log('\n전부 통과 — 3턴 완주 + 보상 화면 + 재시작 흐름 정상.');
