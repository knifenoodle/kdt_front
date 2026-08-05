'use client';

/**
 * 배경 씬 — mockup-v1.html:1134-1424 이식(`web/src/assets/scenes`).
 *
 * 캐릭터 뒤에 깔리는 장식일 뿐이다. 조작 요소가 아니므로 규칙 1~3(터치 타깃·간격·
 * 단일 탭) 대상이 아니고, 글자도 담지 않는다(규칙 4 무관 — 정보가 아니라 장소감이다).
 */

import { SCENE_SVG } from '@/assets/scenes';
import type { Scene as SceneId } from '@/lib/api';
import styles from './Scene.module.css';

interface Props {
  id: SceneId;
}

export function Scene({ id }: Props) {
  const svg = SCENE_SVG[id] ?? SCENE_SVG.kids;
  return (
    <div className={styles.scene} aria-hidden dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
