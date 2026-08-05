'use client';

/**
 * 무지개떡 6층 누적 진행률 — mockup-v1.html:1858-1878, `svgRainbow()` 이식.
 *
 * 점수·순위가 아니다(S12) — 층 수는 고정 6, 색·순서는 항상 같다. 그날 완주했다는
 * 사실 하나만 보여주는 장식이며, 진행률 자체가 확률·희소성을 갖지 않는다.
 */

import { RAINBOW_LAYERS, HONEY_COAT_PATH, HONEY_COAT_FILL, HONEY_COAT_SHEEN } from '@/assets/rainbow';
import styles from './RainbowCake.module.css';

interface Props {
  /** 0~6, 채워진 층 수 */
  filled: number;
  /** 방금 채워진 층 인덱스 — pop 연출 대상 */
  justFilled?: number | null;
  /** 6층 완성 — 꿀 코팅 (꿀파티·꿀수영장) */
  coated?: boolean;
  /** 6층 완성 — 광택 (떡메치기. 코팅과 동시에 쓰지 않는다) */
  glossy?: boolean;
}

export function RainbowCake({ filled, justFilled, coated, glossy }: Props) {
  return (
    <div className={[styles.cake, glossy ? styles.glossy : ''].filter(Boolean).join(' ')} aria-hidden>
      <svg viewBox="0 0 240 240">
        <ellipse cx="120" cy="222" rx="92" ry="12" fill="var(--ink-soft)" opacity=".14" />
        {RAINBOW_LAYERS.map((layer, i) => (
          <rect
            key={i}
            x={layer.x}
            y={layer.y}
            width={layer.width}
            height={25}
            rx={11}
            fill={layer.color}
            className={[
              styles.layer,
              i < filled ? styles.fill : '',
              i === justFilled ? styles.pop : '',
            ].filter(Boolean).join(' ')}
          />
        ))}
        {coated && (
          <g className={styles.honeyCoat}>
            <path fill={HONEY_COAT_FILL} opacity=".92" d={HONEY_COAT_PATH} />
            <ellipse cx="102" cy="59" rx="28" ry="6" fill={HONEY_COAT_SHEEN} opacity=".6" />
          </g>
        )}
      </svg>
    </div>
  );
}
