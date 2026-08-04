/**
 * 입력측 분류기 — 아동 발화 (불변식 S9).
 *
 * 🚨 출력측(sanitizeForChild)과 **같은 사전을 쓰되 동작이 정반대**다.
 *   출력측: LLM 생성물 → 차단 + 저작 폴백
 *   입력측: 아동 발화  → **차단이 아니라 에스컬레이션**
 *
 * `LEGAL-002_학교폭력예방법_정의.md:29` 가 요구하는 에스컬레이션 정책이
 * 두 소스 어디에도 없었다. 정책 본문은 `compliance/RISK-ESCALATION-POLICY.md`.
 *
 * ── 1단계 상태 ──
 * D2 로 STT 를 제외했으므로 이 함수는 아직 호출되지 않는다(아동 음성이 기기를
 * 떠나지 않는다). 그러나 **분류기와 골든 픽스처는 지금 고정한다** — 회귀 방지의 핵심이고,
 * STT 가 켜지는 순간 이것이 없으면 아이가 마이크에 실제 피해를 말해도
 * 시스템이 롤플레잉을 계속한다.
 */

import { scanRisk } from './riskPatterns';

export type UtteranceClass = 'selfHarm' | 'sexual' | 'abuse' | 'exclusion' | 'normal';

export interface Classification {
  kind: UtteranceClass;
  /** 근거 규칙 ID. 🚨 아이에게 노출하지 않는다 */
  rules: string[];
}

export function classifyChildUtterance(text: string): Classification {
  const hits = scanRisk(text);
  if (hits.length === 0) return { kind: 'normal', rules: [] };

  // 심각도 순. 자해가 최우선이다.
  const order: UtteranceClass[] = ['selfHarm', 'sexual', 'abuse', 'exclusion'];
  for (const kind of order) {
    const matched = hits.filter((h) => (h.kind as string) === kind);
    if (matched.length) return { kind, rules: [...new Set(matched.map((h) => h.rule))] };
  }

  // violence / demeaning 는 아동 *발화* 로서는 에스컬레이션 대상이 아니다.
  // 아이가 "쟤가 나 때렸어" 라고 말하는 것은 신고이지 위반이 아니며,
  // 이것을 차단하면 피해 아동의 입을 막는 꼴이 된다.
  // 학대 정황으로만 별도 판정한다.
  const abuse = hits.filter((h) => h.kind === 'violence');
  if (abuse.length) return { kind: 'abuse', rules: [...new Set(abuse.map((h) => h.rule))] };

  return { kind: 'normal', rules: [] };
}

/**
 * 위험 분류에 대한 대응. exhaustive switch — 새 분류가 생기면 컴파일이 깨진다.
 *
 * 🚨 문안 원칙: 아이를 비난하지 않는다. 잘못했다는 신호를 주지 않는다.
 * `escalate` 경로는 일반 롤플레잉(`respond`)에서 도달할 수 없어야 한다.
 */
export interface Escalation {
  /** 세션을 즉시 중단하는가 */
  stopSession: boolean;
  /** 보호자에게 알리는가 */
  notifyGuardian: boolean;
  /** 아이에게 들려줄 문장 키 (src/audio/lines.ts 의 키) */
  lineKey: 'escalateSelfHarm' | 'escalateGeneral' | null;
}

export function escalationFor(kind: UtteranceClass): Escalation {
  switch (kind) {
    case 'selfHarm':
      return { stopSession: true, notifyGuardian: true, lineKey: 'escalateSelfHarm' };
    case 'abuse':
      return { stopSession: true, notifyGuardian: true, lineKey: 'escalateGeneral' };
    case 'sexual':
      return { stopSession: true, notifyGuardian: true, lineKey: 'escalateGeneral' };
    case 'exclusion':
      return { stopSession: true, notifyGuardian: true, lineKey: 'escalateGeneral' };
    case 'normal':
      return { stopSession: false, notifyGuardian: false, lineKey: null };
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
