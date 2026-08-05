/**
 * 🚨 아이에게 들려줄 문장의 **유일한 소유자** (uiux기획/CLAUDE.md:55 규칙 9).
 *
 * 컴포넌트·스크린은 문자열 리터럴을 갖지 않는다.
 * **서버가 준 문장도 반드시 이 파일의 `resolveSession()` 을 경유한다** —
 * 경유가 없으면 S4(서버 문자열의 무검증 TTS 도달 차단)가 우회된다.
 *
 * 이 파일이 소유하는 것 3가지:
 *   (1) 정적 시스템 대사
 *   (2) 카테고리별 저작 폴백 데크
 *   (3) SessionScript → 최종 대사 확정 (`resolveSession`)
 */

import type { Line, Scene, SessionScript } from '@/lib/api';
import { sanitizeForChild } from '@/lib/sanitizeForChild';

/** (1) 정적 시스템 대사 — 서버와 무관하게 항상 존재해야 하는 것. */
export const LINES = {
  /** 시작 화면. 오늘 주제는 통보형이다 — 아이가 고르지 않는다 */
  today: { who: 'songpyeon', t: '오늘은 싫다고 말하기' } as Line,
  start: { who: 'songpyeon', t: '준비됐어? 시작해보자!' } as Line,

  /** 🚨 GOV-003-R1 아동 대상 AI 고지. 만 4~6세 어휘, 소리로만 전달된다 */
  aiDisclosure: { who: 'songpyeon', t: '나는 컴퓨터가 만든 친구야. 그래도 같이 연습할 수 있어!' } as Line,

  /** thinking 3초 초과 (uiux기획/CLAUDE.md:91) */
  wait: { who: 'songpyeon', t: '조금만 기다려줘.' } as Line,
  /** cantHear — 실패가 아니라 캐릭터의 부탁 (uiux기획/CLAUDE.md:95) */
  cant: { who: 'songpyeon', t: '잘 안 들려. 다시 말해줄래?' } as Line,

  /**
   * 🚨 H9(docs/10_UIUX_리뷰.md) 수정 — Next.js 기본 오류·404 페이지(영어, 빨강 계열)가
   * 아이 화면에 그대로 뜨는 경로를 막는다(`app/error.tsx`·`app/not-found.tsx`).
   * 오류 어휘·오류 색 없이 상황 설명형으로만 쓴다(규칙 6, uiux기획/CLAUDE.md:81).
   */
  appHiccup: { who: 'songpyeon', t: '잠깐 멈췄네. 다시 눌러서 만나자!' } as Line,
  notFound: { who: 'songpyeon', t: '어라, 이 길은 없네. 처음으로 가볼까?' } as Line,
  /** 유일한 평가성 발화이며 항상 긍정이다 (규칙 6) */
  cheer: { who: 'songpyeon', t: '잘 말했어! 네 마음을 그대로 말했구나.' } as Line,
  replay: { who: 'songpyeon', t: '다시 들려줄게.' } as Line,

  /**
   * 🚨 H4(docs/10_UIUX_리뷰.md) 수정 — 6층이 아직 안 채워졌는데도 매 세션
   * `lines.party`("무지개떡을 다 모았어!")를 그대로 재생해 그림(1/6)과 말이 어긋났다.
   * 완주 전 세션은 판정·비교 없는 활동 기록형 문구만 쓴다(§2-4, S12).
   */
  layerFilled: { who: 'songpyeon', t: '오늘도 멋지게 해냈어! 무지개떡 한 층을 더 채웠어.' } as Line,

  /**
   * 무지개떡 6층 완성 — mockup:1957-1963(`REWARDS`). 순환 재생되는 완성 보상 3종.
   * 점수·비교가 아니라 그날 완주했다는 사실 하나만 축하한다(S12).
   */
  rewardParty: { who: 'songpyeon', t: '무지개떡을 다 모았어! 꿀파티다!' } as Line,
  rewardPool: { who: 'songpyeon', t: '무지개떡을 다 모았어! 꿀수영장에서 놀자!' } as Line,
  rewardPound: { who: 'songpyeon', t: '무지개떡을 다 모았어! 인절미랑 떡메로 쳐서 더 쫄깃하게 만들자!' } as Line,

  /**
   * 🚨 위험 발화 에스컬레이션 (S9).
   * 아이를 비난하지 않는다. "잘못했다"는 신호를 절대 주지 않는다.
   * 정책 본문: compliance/RISK-ESCALATION-POLICY.md
   */
  escalateSelfHarm: {
    who: 'songpyeon',
    t: '지금 이야기는 어른한테 꼭 말해줘. 선생님이나 엄마 아빠한테.',
  } as Line,
  escalateGeneral: {
    who: 'songpyeon',
    t: '그건 어른한테 말하는 게 좋겠어. 같이 가서 말해보자.',
  } as Line,
} as const;

/**
 * (2) 저작 폴백 데크.
 * 서버를 못 부르거나 픽스처도 없을 때 아이 화면이 멈추지 않게 하는 최후 방어선이다.
 * 출처: mockup-v1.html:900-936 (신규 저작 0줄).
 */
export const FALLBACK_DECK = {
  intro: { who: 'songpyeon', t: '시루떡이 네 장난감을 가져가려고 해. 싫으면 싫다고 말해도 돼.' } as Line,
  demoIn: { who: 'songpyeon', t: '먼저 내가 어떻게 말하는지 보여줄게. 잘 봐.' } as Line,
  demo: [
    { who: 'sirutteok', emo: 'angry', t: '그거 나 줘. 지금 당장!' },
    { who: 'songpyeon', t: '안 돼. 이건 내가 쓰고 있어.' },
    { who: 'sirutteok', emo: 'sad', t: '알았어… 그럼 나중에 물어볼게.' },
  ] as Line[],
  firstAsk: { who: 'sirutteok', t: '그거 나 줘. 지금 당장!' } as Line,
} as const;

/**
 * (3) 🚨 서버 스크립트를 최종 대사로 확정한다.
 *
 * 모든 서버 유래 문자열이 여기서 `sanitizeForChild()` 를 통과한다.
 * 위험·과길이 문자열은 저작 폴백으로 **대체**되고, 아이는 아무 차이도 느끼지 않는다.
 * 차단 사실은 반환값의 `blocked` 에만 남으며 아이 화면에 도달하지 않는다.
 */
export interface ResolvedSession {
  lines: SessionScript['lines'];
  turns: SessionScript['turns'];
  /** 배경 씬 — enum 값이라 sanitize 대상이 아니다(자유 텍스트가 아님) */
  scene: Scene;
  /** 개발자·텔레메트리용. 🚨 아이에게 표시하지 않는다 */
  blocked: { where: string; reason: string }[];
}

export function resolveSession(script: SessionScript): ResolvedSession {
  const blocked: { where: string; reason: string }[] = [];

  const clean = (line: Line, where: string, fallback: string): Line => {
    const r = sanitizeForChild(line.t, fallback);
    if (!r.passed) blocked.push({ where, reason: r.reason ?? 'unknown' });
    return { ...line, t: r.text };
  };

  const lines: SessionScript['lines'] = {
    ai_disclosure: clean(script.lines.ai_disclosure, 'lines.ai_disclosure', LINES.aiDisclosure.t),
    intro: clean(script.lines.intro, 'lines.intro', FALLBACK_DECK.intro.t),
    demo_in: clean(script.lines.demo_in, 'lines.demo_in', FALLBACK_DECK.demoIn.t),
    demo: script.lines.demo.map((l, i) =>
      clean(l, `lines.demo[${i}]`, FALLBACK_DECK.demo[i].t),
    ) as [Line, Line, Line],
    wait: clean(script.lines.wait, 'lines.wait', LINES.wait.t),
    cant: clean(script.lines.cant, 'lines.cant', LINES.cant.t),
    cheer: clean(script.lines.cheer, 'lines.cheer', LINES.cheer.t),
    party: clean(script.lines.party, 'lines.party', LINES.cheer.t),
  };

  const turns = script.turns.map((turn, ti) => ({
    ...turn,
    // turns[0].ask 가 백엔드 LLM 문장이 들어오는 유일한 슬롯이다 —
    // 즉 sanitize 가 가장 중요한 지점이다.
    ask: clean(turn.ask, `turns[${ti}].ask`, FALLBACK_DECK.firstAsk.t),
    hint: clean(turn.hint, `turns[${ti}].hint`, LINES.cant.t),
    sup1: clean(turn.sup1, `turns[${ti}].sup1`, LINES.cant.t),
    sup2: clean(turn.sup2, `turns[${ti}].sup2`, LINES.cant.t),
    back: clean(turn.back, `turns[${ti}].back`, LINES.cheer.t),
  })) as SessionScript['turns'];

  return { lines, turns, scene: script.scene, blocked };
}
