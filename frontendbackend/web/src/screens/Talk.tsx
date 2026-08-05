'use client';

/**
 * 세션 전체 흐름 — 시작 화면 → 3턴 대화 → 보상 화면.
 *
 * 증명 대상: 백엔드 `ai_first_message` 가 실제 아이 화면 말풍선과 ko-KR TTS 로 나온다.
 *
 * 🚨 마이크는 여전히 비활성이다(D2 — STT 제외). 아이가 발화를 마쳤음을 알리는 수단이
 * 없으므로, "말했어요" 탭이 그 자리를 **임시로** 대신한다. 이 탭은 무엇을 눌러도
 * 항상 같은 결과(다음 단계로 진행)로 이어진다 — 아무것도 평가하지 않는다(규칙 6).
 * 아동 발화를 녹음·전송·저장하지 않으며, 판정 로직이 없으므로 캐릭터 감정이
 * "아이가 무엇을 말했는가"에 바인딩될 경로 자체가 없다(S1). STT 가 켜지면 이 탭을
 * 실제 인식 결과로 교체하되, 이 파일의 phase 전이·턴 진행 로직은 그대로 재사용한다.
 *
 * 🚨 지연 은닉(M5): 인트로 내레이션 중에 세션을 prefetch 한다.
 * 인트로+demo_in+demo[3] = TTS 5발화로 대략 10초 이상이므로 그 안에 끝나면
 * 아이는 대기를 인지하지 않는다. 초과 시 thinking + wait 대사로 넘어간다.
 * 로딩 스피너를 쓰지 않는다(uiux기획/CLAUDE.md:128).
 *
 * 1단계 범위 밖: 마이크 실입력, STT, 실제 발화 판정, 보호자 게이트.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Character, type CharState } from '@/components/Character';
import { MicButton } from '@/components/MicButton';
import { Tap } from '@/components/Tap';
import { Reward } from './Reward';
import { LINES, FALLBACK_DECK, resolveSession, type ResolvedSession } from '@/audio/lines';
import { speak, shutUp } from '@/audio/speak';
import { sfx } from '@/audio/sfx';
import { fetchSession, type SessionScript } from '@/lib/api';
import { initialState, reduce } from '@/lib/session-machine';
import { PARTNER_SKIN } from '@/assets/characters';
import styles from './Talk.module.css';

type Screen = 'start' | 'talk';

export function Talk() {
  const [screen, setScreen] = useState<Screen>('start');
  const [s, dispatch] = useReducer(reduce, initialState);
  const [script, setScript] = useState<SessionScript | null>(null);
  const [resolved, setResolved] = useState<ResolvedSession | null>(null);
  const [bubble, setBubble] = useState<{ who: string; t: string } | null>(null);
  const [waiting, setWaiting] = useState(false);
  const pending = useRef<Promise<void> | null>(null);
  const waitTimer = useRef<number | null>(null);

  /** 🚨 서버 스크립트는 반드시 resolveSession() 을 경유한다(S4). */
  const adopt = useCallback((sc: SessionScript) => {
    setScript(sc);
    setResolved(resolveSession(sc));
  }, []);

  // 인트로 내레이션 중 prefetch (M5)
  const prefetch = useCallback(() => {
    if (pending.current) return pending.current;
    pending.current = fetchSession({ category: 'ownership_turn' })
      .then(adopt)
      .catch(() => {
        /* 🚨 아이 화면은 실패를 인지하지 않는다. 저작 폴백으로 계속한다.
           오류 문자열·오류 색이 아이 화면에 도달하는 경로가 없다. */
      });
    return pending.current;
  }, [adopt]);

  const say = useCallback((who: string, t: string, onEnd?: () => void) => {
    setBubble({ who, t });
    speak(t, onEnd);
  }, []);

  // ── 시작 ──────────────────────────────────────────────────────
  const start = useCallback(() => {
    sfx.start();
    setScreen('talk');
    void prefetch();

    const l = resolved?.lines;
    // 고지 → 인트로 → 시범 예고 순. AI 고지는 첫 세션에서 1회 재생된다(S8).
    say('songpyeon', l?.ai_disclosure.t ?? LINES.aiDisclosure.t, () => {
      say('songpyeon', l?.intro.t ?? FALLBACK_DECK.intro.t, () => {
        say('songpyeon', l?.demo_in.t ?? FALLBACK_DECK.demoIn.t, () => {
          dispatch({ type: 'INTRO_DONE' });
        });
      });
    });
  }, [prefetch, resolved, say]);

  // ── 시범 3줄 → turn 1 ask ─────────────────────────────────────
  useEffect(() => {
    if (screen !== 'talk') return;
    if (s.phase !== 'demo') return;

    const demo = resolved?.lines.demo ?? FALLBACK_DECK.demo;
    const line = demo[s.demoIndex];
    if (!line) return;
    say(line.who, line.t, () => dispatch({ type: 'DEMO_NEXT' }));
  }, [screen, s.phase, s.demoIndex, resolved, say]);

  // 시범이 끝났는데 아직 서버 응답이 없으면 thinking 으로 대기한다
  useEffect(() => {
    if (s.phase !== 'ask') return;

    const run = () => {
      const turn = resolved?.turns[s.turn];
      const ask = turn?.ask ?? FALLBACK_DECK.firstAsk;
      setWaiting(false);
      say(ask.who, ask.t, () => dispatch({ type: 'ASK_DONE' }));
    };

    if (script) {
      run();
      return;
    }
    // 🚨 로딩 스피너 대신 캐릭터 thinking + "조금만 기다려줘"
    setWaiting(true);
    dispatch({ type: 'THINKING' });
    waitTimer.current = window.setTimeout(() => {
      say('songpyeon', resolved?.lines.wait.t ?? LINES.wait.t);
    }, 3000);
    void pending.current?.then(() => {
      if (waitTimer.current) window.clearTimeout(waitTimer.current);
      run();
    });
    return () => {
      if (waitTimer.current) window.clearTimeout(waitTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, script]);

  // ── 턴별 back — 아이가 "말했어요"를 누른 뒤 상대역의 응답 ─────────
  useEffect(() => {
    if (s.phase !== 'respond') return;
    const turn = resolved?.turns[s.turn];
    // 폴백 데크에는 3턴 전체의 back 문구가 없으므로, 없을 때는 칭찬으로 대체한다 —
    // 침묵보다 낫고, 규칙 6(항상 긍정)에 어긋나지 않는다.
    const back = turn?.back ?? { who: script?.other ?? 'sirutteok', t: LINES.cheer.t };
    say(back.who, back.t, () => dispatch({ type: 'RESPOND_DONE' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, s.turn]);

  useEffect(() => () => shutUp(), []);

  const replay = useCallback(() => {
    if (bubble) speak(bubble.t);
  }, [bubble]);

  /**
   * 🚨 세션은 끝난다(규칙 7 — 무한 루프 없음). 보상 화면의 "다시 하기"는
   * 아이가 직접 눌러야 하고, 다음 세션은 처음부터(인트로 → 시범 → 턴 1) 다시 시작한다.
   */
  const handleReplay = useCallback(() => {
    shutUp();
    dispatch({ type: 'RESET' });
    pending.current = null;
    setScript(null);
    setResolved(null);
    setBubble(null);
    setWaiting(false);
    setScreen('start');
  }, []);

  // ── 렌더 ──────────────────────────────────────────────────────
  const other = script?.other ?? 'sirutteok';
  const turn = resolved?.turns[s.turn];

  // 🚨 S1: 파트너(송편)의 감정은 아이 발화에 바인딩되지 않는다.
  // 여기서 emo 를 넘기지 않는 것 자체가 불변식이다 — 판정 결과가 닿을 경로가 없다.
  let partnerState: CharState = 'idle';
  if (s.phase === 'waitForChild') partnerState = 'listening';
  else if (waiting) partnerState = 'thinking';
  else if (bubble?.who === 'songpyeon') partnerState = 'speaking';

  const otherState: CharState = bubble?.who === other ? 'speaking' : 'idle';

  // 🚨 S1(계속): back_emo 는 아이 발화의 채점이 아니라 상황 전개의 결과다
  // (캐릭터_가이드_v1.md §5). respond 단계에서만 back_emo 로 바뀌고, 그 전환은
  // 턴 인덱스에만 의존한다 — 판정 로직이 없으므로 "말했어요" 탭이 무엇을 대신하든 불변이다.
  const emoToShow = s.phase === 'respond' ? turn?.back_emo : turn?.emo;

  if (screen === 'start') {
    return (
      <main className={styles.start}>
        <Character id={PARTNER_SKIN} state="idle" emo="joy" size={240} />
        {/* 오늘 주제는 통보형이다 — 아이가 고르지 않는다 */}
        <p className={`${styles.today} txt`}>{LINES.today.t}</p>
        <Tap primary onTap={start} label="시작하기">
          <span aria-hidden>▶</span>
        </Tap>
      </main>
    );
  }

  // 3턴 완료. lines 는 resolveSession() 을 거친 값만 넘긴다(S4) — 없으면
  // Reward 컴포넌트가 자체 저작 상수(LINES.cheer/party)로 대체한다.
  if (s.phase === 'reward') {
    return <Reward lines={resolved?.lines} onReplay={handleReplay} />;
  }

  return (
    <main className={styles.talk}>
      <div className={styles.stage}>
        <Character id={PARTNER_SKIN} state={partnerState} size={200} />
        <Character id={other} state={otherState} emo={emoToShow ?? 'none'} size={200} />
      </div>

      {/* 글자는 아이콘·음성 위에 덧입히는 보조 레이어다(규칙 4).
          .txt 를 전부 숨겨도 다음 행동을 알 수 있어야 한다 — 검증 절차 (4) */}
      <p className={`${styles.bubble} txt`}>{bubble?.t ?? ''}</p>

      <div className={styles.controls}>
        {/* 🚨 다시 듣기 버튼은 항상 화면에 있다(uiux기획/CLAUDE.md:130) */}
        <Tap onTap={replay} label="다시 듣기">
          <span aria-hidden>🔁</span>
        </Tap>
        {s.phase === 'waitForChild' ? (
          // 🚨 STT 대신 임시로 진행을 표시하는 탭. 파일 상단 주석 참조.
          <Tap primary onTap={() => dispatch({ type: 'CHILD_SPOKE_OK' })} label="말했어요">
            <span aria-hidden>💬</span>
          </Tap>
        ) : (
          // 1단계에서는 비활성 — D2
          <MicButton onSpeak={() => {}} disabled />
        )}
      </div>
    </main>
  );
}
