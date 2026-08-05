/**
 * 디자인 토큰 — 단일 원천.
 *
 * 출처: uiux기획/CLAUDE.md §3 + mockup-v1.html `:root`.
 * 🚨 컴포넌트 파일에 하드코딩된 색·크기 값이 있으면 그건 버그다(uiux기획/CLAUDE.md:35-36).
 * `scripts/check-safety-rules.mjs` 가 `src/components` · `src/screens` 에서
 * `#RRGGBB` 리터럴 부재를 강제한다. SVG 에셋(`src/assets/`)만 예외다 —
 * 목업 SVG 는 hex 리터럴을 내포하므로 에셋 계층으로 분리했다(docs/02 B-7).
 */

export const color = {
  // 면적색 — 저채도. 화면 대부분을 차지하므로 진정 효과 우선
  bg: '#F4F1FB',
  surface: '#FFFFFF',

  // 행동 유도점 — 고채도. 아이 눈이 여기로 가야 한다
  action: '#FFC12E',
  success: '#2FB477',
  character: '#FF8A47',

  // 글자 — 검정 대신 남색 (검정은 유아 선호 최하위)
  ink: '#2B3A55',
  inkSoft: '#6B7B99',
} as const;

/**
 * 🚨 오류 색이 존재하지 않는다.
 * uiux기획/CLAUDE.md:81 — "빨강은 오류 표시에 쓰지 않는다. 아이 화면에 오류 색 자체가 없다."
 * 오류가 없는 게 아니라 오류 *표현*이 없다. `error`/`danger` 토큰을 추가하지 말 것.
 *
 * 또한 검정·갈색·회색을 면적색으로 쓰지 않고, 성별 고정 색(분홍/파랑)으로
 * 온보딩이나 캐릭터를 나누지 않는다(분홍은 남아의 최대 기피색).
 */

/** 떡 몸통 색 — 저채도. mockup-v1.html `:root` 에서 이식. */
export const characterColor = {
  songBody: '#A8CE86',
  songBodyD: '#8FBB6C',
  siruCake: '#F0E2C6',
  siruPat: '#8E4A6B',
  garaBody: '#F8F2E6',
  injeolBody: '#F3EBD8',
  injeolDust: '#D9B872',
  kkulBody: '#F6F0E4',
  kkulHoney: '#E8A93C',
  // 갈색을 면적색으로 쓰지 않는다 → 조청 금빛으로 밝힘
  yakgwaBody: '#E3B472',
  baekBody: '#FBF8F3',
} as const;

/**
 * 터치 타깃 — uiux기획/CLAUDE.md:42-44 (절대 규칙 1·2).
 * 위반 시 빌드 실패로 취급한다.
 */
export const size = {
  /** 아이 화면의 모든 조작 요소 최소치 */
  tapMin: 76,
  /** 주 행동(마이크·다음·시작) */
  tapPrimary: 88,
  /** 보호자 화면 예외 — 의도된 대비다. 아이가 쓰기 어렵게 만든다 */
  tapParent: 56,
} as const;

export const space = {
  /** 인접 조작 요소 사이 최소 간격 */
  gap: 16,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
} as const;

export const radius = { sm: 12, md: 18, lg: 28, pill: 999 } as const;

/**
 * uiux기획/CLAUDE.md:49-50 — 모든 탭은 100ms 내 시각+청각 응답.
 * 네트워크 대기 중에도 로컬 반응이 먼저 나간다.
 */
export const motion = {
  instant: 100,
  normal: 220,
  slow: 400,
} as const;

export const type = {
  /** 아이 화면. 글자는 아이콘·음성 위에 덧입히는 보조 레이어다(규칙 4) */
  childLine: 30,
  childCaption: 22,
  /** 보호자 화면 */
  parentBody: 16,
  parentCaption: 13,
} as const;

/** CSS 커스텀 프로퍼티로 내보낸다 — CSS Modules 에서 var(--*) 로 참조. */
export function cssVariables(): Record<string, string> {
  return {
    '--bg': color.bg,
    '--surface': color.surface,
    '--action': color.action,
    '--success': color.success,
    '--character': color.character,
    '--ink': color.ink,
    '--ink-soft': color.inkSoft,
    '--song-body': characterColor.songBody,
    '--song-body-d': characterColor.songBodyD,
    '--tap-min': `${size.tapMin}px`,
    '--tap-primary': `${size.tapPrimary}px`,
    '--gap': `${space.gap}px`,
    '--dur-instant': `${motion.instant}ms`,
    '--dur-normal': `${motion.normal}ms`,
    '--dur-slow': `${motion.slow}ms`,
  };
}
