#!/usr/bin/env node
/**
 * 안전 불변식 기계 검사 — 실패 = 빌드 실패로 취급한다 (uiux기획/CLAUDE.md:40).
 *
 * ⚠️ 전제: `uiux기획/CLAUDE.md:117` 이 요구하는 `scripts/check-ui-rules.mjs` 는
 * **존재하지 않는다**(uiux기획에 scripts/ 디렉터리 없음, .mjs 는 캐릭터_에셋/추출.mjs 하나).
 * UI 측 유일한 기계적 강제 수단이 미구현이었으므로 이것은 확장이 아니라 **최초 작성**이다.
 * CLAUDE.md:119-122 의 4개 UI 검사에 안전 불변식 S1~S13 을 더했다.
 *
 * ⚠️ 한계(정직하게): 이 검사는 정규식·토큰 기반이지 AST 기반이 아니다.
 * 교묘한 우회(동적 문자열 조립, 간접 호출)는 잡지 못한다. 회귀 방지가 목적이지
 * 적대적 방어가 아니다. AST 화는 Phase 2 항목이다.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

const failures = [];
const passes = [];

function fail(id, msg) { failures.push(`${id}  ${msg}`); }
function pass(id, msg) { passes.push(`${id}  ${msg}`); }

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const ALL = walk(SRC);
const code = (f) => ['.ts', '.tsx'].includes(extname(f));
const rel = (f) => relative(ROOT, f);
const read = (f) => readFileSync(f, 'utf8');

/**
 * 주석 제거. 규칙을 *설명하는* 주석까지 위반으로 잡으면 검사가 못 쓰게 된다.
 * 블록 주석 + 줄 주석(후행 포함)을 제거하되, `http://` 처럼 `:` 뒤에 오는
 * `//` 는 URL 이므로 건드리지 않는다.
 */
const strip = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/([^:'"`\\])\/\/.*$/gm, '$1')
    .replace(/^\s*\/\/.*$/gm, '');

/** 아이 화면 코드. 에셋(SVG)과 토큰은 제외한다 — docs/02 B-7 */
const CHILD_UI = ALL.filter(
  (f) => code(f) && (f.includes('/components/') || f.includes('/screens/')),
);
const CHILD_UI_AND_LINES = [...CHILD_UI, ...ALL.filter((f) => f.endsWith('/audio/lines.ts'))];

// ═══════════════════════════════════════════════════════════════════
// S1  캐릭터 감정이 아동 발화 평가에 바인딩되지 않는다  (최상위 불변식)
//     근거: mockup-v1.html:1609-1613, :1799
// ═══════════════════════════════════════════════════════════════════
{
  // 발화 처리 계열 함수 안에서 감정 설정이 일어나면 안 된다.
  const RESPOND_FN = /\b(respond|respondWrong|onSttResult|submitUtterance|onChildSpoke)\b/;
  const SET_EMO = /\b(setEmo|setEmotion|setPartnerEmo)\s*\(/;
  let hit = false;
  for (const f of ALL.filter(code)) {
    const src = read(f);
    if (RESPOND_FN.test(src) && SET_EMO.test(src)) {
      fail('S1', `${rel(f)}: 발화 처리 경로에 감정 설정 호출이 있습니다`);
      hit = true;
    }
  }
  // 리듀서의 CHILD_SPOKE_* 분기가 감정을 건드리지 않는지 확인
  const machine = ALL.find((f) => f.endsWith('session-machine.ts'));
  if (machine) {
    const src = read(machine);
    const block = src.slice(src.indexOf("case 'CHILD_SPOKE_OK'"), src.indexOf("case 'RESPOND_DONE'"));
    if (/emo/i.test(block)) {
      fail('S1', 'session-machine: CHILD_SPOKE_OK 분기가 감정을 변경합니다');
      hit = true;
    }
  }
  if (!hit) pass('S1', '아동 발화 평가 → 캐릭터 감정 바인딩 0건');
}

// ═══════════════════════════════════════════════════════════════════
// S2  오답 경로가 턴을 소비하지 않는다
//     근거: mockup-v1.html:1810-1826, 캐릭터연출_기획_v1.md:653-663
// ═══════════════════════════════════════════════════════════════════
{
  const machine = ALL.find((f) => f.endsWith('session-machine.ts'));
  if (!machine) fail('S2', 'session-machine.ts 를 찾을 수 없습니다');
  else {
    const src = read(machine);
    const incs = [...src.matchAll(/turn\s*:\s*s\.turn\s*\+\s*1|s\.turn\s*\+\s*1|turn\+\+/g)];
    if (incs.length !== 1) {
      fail('S2', `turn 증가 지점이 ${incs.length}곳입니다 (정확히 1곳이어야 함)`);
    } else {
      // 그 1곳이 RESPOND_DONE 안에 있어야 한다
      const idx = src.indexOf('const turn = s.turn + 1');
      const respondIdx = src.indexOf("case 'RESPOND_DONE'");
      const escalateIdx = src.indexOf("case 'ESCALATE'");
      if (idx < respondIdx || (escalateIdx > 0 && idx > escalateIdx)) {
        fail('S2', 'turn 증가가 RESPOND_DONE 밖에 있습니다');
      } else pass('S2', 'turn 증가 지점 1곳, RESPOND_DONE 내부');
    }
    // retry() 가 turn 을 건드리면 안 된다
    const retryFn = src.slice(src.indexOf('export function retry'));
    const retryBody = retryFn.slice(0, retryFn.indexOf('\n}'));
    if (/turn\s*:/.test(retryBody)) fail('S2', 'retry() 가 turn 을 변경합니다');
    else pass('S2', 'retry() 는 turn 을 소비하지 않음');
  }
}

// ═══════════════════════════════════════════════════════════════════
// S3  아이 화면에 실패 어휘·오류 색이 없다
//     근거: uiux기획/CLAUDE.md:51, :81
// ═══════════════════════════════════════════════════════════════════
{
  const BAD_WORDS = /틀렸|오답|실패했|땡!|점수|❌|✗|✘/;
  const BAD_TOKENS = /\b(error|danger|--error|--danger)\b/i;
  let hit = false;
  for (const f of CHILD_UI_AND_LINES) {
    const bare = strip(read(f));
    if (BAD_WORDS.test(bare)) { fail('S3', `${rel(f)}: 실패 어휘 발견`); hit = true; }
    if (BAD_TOKENS.test(bare)) { fail('S3', `${rel(f)}: error/danger 토큰 참조`); hit = true; }
  }
  // 오류 색 토큰이 아예 정의되지 않았는지
  const globals = join(ROOT, 'app', 'globals.css');
  const g = strip(readFileSync(globals, 'utf8'));
  if (/--(error|danger)\s*:/.test(g)) { fail('S3', 'globals.css 에 오류 색 토큰이 정의됨'); hit = true; }
  if (!hit) pass('S3', '실패 어휘 0건 · 오류 색 토큰 부재');
}

// ═══════════════════════════════════════════════════════════════════
// S4  서버 문자열이 무검증으로 음성 출력에 도달하지 않는다  (CS-001)
// ═══════════════════════════════════════════════════════════════════
{
  const SPEAK = /\bspeak\s*\(\s*([^,)]+)/g;
  const ALLOWED = /^(LINES\.|FALLBACK_DECK\.|sanitizeForChild\s*\(|safe\.text|r\.text|line\.t|t\b|text\b|bubble\.t|ask\.t|l\?\.|resolved\?\.|.*\?\?\s*(LINES|FALLBACK_DECK)\.)/;
  const RAW_SERVER = /\b(scenario|data|res|json)\s*\.\s*(ai_first_message|background|scenario_title|learning_goal|conflict_trigger)/;
  let hit = false;
  for (const f of ALL.filter(code)) {
    if (f.endsWith('/audio/speak.ts')) continue; // 정의부
    const bare = strip(read(f));
    if (RAW_SERVER.test(bare) && /\bspeak\s*\(/.test(bare)) {
      fail('S4', `${rel(f)}: 서버 응답 필드를 speak() 근처에서 직접 사용`);
      hit = true;
    }
    for (const m of bare.matchAll(SPEAK)) {
      const arg = m[1].trim();
      if (!ALLOWED.test(arg)) {
        fail('S4', `${rel(f)}: speak(${arg.slice(0, 40)}…) — LINES.* 또는 sanitizeForChild() 결과만 허용`);
        hit = true;
      }
    }
  }
  // speak() 정의부가 sanitize 를 경유하는가 (다중 방어)
  const sp = ALL.find((f) => f.endsWith('/audio/speak.ts'));
  if (sp && !/sanitizeForChild\s*\(/.test(read(sp))) {
    fail('S4', 'speak() 정의부가 sanitizeForChild 를 경유하지 않습니다');
    hit = true;
  }
  if (!hit) pass('S4', 'speak() 인자 전부 관문 경유');
}

// ═══════════════════════════════════════════════════════════════════
// S5  아이 화면에 아동 발화 텍스트가 렌더되지 않는다
//     근거: 캐릭터연출_기획_v1.md:665-671 (사용자 결정 ③)
// ═══════════════════════════════════════════════════════════════════
{
  const STT_ID = /\b(transcript|sttText|utterance|childText|childSaid)\b/;
  let hit = false;
  for (const f of CHILD_UI) {
    const bare = strip(read(f));
    if (STT_ID.test(bare)) { fail('S5', `${rel(f)}: 아동 발화 식별자가 아이 화면 코드에 존재`); hit = true; }
  }
  if (!hit) pass('S5', '아이 화면에 아동 발화 텍스트 렌더 0건');
}

// ═══════════════════════════════════════════════════════════════════
// S6  저장 0건
//     근거: uiux기획/CLAUDE.md:110, LEGAL-003-R1
// ═══════════════════════════════════════════════════════════════════
{
  const STORE = /\b(localStorage|sessionStorage|indexedDB|AsyncStorage|SecureStore)\b/;
  let hit = false;
  for (const f of ALL.filter(code)) {
    if (f.endsWith('/lib/consent.ts')) continue;  // 화이트리스트: 보호자 동의 플래그
    const bare = strip(read(f));
    if (STORE.test(bare)) { fail('S6', `${rel(f)}: 클라이언트 저장소 사용`); hit = true; }
  }
  if (!hit) pass('S6', '클라이언트 저장소 사용 0건');
}

// ═══════════════════════════════════════════════════════════════════
// S7  제스처 금지 + Tap 경유 + 토큰 + 최소 크기
//     근거: uiux기획/CLAUDE.md:119-122 (원문 4개 검사의 웹 변형)
// ═══════════════════════════════════════════════════════════════════
{
  const GESTURE = /\b(onLongPress|PanResponder|Gesture|onDoubleClick|onPointerMove|draggable\s*=\s*\{?true|ontouchmove)\b/;
  const HEX = /#[0-9a-fA-F]{6}\b/;
  let hit = false;

  for (const f of CHILD_UI) {
    const bare = strip(read(f));
    if (GESTURE.test(bare)) { fail('S7', `${rel(f)}: 금지된 제스처 핸들러`); hit = true; }
    if (HEX.test(bare)) { fail('S7', `${rel(f)}: #RRGGBB 리터럴 (토큰만 사용)`); hit = true; }
    // <button> 직접 사용 금지 — Tap 정의부만 예외
    if (!f.endsWith('/components/Tap.tsx') && /<button[\s>]/.test(bare)) {
      fail('S7', `${rel(f)}: <button> 직접 사용 (Tap 경유 필요)`); hit = true;
    }
  }

  // 최소 크기: .module.css 의 min-width/min-height 가 76 미만이면 실패 (보호자 56 예외)
  for (const f of ALL.filter((x) => x.endsWith('.module.css'))) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/min-(?:width|height)\s*:\s*(\d+)px/g)) {
      const v = Number(m[1]);
      if (v < 76 && v !== 56) {
        fail('S7', `${rel(f)}: min-크기 ${v}px < 76 (보호자 예외 56 아님)`); hit = true;
      }
    }
  }
  if (!hit) pass('S7', '제스처 부재 · 토큰만 사용 · Tap 경유 · 최소 크기 충족');
}

// ═══════════════════════════════════════════════════════════════════
// S8  AI 고지가 존재한다  (GOV-003-R1)
// ═══════════════════════════════════════════════════════════════════
{
  const lines = ALL.find((f) => f.endsWith('/audio/lines.ts'));
  const talk = ALL.find((f) => f.endsWith('/screens/Talk.tsx'));
  if (!lines || !/aiDisclosure\s*:/.test(read(lines))) fail('S8', 'lines.ts 에 aiDisclosure 키가 없습니다');
  else if (!talk || !/ai_disclosure|aiDisclosure/.test(read(talk))) fail('S8', 'AI 고지가 재생되지 않습니다');
  else pass('S8', 'AI 고지 키 존재 + 세션 흐름에서 재생');
}

// ═══════════════════════════════════════════════════════════════════
// S9  위험 발화 에스컬레이션이 일반 롤플레잉과 분리된다
// ═══════════════════════════════════════════════════════════════════
{
  const f = ALL.find((x) => x.endsWith('classifyChildUtterance.ts'));
  if (!f) fail('S9', 'classifyChildUtterance.ts 가 없습니다');
  else {
    const src = read(f);
    for (const k of ['selfHarm', 'sexual', 'abuse', 'exclusion', 'normal']) {
      if (!src.includes(`'${k}'`)) fail('S9', `분류 '${k}' 누락`);
    }
    if (!/const\s+_exhaustive\s*:\s*never/.test(src)) fail('S9', 'exhaustive switch(never 체크) 부재');
    else pass('S9', '분류 5종 + exhaustive switch');
  }
}

// ═══════════════════════════════════════════════════════════════════
// S9-골든  위험 발화 4문장 — 계획 전체에서 가장 가치 있는 테스트
//     상류 validator.py 에서는 4행이 **모두 반대로** 동작한다(실측).
//     riskPatterns.ts 의 정규식을 실제로 실행해 확인한다.
// ═══════════════════════════════════════════════════════════════════
{
  const f = ALL.find((x) => x.endsWith('riskPatterns.ts'));
  if (!f) fail('S9-골든', 'riskPatterns.ts 가 없습니다');
  else {
    const src = read(f);
    // { kind: 'x', rule: 'Y', re: /…/ } 항목을 추출한다
    const pats = [];
    for (const m of src.matchAll(/kind:\s*'(\w+)'[^}]*?re:\s*\/((?:[^/\\]|\\.)+)\//g)) {
      pats.push({ kind: m[1], re: new RegExp(m[2]) });
    }
    if (pats.length < 15) fail('S9-골든', `패턴 추출 ${pats.length}건 — 파싱 실패 의심`);

    const classify = (t) => {
      const hits = pats.filter((p) => p.re.test(t));
      if (!hits.length) return 'normal';
      for (const k of ['selfHarm', 'sexual', 'abuse', 'exclusion']) {
        if (hits.some((h) => h.kind === k)) return k;
      }
      // violence 는 아동 발화로서는 신고이지 위반이 아니다 → abuse 로 승격
      if (hits.some((h) => h.kind === 'violence')) return 'abuse';
      return 'normal';
    };

    const GOLDEN = [
      ['죽고 싶을 만큼 힘들었어. 자해했어.', 'selfHarm'],
      ['옷 벗어봐. 야한 사진 보여줄게.', 'sexual'],
      ['우리 반 전체가 너랑 안 놀 거야. 아무도 말 걸지 마.', 'exclusion'],
      ['장애물 달리기를 했어요', 'normal'],
      // 오탐 회귀 방지 — 상류가 잘못 차단하던 정당한 용법
      ['가난한 나라를 돕는 이야기를 들었어요', 'normal'],
      ['오늘 친구랑 블록 쌓기 했어', 'normal'],
      // 피해 신고를 막지 않는가 (아이의 신고는 차단이 아니라 에스컬레이션)
      ['쟤가 나 때렸어', 'abuse'],
    ];

    let bad = 0;
    for (const [text, want] of GOLDEN) {
      const got = classify(text);
      if (got !== want) { fail('S9-골든', `"${text}" → ${got} (기대 ${want})`); bad++; }
    }
    if (!bad) pass('S9-골든', `위험 발화 골든 픽스처 ${GOLDEN.length}건 전부 일치 (패턴 ${pats.length}개)`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// S10  연령 타깃이 단일 소스에만 존재한다
// ═══════════════════════════════════════════════════════════════════
{
  const AGE = /초등\s*1~3학년|7~9세|만\s*4~6세|만\s*6~8세/;
  let hit = false;
  for (const f of ALL.filter(code)) {
    if (f.endsWith('/config/audience.ts')) continue;   // 단일 원천
    const bare = strip(read(f));
    if (AGE.test(bare)) { fail('S10', `${rel(f)}: 연령 문자열이 audience.ts 밖에 존재`); hit = true; }
  }
  if (!hit) pass('S10', '연령 문자열이 config/audience.ts 에만 존재');
}

// ═══════════════════════════════════════════════════════════════════
// S12  보상에 확률·희소성·구매·비교가 없다  (동결이 목적 — 현재 깨끗하다)
// ═══════════════════════════════════════════════════════════════════
{
  const GAMBLE = /\b(gacha|lootbox|rarity|probability|weight|price|purchase|streak|leaderboard)\b/i;
  const KO = /랭킹|리더보드|출석\s*체크|연속\s*출석|스탬프|뽑기|가챠|결제|구독/;
  let hit = false;
  for (const f of ALL.filter(code)) {
    const bare = strip(read(f));
    if (GAMBLE.test(bare) || KO.test(bare)) { fail('S12', `${rel(f)}: 사행성·비교 요소 토큰`); hit = true; }
  }
  if (!hit) pass('S12', '사행성·랭킹·스트릭·결제 요소 0건 (동결됨)');
}

// ═══════════════════════════════════════════════════════════════════
// S-token  globals.css 토큰이 src/tokens 와 일치하는가
// ═══════════════════════════════════════════════════════════════════
{
  const t = read(join(SRC, 'tokens', 'index.ts'));
  const g = readFileSync(join(ROOT, 'app', 'globals.css'), 'utf8');
  let hit = false;
  for (const [name, key] of [['--bg', 'bg'], ['--action', 'action'], ['--ink', 'ink'], ['--success', 'success']]) {
    const inTs = t.match(new RegExp(`${key}:\\s*'(#[0-9A-Fa-f]{6})'`))?.[1];
    const inCss = g.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`))?.[1];
    if (!inTs || !inCss || inTs.toUpperCase() !== inCss.toUpperCase()) {
      fail('S-token', `${name}: tokens=${inTs} css=${inCss} 불일치`); hit = true;
    }
  }
  if (!hit) pass('S-token', 'globals.css ↔ src/tokens 일치');
}

// ═══════════════════════════════════════════════════════════════════
console.log('\n  안전 불변식 검사 (web)\n');
for (const p of passes) console.log(`  ✅ ${p}`);
if (failures.length) {
  console.log('');
  for (const f of failures) console.log(`  ❌ ${f}`);
  console.log(`\n  실패 ${failures.length}건 — 빌드 실패로 취급합니다.\n`);
  process.exit(1);
}
console.log(`\n  전부 통과 (${passes.length}건)\n`);
