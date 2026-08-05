/**
 * 위험 표현 사전 — 출력측/입력측이 **같은 사전을 쓰되 동작이 정반대**다.
 *
 *   출력측 sanitizeForChild()      LLM 생성물 → **차단** + 저작 폴백 대체
 *   입력측 classifyChildUtterance() 아동 발화  → **에스컬레이션** (차단 아님)
 *
 * 🚨 자해를 말한 아이에게 "금지 키워드가 감지되었습니다"로 응답하는 것은
 * ETH-002-R6(수치심 유발 피드백 금지)의 최악 위반이다. 아이를 비난하지 않고
 * 세션을 중단한 뒤 어른에게 말하도록 안내한다.
 *
 * ── 상류 백엔드 사전의 실측 결함 (rule_engine/validator.py:11-15) ──
 * 20단어 부분문자열 매칭이 전부다. 격리 실행으로 확인:
 *   통과 ❌ `죽고 싶을 만큼 힘들었어. 자해했어.`              자해 필터 없음
 *   통과 ❌ `옷 벗어봐. 야한 사진 보여줄게.`                   성적 필터 없음
 *   통과 ❌ `우리 반 전체가 너랑 안 놀 거야. 아무도 말 걸지 마.` 단어를 안 써서 통과
 *   차단 ❌ `장애물 달리기를 했어요`                            `장애` 부분일치 오탐
 *
 * 여기서 (1) 미탐 3종을 신설하고 (2) 오탐 2종을 제거한다.
 * 부분문자열 대신 **단어 경계·문맥 패턴**을 쓴다.
 */

export type RiskKind = 'selfHarm' | 'sexual' | 'abuse' | 'exclusion' | 'violence' | 'demeaning';

export interface RiskPattern {
  kind: RiskKind;
  re: RegExp;
  /** 왜 이 패턴이 있는지 — 근거 규칙 ID */
  rule: string;
}

export const RISK_PATTERNS: RiskPattern[] = [
  // ── 자해·자살 (상류에 전혀 없음) ────────────────────────────────
  { kind: 'selfHarm', rule: 'LEGAL-001', re: /죽고\s*싶/ },
  { kind: 'selfHarm', rule: 'LEGAL-001', re: /자해/ },
  { kind: 'selfHarm', rule: 'LEGAL-001', re: /(사라|없어)지고\s*싶/ },
  { kind: 'selfHarm', rule: 'LEGAL-001', re: /태어나지\s*말/ },

  // ── 성적 내용 (상류에 전혀 없음) ────────────────────────────────
  { kind: 'sexual', rule: 'ETH-002', re: /옷\s*벗/ },
  { kind: 'sexual', rule: 'ETH-002', re: /야한/ },
  { kind: 'sexual', rule: 'ETH-002', re: /몸\s*(을\s*)?만지/ },
  { kind: 'sexual', rule: 'LEGAL-002', re: /성폭력|몰카/ },

  // ── 무언어 집단배제 (금지어가 없어 키워드로는 불가) ─────────────
  // 실측 미탐 문장 `우리 반 전체가 너랑 안 놀 거야. 아무도 말 걸지 마.` 를 잡는다.
  { kind: 'exclusion', rule: 'LEGAL-002', re: /아무도\s*.{0,6}(마|않|안)\b/ },
  { kind: 'exclusion', rule: 'LEGAL-002', re: /(우리\s*반|우리\s*다|다\s*같이)\s*.{0,8}안\s*(놀|해|만나)/ },
  { kind: 'exclusion', rule: 'LEGAL-002', re: /너만\s*빼고/ },
  { kind: 'exclusion', rule: 'LEGAL-002', re: /말\s*걸지\s*마/ },
  { kind: 'exclusion', rule: 'LEGAL-002', re: /같이\s*안\s*(놀|해)/ },
  { kind: 'exclusion', rule: 'LEGAL-002', re: /따돌|왕따/ },

  // ── 폭력 (상류 사전을 굴절 대응으로 보강) ───────────────────────
  // 상류는 `때려` 만 있어 `때렸`·`때린` 을 놓친다.
  { kind: 'violence', rule: 'LEGAL-001', re: /때(려|렸|린|리고|릴)/ },
  { kind: 'violence', rule: 'LEGAL-001', re: /죽(여|일|였)/ },
  { kind: 'violence', rule: 'LEGAL-001', re: /칼|흉기/ },
  { kind: 'violence', rule: 'LEGAL-001', re: /협박|감금/ },
  { kind: 'violence', rule: 'LEGAL-001', re: /피가\s*(나|났)/ },

  // ── 비하 (오탐 제거판) ──────────────────────────────────────────
  // 🚨 상류의 `장애`·`가난` 을 **제외했다**. 부분문자열로는 `장애물`·`장애인 배려`·
  // `발달장애 이해` 같은 정당한 용법과 구분할 수 없다. 이 규칙의 실체는
  // "차별 표현 금지"이며 프롬프트 규칙(ETH-002-R1)과 LLM 판정으로 이관한다.
  { kind: 'demeaning', rule: 'ETH-002', re: /바보|멍청이|병신/ },
  { kind: 'demeaning', rule: 'ETH-002', re: /못생(겼|긴)/ },
  { kind: 'demeaning', rule: 'ETH-002', re: /뚱뚱(해|한|이)/ },
];

export interface RiskHit {
  kind: RiskKind;
  rule: string;
  pattern: string;
}

export function scanRisk(text: string): RiskHit[] {
  const hits: RiskHit[] = [];
  for (const p of RISK_PATTERNS) {
    if (p.re.test(text)) hits.push({ kind: p.kind, rule: p.rule, pattern: String(p.re) });
  }
  return hits;
}
