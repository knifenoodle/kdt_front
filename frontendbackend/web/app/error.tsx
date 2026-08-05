'use client';

/**
 * 🚨 H9(docs/10_UIUX_리뷰.md) 수정 — 렌더 예외 시 Next.js 기본 오류 페이지(영어, 빨강
 * 계열)가 아니라 이 프로젝트의 캐릭터·톤을 그대로 쓴다. 오류 원문은 서버/브라우저
 * 콘솔에만 남긴다 — 아이 화면에는 문자열을 노출하지 않는다(S3, 규칙 6).
 */

import { useEffect } from 'react';
import { Character } from '@/components/Character';
import { Tap } from '@/components/Tap';
import { LINES } from '@/audio/lines';
import { PARTNER_SKIN } from '@/assets/characters';
import styles from './error.module.css';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={styles.wrap}>
      <Character id={PARTNER_SKIN} state="canthear" size={220} />
      <p className={`${styles.text} txt`}>{LINES.appHiccup.t}</p>
      <Tap primary onTap={reset} label="다시 시작">
        <span aria-hidden>🔁</span>
      </Tap>
    </main>
  );
}
