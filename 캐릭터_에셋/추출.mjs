/**
 * 또랑 캐릭터 에셋 추출기
 * ────────────────────────────────────────────────────────────────
 * mockup-v1.html 안의 인라인 SVG 함수를 그대로 실행해 독립 실행 가능한
 * .svg 파일과 투명 배경 .png 로 뽑는다. 목업이 사라져도 이 스크립트와
 * 결과물만 있으면 같은 디자인을 복원할 수 있다.
 *
 *   node 추출.mjs
 *
 * 출력: svg/*.svg · png/*.png · 캐릭터_시트.png
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE   = path.dirname(fileURLToPath(import.meta.url));
const MOCKUP = path.join(HERE, '..', 'mockup-v1.html');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SIZE   = 512;

const html = fs.readFileSync(MOCKUP, 'utf8');
const js   = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
const css  = html.split('<style>')[1].split('</style>')[0];

/* ── 1. :root 의 CSS 변수를 실제 색으로 풀어낸다 ──────────────── */
const VARS = {};
for (const m of css.matchAll(/--([a-z-]+)\s*:\s*([^;]+);/g)) VARS[m[1]] = m[2].trim();
const resolve = s => {
  let out = s, guard = 0;
  while (out.includes('var(--') && guard++ < 8) {
    out = out.replace(/var\(--([a-z-]+)\)/g, (_, k) => (VARS[k] ?? '#000000').replace(/\s*\/\*.*$/, ''));
  }
  return out;
};

/* ── 2. 목업의 JS 를 그대로 실행해 svg* 함수를 얻는다 ─────────── */
const sandbox = {
  Math, JSON, console,
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  location: { hash: '' },
  window: { addEventListener: () => {}, innerWidth: 1000, innerHeight: 1400 },
  document: {
    getElementById: () => ({ innerHTML: '', style: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
                             setAttribute(){}, addEventListener(){}, querySelectorAll: () => [], children: [] }),
    querySelectorAll: () => [], createElement: () => ({ style: { setProperty(){} }, classList: { add(){}, remove(){} } }),
    addEventListener: () => {}, body: { classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } } },
    documentElement: { style: { setProperty(){} } }
  }
};
vm.createContext(sandbox);
vm.runInContext(js, sandbox);

/* ── 3. 독립 SVG 로 감싼다 ────────────────────────────────────
   목업에서는 얼굴 부위 표시를 CSS 가 정한다. 파일 하나로 열려야 하므로
   idle · 무표정 기준의 최소 스타일을 인라인으로 넣는다.
   ⚠ 부위(입 7종·눈썹·눈물·볼·반짝)는 전부 들어 있고 숨겨져 있을 뿐이다.
      display 만 바꾸면 감정 표정을 그대로 재현할 수 있다.            */
const BASE_STYLE = `
    .eye{fill:#3B3222}
    .eye-arc{display:none;fill:none;stroke:#3B3222;stroke-width:7;stroke-linecap:round}
    .brows{display:none}
    .brow{fill:none;stroke:#3B3222;stroke-width:7;stroke-linecap:round}
    .mouth{display:none;fill:none;stroke:#3B3222;stroke-width:6;stroke-linecap:round}
    .m-grin,.m-o{fill:#7A4A48;stroke:none}
    .m-smile{display:block}          /* idle 기본 표정 */
    .extras>*{display:none}
    .blush ellipse{fill:#F09AA8;opacity:.6}
    .tear{fill:#7FB3E8} .sweat{fill:#9CC9F0} .spark path{fill:#FFC12E}
    .dots,.hand{display:none}
    .yk-syrup{display:none}         /* 약과 화해 조청 — 연출 중에만 */
    .kk-drip{display:none}          /* 꿀떡 흘러넘치는 방울 — 누를 때만 */
    .honey-coat{display:none}       /* 무지개떡 꿀 코팅 — 완성 보상에서만 */
    .pat-burst{display:none}`;      /* 시루떡 팥고물 — 마음 열릴 때만 */

function standalone(svg, vb) {
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${SIZE}" height="${SIZE}">
  <style>${BASE_STYLE}
  </style>
${resolve(inner)}
</svg>
`;
}

/* ── 4. 뽑을 목록 ─────────────────────────────────────────────── */
const C = sandbox.SONG_COLORS;
const ITEMS = [
  ['songpyeon-green', '송편 (쑥·기본)',  () => sandbox.svgSongpyeon(C[0].body, C[0].dark), '0 0 220 220'],
  ['songpyeon-white', '송편 (흰)',       () => sandbox.svgSongpyeon(C[1].body, C[1].dark), '0 0 220 220'],
  ['songpyeon-pink',  '송편 (분홍)',     () => sandbox.svgSongpyeon(C[2].body, C[2].dark), '0 0 220 220'],
  ['sirutteok',       '시루떡',          sandbox.svgSirutteok,   '0 0 240 240'],
  ['garaetteok',      '가래떡',          sandbox.svgGaraetteok,  '0 0 200 200'],
  ['injeolmi',        '인절미',          sandbox.svgInjeolmi,    '0 0 200 200'],
  ['kkultteok',       '꿀떡',            sandbox.svgKkultteok,   '0 0 200 200'],
  ['yakgwa',          '약과',            sandbox.svgYakgwa,      '0 0 200 200'],
  ['baekseolgi',      '백설기',          sandbox.svgBaekseolgi,  '0 0 200 200'],
  ['mujigaetteok',    '무지개떡',        sandbox.svgRainbow,     '0 0 240 240'],
  ['honeypot',        '꿀단지',          sandbox.svgHoneyPot,    '0 0 220 200']
];

/* 무지개떡은 목업에서 미완성 층이 반투명이다. 에셋은 전부 채운 상태로 뽑는다 */
const fillRainbow = s => s.replace(/class="rl"/g, 'class="rl" opacity="1"');

fs.mkdirSync(path.join(HERE, 'svg'), { recursive: true });
fs.mkdirSync(path.join(HERE, 'png'), { recursive: true });

const made = [];
for (const [key, label, fn, vb] of ITEMS) {
  let svg = standalone(fn(), vb);
  if (key === 'mujigaetteok') svg = fillRainbow(svg);
  fs.writeFileSync(path.join(HERE, 'svg', key + '.svg'), svg);
  made.push({ key, label });
  console.log('  svg  ✓', key);
}

/* ── 5. PNG (투명 배경) ───────────────────────────────────────── */
if (fs.existsSync(CHROME)) {
  for (const { key } of made) {
    execFileSync(CHROME, [
      '--headless', '--disable-gpu', '--default-background-color=00000000',
      `--screenshot=${path.join(HERE, 'png', key + '.png')}`,
      `--window-size=${SIZE},${SIZE}`, '--virtual-time-budget=800',
      'file://' + encodeURI(path.join(HERE, 'svg', key + '.svg'))
    ], { stdio: 'ignore' });
    console.log('  png  ✓', key);
  }

  /* ── 6. 한 장짜리 캐릭터 시트 ─────────────────────────────── */
  const sheet = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#F4F1FB;font-family:"Apple SD Gothic Neo",system-ui,sans-serif;color:#2B3A55}
    h1{font-size:26px;margin:26px 30px 4px} p{margin:0 30px 18px;color:#6B7B99;font-size:14px}
    .g{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:0 26px 26px}
    .c{background:#fff;border-radius:20px;padding:14px 8px 12px;text-align:center}
    .c img{width:100%;height:auto;max-height:170px;object-fit:contain}
    .c b{display:block;font-size:16px;margin-top:4px}
    .c span{display:block;font-size:11px;color:#6B7B99}
  </style><h1>또랑 캐릭터 시트</h1>
  <p>인라인 SVG 원본에서 추출 · 투명 배경 PNG는 png/ 폴더</p>
  <div class="g">${made.map(m =>
    `<div class="c"><img src="png/${m.key}.png"><b>${m.label}</b><span>${m.key}</span></div>`).join('')}</div>`;
  const sheetPath = path.join(HERE, '_sheet.html');
  fs.writeFileSync(sheetPath, sheet);
  execFileSync(CHROME, ['--headless', '--disable-gpu',
    `--screenshot=${path.join(HERE, '캐릭터_시트.png')}`,
    '--window-size=1180,900', '--virtual-time-budget=1500',
    'file://' + encodeURI(sheetPath)], { stdio: 'ignore' });
  fs.unlinkSync(sheetPath);
  console.log('  시트 ✓ 캐릭터_시트.png');
} else {
  console.log('  ⚠ Chrome 없음 → PNG 생략 (SVG 는 정상 생성됨)');
}
console.log(`\n완료: ${made.length}종`);
