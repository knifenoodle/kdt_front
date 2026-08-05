'use client';

/**
 * 보상 화면 — 3턴 완료 후.
 *
 * uiux기획/CLAUDE.md:53 — "세션은 끝난다: 무한 루프 없음. 대화 3턴이면 보상 화면 → 종료 안내."
 *
 * 🚨 점수·스트릭·비교 요소를 두지 않는다(불변식 S12, `uiux기획/CLAUDE.md:124-127`).
 * `cheer`(칭찬)와 `party`(보상 진입) 두 대사만 순서대로 재생하고, 다음 세션은
 * 아이가 "다시 하기"를 직접 눌러야 시작된다 — 자동으로 이어지지 않는다(규칙 7).
 *
 * 무지개떡은 세션 완주마다 한 층씩 채워진다(mockup:1858-1878, `lib/progress.ts`).
 * 6층을 채우면 완성 보상 3종(꿀파티/꿀수영장/떡메치기)이 순환 재생된다.
 */

import { useEffect, useRef, useState } from 'react';
import { Character } from '@/components/Character';
import { RainbowCake } from '@/components/RainbowCake';
import { RewardParty } from '@/components/RewardParty';
import { Tap } from '@/components/Tap';
import { LINES, type ResolvedSession } from '@/audio/lines';
import { speak } from '@/audio/speak';
import { sfx } from '@/audio/sfx';
import { PARTNER_SKIN } from '@/assets/characters';
import { getFilled, fillNextLayer, nextRewardKind, type RewardKind } from '@/lib/progress';
import { isLevelUp } from '@/lib/levelPlan';
import styles from './Reward.module.css';

interface Props {
  /** 완료된 세션의 lines. 없으면(폴백 상황) 저작 상수를 쓴다 */
  lines?: ResolvedSession['lines'];
  onReplay: () => void;
}

export function Reward({ lines, onReplay }: Props) {
  const [line, setLine] = useState(lines?.cheer.t ?? LINES.cheer.t);
  const [filled, setFilled] = useState(getFilled());
  const [justFilled, setJustFilled] = useState<number | null>(null);
  const [justLeveledUp, setJustLeveledUp] = useState(false);
  const [rewardKind, setRewardKind] = useState<RewardKind | null>(null);
  const timers = useRef<number[]>([]);
  // 🚨 H4(docs/10_UIUX_리뷰.md) 수정: 이 세션이 6층을 완성하는 세션인지 미리 안다
  // (이번 세션이 채울 층은 정확히 getFilled()+1번째). 완주 전인데도 매번 `lines.party`
  // ("다 모았어!")를 재생하면 그림(진행 중인 층수)과 말이 어긋난다.
  const willComplete = getFilled() + 1 >= 6;

  useEffect(() => {
    // 🚨 speak() 인자는 LINES.* 파생식을 직접 인라인한다(S4) — 중간 변수를 거치면
    // 안전성 추적이 끊긴다. Talk.tsx 의 기존 관례(`resolved?.lines.wait.t ?? LINES.wait.t`)와 동일.
    sfx.cheer();
    setLine(lines?.cheer.t ?? LINES.cheer.t);
    speak(lines?.cheer.t ?? LINES.cheer.t, () => {
      // 🚨 S4: 분기별로 speak() 인자를 LINES.* 파생식 그대로 인라인한다 — 중간 변수(삼항식
      // 결과 등)를 거치면 check-safety-rules.mjs 의 정적 검사가 추적할 수 없다.
      if (willComplete) {
        setLine(lines?.party.t ?? LINES.rewardParty.t);
        speak(lines?.party.t ?? LINES.rewardParty.t);
      } else {
        setLine(LINES.layerFilled.t);
        speak(LINES.layerFilled.t);
      }
    });

    // 무지개떡 한 층 채우기 — mockup:1865-1878. 0.6초 뒤 다음 층이 pop 과 함께 채워진다.
    sfx.reward();
    timers.current.push(
      window.setTimeout(() => {
        const i = fillNextLayer();
        if (i === null) return; // 이미 6층 — 이번 세션은 층을 늘리지 않는다
        setJustFilled(i);
        setFilled(i + 1);
        // 2층·4층(레벨1·레벨2 완주) 강조 연출 — 기획안 §1-2. 6층 완성과는 강도를 다르게 둔다.
        if (isLevelUp(i)) {
          setJustLeveledUp(true);
          sfx.levelUp();
        }
        if (i + 1 >= 6) {
          // 6층을 다 모았으면 완성 보상으로 넘어간다(순환 재생)
          timers.current.push(
            window.setTimeout(() => {
              const kind = nextRewardKind();
              setRewardKind(kind);
              // 🚨 S4: speak() 인자는 반드시 `t`(LINES.* 파생) 그대로 넘긴다 — 관례는
              // Talk.tsx 의 say() 와 동일. 중간에 record 조회 등을 거치면 안전성 추적이 끊긴다.
              const t = kind === 'party' ? LINES.rewardParty.t : kind === 'pool' ? LINES.rewardPool.t : LINES.rewardPound.t;
              setLine(t);
              speak(t);
            }, 700),
          );
        }
      }, 600),
    );

    return () => timers.current.forEach((id) => window.clearTimeout(id));
    // 마운트 시 1회만 — cheer→party 시퀀스가 재실행되지 않게 한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className={styles.reward}>
      {!rewardKind && <Character id={PARTNER_SKIN} state="idle" emo="joy" size={220} />}
      {rewardKind && <RewardParty kind={rewardKind} />}

      <RainbowCake
        filled={filled}
        justFilled={justFilled}
        levelUp={justLeveledUp}
        coated={rewardKind === 'party' || rewardKind === 'pool'}
        glossy={rewardKind === 'pound'}
      />

      {/* 글자는 보조 레이어다(규칙 4) — 위 캐릭터 표정과 재생된 음성만으로도 전달된다 */}
      <p className={`${styles.line} txt`}>{line}</p>

      <Tap primary onTap={onReplay} label="다시 하기">
        <span aria-hidden>🔁</span>
      </Tap>
    </main>
  );
}
