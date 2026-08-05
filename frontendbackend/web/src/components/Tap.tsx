'use client';

/**
 * 아이 화면의 유일한 조작 원시 요소.
 *
 * 🚨 아이 화면에서 `<button>` / `onClick` 을 직접 쓰지 않는다. 전부 이 컴포넌트를 경유한다
 * (uiux기획/CLAUDE.md:120, 검사 S7). 이유: 절대 규칙 1·2·3·5 를 한 곳에서 강제하기 위해서다.
 *
 *   규칙 1  최소 76×76, 주 행동 88 이상
 *   규칙 2  인접 조작 요소 간격 최소 16
 *   규칙 3  단일 탭만 — 드래그·스와이프·핀치·롱프레스·더블탭 금지
 *   규칙 5  100ms 내 시각(눌림 깊이) + 청각(짧은 톤) 응답. 네트워크 대기 중에도 로컬 반응이 먼저
 */

import { useCallback, useRef, type ReactNode } from 'react';
import { sfx } from '@/audio/sfx';
import styles from './Tap.module.css';

interface Props {
  onTap: () => void;
  children: ReactNode;
  /** 주 행동(마이크·다음·시작)은 88 이상 */
  primary?: boolean;
  /** 보호자 화면 전용 56. 아이 화면에서 쓰면 안 된다 */
  parent?: boolean;
  disabled?: boolean;
  /** 글자 없이 작동해야 하므로(규칙 4) 스크린리더 라벨은 필수다 */
  label: string;
}

export function Tap({ onTap, children, primary, parent, disabled, label }: Props) {
  const busy = useRef(false);

  const handle = useCallback(() => {
    if (disabled) return;
    // 연타 방지 — 아이는 반복 탭한다. 100ms 안에 두 번 발화하지 않게 한다.
    if (busy.current) return;
    busy.current = true;
    window.setTimeout(() => (busy.current = false), 250);

    sfx.tap();          // 청각 응답이 먼저 나간다 (규칙 5)
    onTap();
  }, [onTap, disabled]);

  const cls = [
    styles.tap,
    primary ? styles.primary : '',
    parent ? styles.parent : '',
    disabled ? styles.disabled : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={cls}
      onClick={handle}
      aria-label={label}
      aria-disabled={disabled}
      // 🚨 제스처 핸들러를 여기에 추가하지 말 것 (규칙 3).
      // onDoubleClick / onPointerMove / draggable / touchmove 전부 금지이며
      // check-safety-rules.mjs 가 부재를 검사한다.
      draggable={false}
    >
      {children}
    </button>
  );
}
