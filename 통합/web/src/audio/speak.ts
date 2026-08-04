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

export function shutUp(): void {
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

  if (typeof window === 'undefined' || !window.speechSynthesis) {
    // TTS 미지원 — 글자 길이 기반 폴백 타이머로 흐름을 유지한다(목업과 동일).
    window?.setTimeout(() => onEnd?.(), 400 + safe.text.length * 90);
    return;
  }

  shutUp();
  const u = new SpeechSynthesisUtterance(safe.text);
  u.lang = 'ko-KR';
  const v = pickVoice();
  if (v) u.voice = v;
  u.rate = 0.95; // 만 4~6세 대상 — 조금 느리게
  u.pitch = 1.1;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
}
