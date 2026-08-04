/**
 * 캐릭터 SVG → TS 모듈 생성.
 *
 * 왜 인라인 문자열인가: 감정 표현이 SVG **내부** 클래스의 CSS display 토글로
 * 설계되어 있다(.m-smile / .m-frown / .blush / .tear …). <img> 로 넣으면
 * 외부 CSS 가 내부에 닿지 못해 표정이 전혀 바뀌지 않는다.
 * 이것이 Expo/RN 대신 웹을 택한 결정적 근거다(docs/06_ADR/ADR-001).
 *
 * SVG 는 hex 리터럴을 내포하므로 src/assets/ 에 격리한다 —
 * check-safety-rules.mjs 의 토큰 검사 대상(src/components, src/screens)에서 제외된다.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', 'src', 'assets', 'characters');

const files = readdirSync(dir).filter((f) => f.endsWith('.svg')).sort();
const entries = files.map((f) => {
  const id = f.replace(/\.svg$/, '');
  let svg = readFileSync(join(dir, f), 'utf8').trim();
  // 고정 width/height 를 제거해 컨테이너에 맞춰 스케일되게 한다. viewBox 는 유지.
  svg = svg.replace(/<svg([^>]*?)\s+width="\d+"\s+height="\d+"/, '<svg$1');
  return `  '${id}': ${JSON.stringify(svg)},`;
});

const out = `// 자동 생성 — 편집하지 말 것. \`node scripts/build-character-assets.mjs\` 로 재생성한다.
// 원본: uiux기획/캐릭터_에셋/svg/
export const CHARACTER_SVG: Record<string, string> = {
${entries.join('\n')}
};

/** 한글 표시명. 목업의 who 는 한글이었으나 계약은 파일명 stem(id)을 쓴다. */
export const CHARACTER_NAME: Record<string, string> = {
  songpyeon: '송편', sirutteok: '시루떡', garaetteok: '가래떡', injeolmi: '인절미',
  kkultteok: '꿀떡', yakgwa: '약과', baekseolgi: '백설기', mujigaetteok: '무지개떡',
};

/** 파트너(송편)의 기본 스킨. 성별 고정 색을 쓰지 않는다(uiux기획/CLAUDE.md:79). */
export const PARTNER_SKIN = 'songpyeon-green';
`;

writeFileSync(join(dir, 'index.ts'), out);
console.log(`생성 완료: ${files.length}개 → src/assets/characters/index.ts`);
