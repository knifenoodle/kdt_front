'use client';

/**
 * 보상 화면 — 3턴 완료 후.
 *
 * uiux기획/CLAUDE.md:53 — "세션은 끝난다: 무한 루프 없음. 대화 3턴이면 보상 화면 → 종료 안내."
 *
 * 🚨 점수·스트릭·비교 요소를 두지 않는다(불변식 S12, `uiux기획/CLAUDE.md:124-127`).
 * `cheer`(칭찬)와 `party`(보상 진입) 두 대사만 순서대로 재생하고, 다음 세션은
 * 아이가 "다시 하기"를 직접 눌러야 시작된다 — 자동으로 이어지지 않는다(규칙 7).
 */

import { useEffect, useState } from 'react';
import { Character } from '@/components/Character';
import { Tap } from '@/components/Tap';
import { LINES, type ResolvedSession } from '@/audio/lines';
import { speak } from '@/audio/speak';
import { sfx } from '@/audio/sfx';
import { PARTNER_SKIN } from '@/assets/characters';
import styles from './Reward.module.css';

interface Props {
  /** 완료된 세션의 lines. 없으면(폴백 상황) 저작 상수를 쓴다 */
  lines?: ResolvedSession['lines'];
  onReplay: () => void;
}

export function Reward({ lines, onReplay }: Props) {
  const [line, setLine] = useState(lines?.cheer.t ?? LINES.cheer.t);

  useEffect(() => {
    // 🚨 speak() 인자는 LINES.* 파생식을 직접 인라인한다(S4) — 중간 변수를 거치면
    // 안전성 추적이 끊긴다. Talk.tsx 의 기존 관례(`resolved?.lines.wait.t ?? LINES.wait.t`)와 동일.
    sfx.cheer();
    setLine(lines?.cheer.t ?? LINES.cheer.t);
    speak(lines?.cheer.t ?? LINES.cheer.t, () => {
      setLine(lines?.party.t ?? LINES.cheer.t);
      speak(lines?.party.t ?? LINES.cheer.t);
    });
    // 마운트 시 1회만 — cheer→party 시퀀스가 재실행되지 않게 한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className={styles.reward}>
      <Character id={PARTNER_SKIN} state="idle" emo="joy" size={260} />

      {/* 글자는 보조 레이어다(규칙 4) — 위 캐릭터 표정과 재생된 음성만으로도 전달된다 */}
      <p className={`${styles.line} txt`}>{line}</p>

      <Tap primary onTap={onReplay} label="다시 하기">
        <span aria-hidden>🔁</span>
      </Tap>
    </main>
  );
}
