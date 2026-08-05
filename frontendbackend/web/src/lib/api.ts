/**
 * BFF 클라이언트.
 *
 * 타입 정본은 `contracts/session-script.schema.json` 이고 이 파일은 그 미러다.
 * 서버측 미러는 `server/app/schemas.py` 이며 `server/tests/test_contract.py` 가
 * 세 정의의 일치를 검증한다.
 *
 * 🚨 `/api/session` 은 상류 실패로 실패하지 않는다. 키 부재·빈 배열·타임아웃·
 * 상류 예외 전부 저작 폴백 데크로 완성된 세션이 200 으로 온다.
 * 실패 사유는 `source.fallback_reason` 에만 있으며 **아이 화면에 도달하지 않는다.**
 */

import { DEFAULT_AGE_BAND, type AgeBand } from '@/config/audience';

export type Category = 'ownership_turn' | 'physical_boundary' | 'verbal_discomfort' | 'rule_violation';
export type Skill = 'greet' | 'request' | 'apologize' | 'refuse' | 'take_turns';
export type Scene = 'class' | 'play' | 'kids' | 'cvs' | 'stat' | 'variety' | 'dept' | 'cinema' | 'futsal' | 'dojang';
export type Who = 'songpyeon' | 'sirutteok' | 'garaetteok' | 'injeolmi' | 'kkultteok' | 'yakgwa' | 'baekseolgi';
export type Emotion = 'none' | 'joy' | 'sad' | 'angry' | 'surprised' | 'shy' | 'scared';

export interface Line {
  who: Who;
  t: string;
  emo?: Emotion | null;
}

export interface Turn {
  emo: Emotion;
  /** 🚨 아이 발화의 채점이 아니라 상황 전개의 결과다(S1). */
  back_emo: Emotion;
  ask: Line;
  hint: Line;
  sup1: Line;
  sup2: Line;
  back: Line;
}

export interface SessionScript {
  schema_version: 1;
  session_id: string;
  category: Category;
  skill: Skill;
  age_band: AgeBand;
  scene: Scene;
  partner: 'songpyeon';
  other: Exclude<Who, 'songpyeon'>;
  retry_max: 2;
  lines: {
    ai_disclosure: Line;
    intro: Line;
    demo_in: Line;
    demo: [Line, Line, Line];
    wait: Line;
    cant: Line;
    cheer: Line;
    party: Line;
  };
  turns: [Turn, Turn, Turn];
  source: {
    adapter: 'template_deck' | 'derived' | 'backend_session';
    backend_scenario_present: boolean;
    backend_fields_used: string[];
    fallback_reason: string | null;
  };
  /** 🚨 아이 화면 노출 금지. 보호자 게이트 뒤에서만 렌더한다. */
  parent_meta: {
    scenario_title: string;
    learning_goal: string;
    conflict_trigger: string;
    dev_issues: { rule_id: string; field: string; message: string; severity: 'critical' | 'high' }[];
  };
}

export interface SessionRequest {
  category: Category;
  age_band?: AgeBand;
  scene?: Scene;
}

export async function fetchSession(req: SessionRequest, signal?: AbortSignal): Promise<SessionScript> {
  const res = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ age_band: DEFAULT_AGE_BAND, scene: 'kids', ...req }),
    signal,
  });
  if (!res.ok) {
    // 501(미구현 카테고리)/503(원본 트리 미발견) — 아이는 이 경로에 도달하지 않는다.
    // 호출부가 픽스처 폴백으로 전환한다.
    throw new Error(`session ${res.status}`);
  }
  return (await res.json()) as SessionScript;
}

export async function fetchHealth(): Promise<Record<string, unknown>> {
  return (await fetch('/api/health')).json();
}
