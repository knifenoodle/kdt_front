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
  /**
   * 2층·4층 완성(레벨업) 전용 — 참고자료/레벨시스템 심화기획안 v1.2.md §1-2 확정 스펙:
   * "기존 SFX 대비 피치만 살짝 높임, 신규 사운드 자산 불필요". cheer를 한 톤 올린 변형이다.
   */
  levelUp: () => {
    tone(784, 130);
    window.setTimeout(() => tone(1046, 190), 120);
  },
  reward: () => {
    [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => tone(f, 200), i * 130));
  },
  /** 꿀 흐르는 느낌: 낮게 흘러내리는 톤 → 축하 아르페지오 */
  party: () => {
    [880, 784, 698, 622].forEach((f, i) => window.setTimeout(() => tone(f, 260, 'triangle'), i * 90));
    [523, 659, 784, 1046, 1318].forEach((f, i) => window.setTimeout(() => tone(f, 300), 480 + i * 140));
  },
  /** 마음이 열리는 소리 — 3음 상행. 실패음이 아니라 개방음이다(규칙 6) */
  open: () => {
    [392, 523, 659].forEach((f, i) => window.setTimeout(() => tone(f, 240, 'triangle'), i * 110));
  },
  /** 떡메치기 — 낮고 짧은 타격 4번, 마지막에 밝은 화음 */
  pound: () => {
    [0, 1, 2, 3].forEach((n) => window.setTimeout(() => tone(196, 140, 'square'), 250 + n * 900));
    window.setTimeout(() => {
      [523, 659, 784].forEach((f, i) => window.setTimeout(() => tone(f, 320), i * 90));
    }, 3250);
  },
  /** 첨벙 — 낮게 통통 튀는 톤. 폭죽 없이도 '들어갔다'가 들리게 */
  splash: () => {
    [392, 523, 440, 587, 494].forEach((f, i) => window.setTimeout(() => tone(f, 220, 'triangle'), i * 180));
  },
};
