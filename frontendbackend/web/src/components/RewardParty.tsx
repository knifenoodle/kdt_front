'use client';

/**
 * 완성 보상 연출 3종 — mockup-v1.html:1881-2072(`fxParty`/`fxPool`/`fxPound`) 이식.
 *
 * 무지개떡 6층을 채우면 재생되며, 매번 다른 연출이 순환한다(`nextRewardKind`).
 * 캐릭터는 이미 이식된 SVG 에셋(`Character`)을 그대로 재사용 — 목업의 pool 전용
 * 축약 SVG(svgKkultteok 등)를 별도로 옮기지 않는다(중복 자산 방지).
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Character } from './Character';
import { sfx } from '@/audio/sfx';
import type { RewardKind } from '@/lib/progress';
import styles from './RewardParty.module.css';

interface Props {
  kind: RewardKind;
}

interface Burst {
  id: number;
  left: number;
  top: number;
}

const POOL_CAST = ['kkultteok', 'songpyeon-green', 'injeolmi', 'sirutteok'] as const;
const SPARK_COUNT = 12;

let burstSeq = 0;

export function RewardParty({ kind }: Props) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const timers = useRef<number[]>([]);
  const loopRef = useRef<number | null>(null);

  useEffect(() => {
    const spawnBurst = (left: number, top: number) => {
      const id = burstSeq++;
      setBursts((b) => [...b, { id, left, top }]);
      timers.current.push(
        window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1300),
      );
    };

    if (kind === 'party') {
      sfx.party();
      [1200, 1900, 2700, 3600].forEach((ms) => {
        timers.current.push(
          window.setTimeout(() => spawnBurst(18 + Math.random() * 64, 16 + Math.random() * 30), ms),
        );
      });
      loopRef.current = window.setInterval(
        () => spawnBurst(14 + Math.random() * 72, 14 + Math.random() * 32),
        2600,
      );
    } else if (kind === 'pool') {
      sfx.splash();
    } else if (kind === 'pound') {
      sfx.pound();
      for (let n = 0; n < 4; n++) {
        timers.current.push(
          window.setTimeout(() => spawnBurst(60 + Math.random() * 8, 43 + Math.random() * 5), 250 + n * 900),
        );
      }
    }

    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
      if (loopRef.current) window.clearInterval(loopRef.current);
    };
  }, [kind]);

  return (
    <div className={styles.stage} aria-hidden>
      {kind === 'party' && (
        <>
          <div className={styles.pot}>
            <Character id="honeypot" state="idle" size={110} />
          </div>
          <div className={styles.rain}>
            {Array.from({ length: 14 }, (_, i) => (
              <span
                key={i}
                className={styles.drop}
                style={{
                  left: `${(i * 7.3) % 100}%`,
                  animationDelay: `${(i * 0.21) % 2.4}s`,
                  animationDuration: `${1.7 + (i % 5) * 0.3}s`,
                }}
              />
            ))}
          </div>
        </>
      )}

      {kind === 'pool' && (
        <div className={styles.pool}>
          <div className={styles.wave} />
          <div className={styles.swimmers}>
            {POOL_CAST.map((c, i) => (
              <div
                key={c}
                className={styles.swimmer}
                style={{ left: `${6 + i * 25}%`, animationDelay: `${i * 0.45}s` }}
              >
                <Character id={c} state="idle" emo="joy" size={90} />
              </div>
            ))}
          </div>
        </div>
      )}

      {kind === 'pound' && (
        <div className={styles.pounder}>
          <Character id="injeolmi" state="idle" emo="joy" size={140} />
        </div>
      )}

      <div className={styles.fx}>
        {bursts.map((b) => (
          <span key={b.id} className={styles.burst} style={{ left: `${b.left}%`, top: `${b.top}%` }}>
            {Array.from({ length: SPARK_COUNT }, (_, i) => {
              const angle = (Math.PI * 2 * i) / SPARK_COUNT;
              const radius = 70 + (i % 3) * 22;
              const style = {
                '--dx': `${(Math.cos(angle) * radius).toFixed(1)}px`,
                '--dy': `${(Math.sin(angle) * radius).toFixed(1)}px`,
                animationDelay: `${(i % 4) * 0.03}s`,
              } as CSSProperties;
              return <i key={i} className={styles.spark} style={style} />;
            })}
          </span>
        ))}
      </div>
    </div>
  );
}
