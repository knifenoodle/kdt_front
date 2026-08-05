/**
 * TTS — Web Speech API (ko-KR). `mockup-v1.html:1470-1490` 이식.
 *
 * 온디바이스 합성을 우선한다. 서버 TTS 벤더를 쓰지 않으므로 `GOV-002-R2`(위탁 계약)
 * 범위가 최소화된다. 다만 일부 브라우저는 합성을 서버로 보낸다 — 보내는 것은
 * **캐릭터 대사**(개인정보 아님)이지만 `GOV-003` 고지 대상이므로
 * 보호자 화면에 고지한다(uiux기획/CLAUDE.md:112-113).
 */

import { LINES } from './lines';
import { sanitizeForChild } from '@/lib/sanitizeForChild';

let voice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  if (voice) return voice;
  const all = window.speechSynthesis.getVoices();
  const ko = all.filter((v) => v.lang?.toLowerCase().startsWith('ko'));
  // 로컬(온디바이스) 보이스를 우선한다 — 네트워크 전송을 줄인다.
  voice = ko.find((v) => v.localService) ?? ko[0] ?? null;
  return voice;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    voice = null;
    pickVoice();
  };
}

/**
 * 🚨 H2(docs/10_UIUX_리뷰.md) 수정 — "다시 듣기"가 반복이 아니라 건너뛰기로 동작하던
 * 원인: `speak()`가 새 발화 전에 호출하는 `shutUp()`(`cancel()`)이 브라우저 실동작상
 * **이전 발화의 `onend`를 즉시 발화시킨다.** 이전 onend는 "다음 대사로 진행"을 뜻하는
 * 콜백이므로, 재생 중인 대사를 다시 들으려는 탭조차 다음 대사로 건너뛰는 결과가 됐다.
 * 매 발화에 세대 토큰을 매겨, 이미 교체(supersede)된 발화의 onend는 무시한다 — 그
 * 발화가 "자연 종료"됐는지 "교체당해 취소"됐는지를 구분하는 것이 이 수정의 핵심이다.
 */
let activeId = 0;

export function shutUp(): void {
  activeId += 1; // 지금 재생 중인 발화의 onEnd를 전부 무효화한다 — 정지는 진행이 아니다.
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
}

/**
 * 🚨 인자는 `LINES.*` 상수이거나 `sanitizeForChild()` 반환값이어야 한다 (S4).
 * `speak(scenario.ai_first_message)` 같은 직접 전달은 금지이며
 * `scripts/check-safety-rules.mjs` 가 기계적으로 강제한다.
 *
 * 여기서도 한 번 더 통과시킨다(다중 방어). 관문을 우회한 호출이 들어와도
 * 위험 문자열이 아이 귀에 도달하지 않는다.
 */
export function speak(text: string, onEnd?: () => void): void {
  const safe = sanitizeForChild(text, LINES.cant.t);

  // 이 호출이 "현재" 발화가 된다 — 이후 새 speak()/shutUp() 호출이 있기 전까지만 유효.
  activeId += 1;
  const id = activeId;

  if (typeof window === 'undefined' || !window.speechSynthesis) {
    // TTS 미지원 — 글자 길이 기반 폴백 타이머로 흐름을 유지한다(목업과 동일).
    window?.setTimeout(() => {
      if (id === activeId) onEnd?.();
    }, 400 + safe.text.length * 90);
    return;
  }

  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(safe.text);
  u.lang = 'ko-KR';
  const v = pickVoice();
  if (v) u.voice = v;
  u.rate = 0.95; // 만 4~6세 대상 — 조금 느리게
  u.pitch = 1.1;

  // 🚨 워치독(docs/10_UIUX_리뷰.md H6) — onend/onerror 가 응답하지 않는 브라우저·엔진
  // 결함에 대비한다. 이게 없으면 세션이 그 자리에서 영구 정지된다(다시 듣기·다시 하기로도
  // 못 벗어난다 — 둘 다 새 speak() 호출을 전제하는데 아이 입장에선 다음 버튼이 안 보인다).
  // `settled` 플래그로 정상 종료와 워치독 발화가 서로 중복 호출되지 않게 한다.
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    if (id === activeId) onEnd?.(); // id가 여전히 activeId와 같을 때만 — 교체당한 발화는 무음 처리
  };
  u.onend = settle;
  u.onerror = settle;
  window.speechSynthesis.speak(u);
  window.setTimeout(settle, 1500 + safe.text.length * 200);
}
