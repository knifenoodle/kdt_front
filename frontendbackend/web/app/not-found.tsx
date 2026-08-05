'use client';

/**
 * 🚨 H9(docs/10_UIUX_리뷰.md) 수정 — 존재하지 않는 경로 접근 시 Next.js 기본 404
 * (영어, 빨강 계열)가 아니라 이 프로젝트의 캐릭터·톤을 그대로 쓴다. 아이 화면에
 * 오류 색 자체가 없다(uiux기획/CLAUDE.md:81).
 */

import { useRouter } from 'next/navigation';
import { Character } from '@/components/Character';
import { Tap } from '@/components/Tap';
import { LINES } from '@/audio/lines';
import { PARTNER_SKIN } from '@/assets/characters';
import styles from './error.module.css';

export default function NotFound() {
  const router = useRouter();
  return (
    <main className={styles.wrap}>
      <Character id={PARTNER_SKIN} state="canthear" size={220} />
      <p className={`${styles.text} txt`}>{LINES.notFound.t}</p>
      <Tap primary onTap={() => router.push('/')} label="처음으로">
        <span aria-hidden>🏠</span>
      </Tap>
    </main>
  );
}
