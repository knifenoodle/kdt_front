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
import { Scene } from '@/components/Scene';
import { Tap } from '@/components/Tap';
import { Reward } from './Reward';
import { LINES, FALLBACK_DECK, resolveSession, type ResolvedSession } from '@/audio/lines';
import { speak, shutUp } from '@/audio/speak';
import { sfx } from '@/audio/sfx';
import { fetchSession, type SessionScript } from '@/lib/api';
import { getFilled, resetIfComplete } from '@/lib/progress';
import { nextScenario, rerollPlan } from '@/lib/levelPlan';
import { initialState, reduce, supportSlot, RETRY_MAX } from '@/lib/session-machine';
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
  /** 마음 열림(openHeart, mockup:1786-1809) — 정지 → 부풀기(+시루떡 층 벌어짐) */
  const [heart, setHeart] = useState<'idle' | 'freeze' | 'open'>('idle');
  const pending = useRef<Promise<void> | null>(null);
  const waitTimer = useRef<number | null>(null);
  const heartTimers = useRef<number[]>([]);
  const hintTimer = useRef<number | null>(null);
  /** 파트너가 지금 힌트/지원 대사를 말하는 중인가 — 캐릭터 상태(speaking/listening) 결정용 */
  const [promptSpeaking, setPromptSpeaking] = useState(false);
  /**
   * 🚨 H3(docs/10_UIUX_리뷰.md) 수정: `start()`는 탭 시점에 딱 한 번 호출되는
   * useCallback이라, 그 안에서 `resolved` state를 직접 읽으면 호출 당시 값(늘 null)에
   * 클로저로 갇힌다 — 이후 fetch가 끝나 `resolved`가 갱신돼도 이미 실행 중인
   * `say()` 체인은 그 값을 보지 못한다. `ask` 이펙트처럼 매 렌더 최신값을 읽도록
   * ref로 미러링해, ai_disclosure/intro/demo_in 재생 시점에 이미 도착한 서버 값을 쓴다.
   */
  const resolvedRef = useRef<ResolvedSession | null>(null);
  useEffect(() => {
    resolvedRef.current = resolved;
  }, [resolved]);

  /** 🚨 서버 스크립트는 반드시 resolveSession() 을 경유한다(S4). */
  const adopt = useCallback((sc: SessionScript) => {
    setScript(sc);
    setResolved(resolveSession(sc));
  }, []);

  // 인트로 내레이션 중 prefetch (M5)
  // 🚨 레벨×변이는 실제 발화 판정이 아니라 완주 횟수(무지개떡 층수)로만 진행된다(D2 — STT 제외).
  // 레벨시스템 v1.2 §2-3/§2-5 A안, lib/levelPlan.ts 참조.
  const prefetch = useCallback(() => {
    if (pending.current) return pending.current;
    const plan = nextScenario(getFilled());
    pending.current = fetchSession({ category: 'ownership_turn', level: plan.level, variation: plan.variation, scene: plan.scene })
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

    // 🚨 각 단계마다 resolvedRef.current를 다시 읽는다(H3 수정) — ai_disclosure 재생 중에도
    // prefetch는 계속 진행되므로, intro/demo_in 차례가 됐을 때는 그 사이 도착한 최신
    // 서버 값(레벨×변이별 상황 안내·시범)을 써야 한다. 아직 안 왔으면 폴백을 쓴다.
    say('songpyeon', resolvedRef.current?.lines.ai_disclosure.t ?? LINES.aiDisclosure.t, () => {
      say('songpyeon', resolvedRef.current?.lines.intro.t ?? FALLBACK_DECK.intro.t, () => {
        say('songpyeon', resolvedRef.current?.lines.demo_in.t ?? FALLBACK_DECK.demoIn.t, () => {
          dispatch({ type: 'INTRO_DONE' });
        });
      });
    });
  }, [prefetch, say]);

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

  /**
   * 🚨 지원(힌트) 3단계 배선 — hint(0) → sup1(1) → sup2(2, 함께 말하기).
   *
   * STT가 없어 "미통과"를 판정할 수 없으므로(D2), 무응답 시간 초과를 다음 단계로
   * 넘어가는 트리거로 쓴다. 이는 채점이 아니라 "아직 준비가 안 됐구나"의 신호다 —
   * 아이가 아무 때나 "말했어요"를 탭하면 그 즉시 CHILD_SPOKE_OK로 전이해 이 타이머는
   * 무의미해진다(§2-7: 지원 사용 여부와 무관하게 완수로 인정).
   *
   * support===2(sup2, 함께 말하기)에 도달하면 그 대사 재생이 끝나는 즉시 턴을
   * 완결시킨다 — "지원과 함께 해당 턴이 완결된다. 아동을 붙잡아 두지 않는다"(§2-7 확정).
   */
  const ESCALATE_MS = 7000;
  useEffect(() => {
    if (s.phase !== 'waitForChild') return;
    const turn = resolved?.turns[s.turn];
    const slot = supportSlot(s);
    const line = turn?.[slot];
    if (!line) return; // 폴백 데크는 지원 대사가 없다 — 저작 폴백 이상은 강요하지 않는다

    setPromptSpeaking(true);
    say(line.who, line.t, () => {
      setPromptSpeaking(false);
      if (s.support >= RETRY_MAX) {
        // 함께 말하기(sup2) 완료 — 벌이 아니라 지원 상향이며, 여기서 턴이 완결된다.
        dispatch({ type: 'CHILD_SPOKE_OK' });
        return;
      }
      hintTimer.current = window.setTimeout(() => {
        dispatch({ type: 'RETRY' });
      }, ESCALATE_MS);
    });

    return () => {
      if (hintTimer.current) window.clearTimeout(hintTimer.current);
      setPromptSpeaking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, s.support, s.turn, resolved]);

  // ── 턴별 back — 아이가 "말했어요"를 누른 뒤 상대역의 응답 ─────────
  useEffect(() => {
    if (s.phase !== 'respond') return;
    const turn = resolved?.turns[s.turn];
    // 폴백 데크에는 3턴 전체의 back 문구가 없으므로, 없을 때는 칭찬으로 대체한다 —
    // 침묵보다 낫고, 규칙 6(항상 긍정)에 어긋나지 않는다.
    const back = turn?.back ?? { who: script?.other ?? 'sirutteok', t: LINES.cheer.t };
    // 🚨 마지막 턴 = 마음이 열린다. 정지(200ms) → 부풀기(+시루떡은 층도 벌어짐), 1.5초 뒤 원상복귀.
    const totalTurns = resolved?.turns.length ?? 3;
    if (s.turn === totalTurns - 1) {
      setHeart('freeze');
      heartTimers.current.push(
        window.setTimeout(() => {
          setHeart('open');
          sfx.open();
        }, 200),
        window.setTimeout(() => setHeart('idle'), 1700),
      );
    }
    say(back.who, back.t, () => dispatch({ type: 'RESPOND_DONE' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, s.turn]);

  useEffect(() => () => {
    shutUp();
    heartTimers.current.forEach((id) => window.clearTimeout(id));
  }, []);

  const replay = useCallback(() => {
    if (bubble) speak(bubble.t);
  }, [bubble]);

  /**
   * 🚨 세션은 끝난다(규칙 7 — 무한 루프 없음). 보상 화면의 "다시 하기"는
   * 아이가 직접 눌러야 하고, 다음 세션은 처음부터(인트로 → 시범 → 턴 1) 다시 시작한다.
   */
  const handleReplay = useCallback(() => {
    shutUp();
    heartTimers.current.forEach((id) => window.clearTimeout(id));
    heartTimers.current = [];
    setHeart('idle');
    // 라운드(6층)가 방금 끝났으면 다음 라운드의 레벨당 변이 조합을 새로 뽑는다(§2-3).
    if (resetIfComplete()) rerollPlan();
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
  // promptSpeaking(힌트/지원 대사 재생 중)이 waitForChild 의 기본 listening 보다 우선한다 —
  // 그렇지 않으면 파트너가 말하는 도중에도 계속 "듣는" 표정을 짓는다.
  let partnerState: CharState = 'idle';
  if (promptSpeaking) partnerState = 'speaking';
  else if (s.phase === 'waitForChild') partnerState = 'listening';
  else if (waiting) partnerState = 'thinking';
  else if (bubble?.who === 'songpyeon') partnerState = 'speaking';

  const otherState: CharState = bubble?.who === other ? 'speaking' : 'idle';

  // 🚨 S1(계속): back_emo 는 아이 발화의 채점이 아니라 상황 전개의 결과다
  // (캐릭터_가이드_v1.md §5). respond 단계에서만 back_emo 로 바뀌고, 그 전환은
  // 턴 인덱스에만 의존한다 — 판정 로직이 없으므로 "말했어요" 탭이 무엇을 대신하든 불변이다.
  const emoToShow = s.phase === 'respond' ? turn?.back_emo : turn?.emo;
  const scene = resolved?.scene ?? 'kids';

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
      <Scene id={scene} />
      <div className={styles.stage}>
        <Character id={PARTNER_SKIN} state={partnerState} size={200} />
        <Character id={other} state={otherState} emo={emoToShow ?? 'none'} heart={heart} size={200} />
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
