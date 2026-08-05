/**
 * 세션 상태기계 — `mockup-v1.html:1493-1857` 의 순수 함수 이식.
 *
 * 목업은 전역 `S` 객체를 직접 변형했다. 여기서는 순수 리듀서로 옮겨
 * 안전 불변식을 테스트로 고정할 수 있게 한다.
 *
 * 🚨 이 파일이 보호하는 두 불변식:
 *   S1  캐릭터 감정이 아동 발화 평가에 바인딩되지 않는다
 *   S2  오답 경로가 턴을 소비하지 않는다
 */

export type Phase =
  | 'intro'        // 인트로 내레이션 (이 동안 세션 prefetch)
  | 'demo'         // 시범 3줄 — 아이는 듣기만 한다
  | 'ask'          // 상대역이 요구
  | 'waitForChild' // 아이 차례
  | 'respond'      // 아이 발화 뒤 상대역 응답
  | 'reward'       // 3턴 완료
  | 'escalated';   // 위험 발화 감지 — 일반 경로에서 도달 불가

export type CharState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'cantHear';

/** 목업의 RETRY_MAX. 캐릭터연출_기획_v1.md:653-663 확정. 임의 상향 금지. */
export const RETRY_MAX = 2;

export interface SessionState {
  phase: Phase;
  /** 0-based. 🚨 증가 지점은 이 파일 전체에서 정확히 한 곳이다(S2) */
  turn: number;
  /** 이번 턴의 재시도 횟수. 턴을 소비하지 않는다 */
  retry: number;
  /** 지원 단계: 0=hint, 1=sup1, 2=sup2(함께 말하기) */
  support: 0 | 1 | 2;
  charState: CharState;
  demoIndex: number;
  done: boolean;
}

export const initialState: SessionState = {
  phase: 'intro',
  turn: 0,
  retry: 0,
  support: 0,
  charState: 'idle',
  demoIndex: 0,
  done: false,
};

export type Action =
  | { type: 'INTRO_DONE' }
  | { type: 'DEMO_NEXT' }
  | { type: 'ASK_DONE' }
  | { type: 'CHILD_SPOKE_OK' }
  | { type: 'CHILD_SPOKE_UNCLEAR' }  // 인식 실패 — 실패가 아니라 캐릭터의 부탁
  | { type: 'RESPOND_DONE' }
  | { type: 'THINKING' }
  | { type: 'ESCALATE' }
  | { type: 'RESET' }  // 보상 화면의 "다시 하기" — 새 세션을 시작하기 전 초기화
  /**
   * 지원 단계 상승. STT가 없어 "미통과"를 판정할 수 없으므로(D2), 무응답
   * 시간 초과를 트리거로 쓴다 — 판정이 아니라 "아직 준비가 안 됐구나"의 신호다.
   * 아이가 먼저 "말했어요"를 탭하면 이 액션이 발화하기 전에 CHILD_SPOKE_OK로
   * 전이하므로 이 액션 자체가 무의미해진다(retry_max=2, §2-7 확정).
   */
  | { type: 'RETRY' };

const TOTAL_TURNS = 3;

export function reduce(s: SessionState, a: Action): SessionState {
  switch (a.type) {
    case 'INTRO_DONE':
      return { ...s, phase: 'demo', demoIndex: 0, charState: 'speaking' };

    case 'DEMO_NEXT': {
      const next = s.demoIndex + 1;
      if (next >= 3) return { ...s, phase: 'ask', demoIndex: next, charState: 'speaking' };
      return { ...s, demoIndex: next, charState: 'speaking' };
    }

    case 'ASK_DONE':
      return { ...s, phase: 'waitForChild', charState: 'listening' };

    case 'THINKING':
      return { ...s, charState: 'thinking' };

    /**
     * 🚨 S2: 인식 실패는 턴도 재시도도 소비하지 않는다.
     * `cantHear` 는 실패가 아니라 캐릭터의 부탁이다 —
     * uiux기획/CLAUDE.md:95 "아이 탓으로 만들지 않는다."
     */
    case 'CHILD_SPOKE_UNCLEAR':
      return { ...s, phase: 'waitForChild', charState: 'cantHear' };

    /**
     * 아이가 말했다. 🚨 여기서 발화 내용을 **평가하지 않는다**.
     * 판정 로직이 없으므로 캐릭터 감정을 바꿀 근거 자체가 존재하지 않는다(S1).
     * 목업의 `S.nextWrong` 자리가 Phase 2 판정 주입점이지만, 주입되더라도
     * 결과는 `support` 수준에만 영향을 주고 감정에는 닿지 않는다.
     */
    case 'CHILD_SPOKE_OK':
      return { ...s, phase: 'respond', charState: 'speaking' };

    case 'RESPOND_DONE': {
      // ⬇⬇ 이 프로젝트에서 turn 이 증가하는 유일한 지점이다 (S2 가 검사한다)
      const turn = s.turn + 1;
      if (turn >= TOTAL_TURNS) {
        return { ...s, phase: 'reward', turn, retry: 0, support: 0, charState: 'idle', done: true };
      }
      return { ...s, phase: 'ask', turn, retry: 0, support: 0, charState: 'speaking' };
    }

    case 'ESCALATE':
      // 일반 롤플레잉에서 도달하지 않는다. 위험 발화 감지 시에만.
      return { ...s, phase: 'escalated', charState: 'idle', done: true };

    case 'RESET':
      return initialState;

    case 'RETRY':
      return retry(s);

    default: {
      const _exhaustive: never = a;
      return _exhaustive;
    }
  }
}

/**
 * 재시도 — 턴을 소비하지 않고 **지원 수준만 올린다**.
 * 상한(RETRY_MAX)에 닿으면 벌이 아니라 '함께 말하기'로 턴을 완결시킨다.
 * 근거: mockup-v1.html:1810-1826, 캐릭터연출_기획_v1.md:653-663
 */
export function retry(s: SessionState): SessionState {
  const r = Math.min(s.retry + 1, RETRY_MAX);
  return {
    ...s,
    retry: r,
    support: Math.min(r, 2) as 0 | 1 | 2,
    phase: 'waitForChild',
    charState: 'listening',
    // 🚨 turn 은 건드리지 않는다
  };
}

/** 현재 지원 단계에서 들려줄 슬롯. */
export function supportSlot(s: SessionState): 'hint' | 'sup1' | 'sup2' {
  return (['hint', 'sup1', 'sup2'] as const)[s.support];
}
