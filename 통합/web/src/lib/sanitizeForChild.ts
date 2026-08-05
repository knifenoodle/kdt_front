/**
 * 🚨 서버 문자열 → 아동 음성 출력 사이의 유일한 관문 (CS-001 / 불변식 S4).
 *
 * 왜 필요한가:
 *   `scenario_generator.py:143` → `main.py:83` → 프런트 → `speak()` 경로에서,
 *   fail-open validator(`validator.py:71-73`)와 20단어 블랙리스트(`:11-15`)를
 *   통과한 문자열이 **글자를 못 읽는 만 4~6세의 귀로 직접 들어간다.**
 *   현행 데모는 화면 텍스트라 성인 개발자가 눈으로 걸러내지만,
 *   통합 후에는 걸러낼 사람이 없다.
 *
 * 계약:
 *   speak() 의 인자는 `LINES.*` 상수이거나 `sanitizeForChild()` 의 반환값이어야 한다.
 *   `speak(scenario.ai_first_message)` 같은 직접 전달은 0건이며
 *   `scripts/check-safety-rules.mjs` 의 S4 가 이를 기계적으로 강제한다.
 */

import { scanRisk, type RiskHit } from './riskPatterns';

/** schemas.py Line.t 의 max_length 및 session-script.schema.json 과 반드시 일치.
 * 근거: GDL-001-R1 (만 4~6세: 1~2문장, 문장당 10단어 내외) */
export const LINE_MAX = 120;

export interface SanitizeResult {
  /** 실제로 말해도 되는 문자열 */
  text: string;
  /** 원문이 그대로 통과했는가 */
  passed: boolean;
  /** 통과하지 못한 이유 (개발자·텔레메트리용. 🚨 아이에게 보여주지 않는다) */
  reason?: 'risk' | 'too_long' | 'empty';
  hits?: RiskHit[];
}

/**
 * @param raw      서버가 준 문자열
 * @param fallback 위험·과길이 시 대신 말할 저작 문장. 반드시 `LINES.*` 에서 온다.
 */
export function sanitizeForChild(raw: unknown, fallback: string): SanitizeResult {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { text: fallback, passed: false, reason: 'empty' };
  }
  const text = raw.trim();

  // 🚨 자르지 않는다. 아이가 듣는 문장을 중간에서 끊으면 저작 폴백보다 나쁘다.
  if (text.length > LINE_MAX) {
    return { text: fallback, passed: false, reason: 'too_long' };
  }

  const hits = scanRisk(text);
  if (hits.length > 0) {
    // 서버가 위험 문자열을 보냈다 = 상류 가드레일이 뚫렸다는 뜻이다.
    // 아이에게는 아무 일도 없었던 것처럼 저작 문장이 나가고, 사실은 로그로만 남는다.
    return { text: fallback, passed: false, reason: 'risk', hits };
  }

  return { text, passed: true };
}
