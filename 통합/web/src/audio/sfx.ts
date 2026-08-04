/**
 * 효과음 — Web Audio 오실레이터. `mockup-v1.html:1431-1468` 이식.
 * 사운드 파일 0개다.
 *
 * 🚨 실패 사운드가 존재하지 않는다 (uiux기획/CLAUDE.md:51 규칙 6).
 * `fail`/`wrong`/`error` 톤을 추가하지 말 것.
 */

let ctx: AudioContext | null = null;

function tone(freq: number, ms: number, type: OscillatorType = 'sine'): void {
  if (typeof window === 'undefined') return;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ms / 1000);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + ms / 1000);
  } catch {
    /* 오디오 불가 환경 — 무음으로 진행한다. 아이 화면에 오류를 띄우지 않는다 */
  }
}

/** uiux기획/CLAUDE.md:49 — 모든 탭은 100ms 내 시각+청각 응답. */
export const sfx = {
  tap: () => tone(660, 90),
  start: () => {
    tone(523, 120);
    window.setTimeout(() => tone(784, 160), 110);
  },
  listen: () => tone(880, 130),
  cheer: () => {
    tone(659, 130);
    window.setTimeout(() => tone(880, 180), 120);
  },
};
