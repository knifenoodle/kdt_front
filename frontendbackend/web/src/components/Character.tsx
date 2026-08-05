'use client';

/**
 * 캐릭터 — 기능 상태(data-state)와 감정(data-emo)이 **서로 다른 축**이다.
 * 말하면서 슬플 수 있어야 하므로 두 축을 겹쳐서 표현한다(uiux기획/CLAUDE.md:83-95).
 *
 * SVG 를 인라인으로 넣는 이유: 표정이 SVG **내부** 클래스의 CSS display 토글로
 * 설계되어 있다. <img> 로는 외부 CSS 가 내부에 닿지 못해 표정이 바뀌지 않는다.
 *
 * 🚨 불변식 S1 — 파트너(송편)의 감정은 아이 발화 평가에 바인딩되지 않는다.
 * mockup-v1.html:1609-1613:
 *   "송편은 상황에 반응한다. 아이의 발화에는 반응하지 않는다.
 *    … 아이는 예외 없이 그것을 '내 대답에 대한 채점'으로 읽는다"
 * 이 컴포넌트는 emo 를 prop 으로 받을 뿐이며, 그 값이 어디서 오는지는
 * 호출부의 책임이다. check-safety-rules.mjs 가 respond() 계열에서
 * 파트너 대상 감정 설정이 0건임을 검사한다.
 */

import { CHARACTER_SVG, CHARACTER_NAME } from '@/assets/characters';
import type { Emotion } from '@/lib/api';
import styles from './Character.module.css';

export type CharState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'canthear';

interface Props {
  /** 에셋 id (파일명 stem). 파트너는 songpyeon-green 스킨을 쓴다 */
  id: string;
  state: CharState;
  emo?: Emotion | null;
  /** 감정 부속(눈물·땀·반짝)을 억제한다. 전이 중 깜빡임을 숨기는 용도 */
  soft?: boolean;
  size?: number;
}

export function Character({ id, state, emo, soft, size = 220 }: Props) {
  const svg = CHARACTER_SVG[id] ?? CHARACTER_SVG['songpyeon-green'];
  const baseId = id.split('-')[0];

  return (
    <div
      className={styles.character}
      style={{ width: size, height: size }}
      data-state={state}
      data-emo={emo ?? 'none'}
      data-emo-soft={soft ? '1' : undefined}
      role="img"
      aria-label={CHARACTER_NAME[baseId] ?? baseId}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
