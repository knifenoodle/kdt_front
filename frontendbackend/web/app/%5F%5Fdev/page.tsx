'use client';

/**
 * 개발 하네스 — 제품 경로가 아니다.
 *
 * 카테고리 선택이 여기에만 있는 이유: 아이는 오늘 주제를 고르지 않는다.
 * uiux기획/CLAUDE.md:47(글자 없이 작동)·:54(한 화면 한 행동), 그리고
 * mockup-v1.html:768 의 "오늘은 싫다고 말하기"는 통보형이다.
 * 제품에서는 카테고리 선택이 보호자 게이트 뒤로 간다.
 *
 * 🚨 오류 문자열이 표시되는 유일한 화면이다. 아이 화면에는 도달하지 않는다.
 *
 * 🚨 H10(docs/10_UIUX_리뷰.md) 수정 — 이 하네스는 `parent_meta`(학습목표·갈등트리거 등
 * "아이 화면 노출 금지" 필드, `lib/api.ts` 참조)를 인증 없이 그대로 렌더한다. 프로덕션
 * 빌드에서는 라우트 자체를 제외한다 — `NODE_ENV`는 Next.js 빌드 시 리터럴로 치환되므로
 * 프로덕션 번들에서는 이 분기 이후 코드가 데드코드로 제거된다.
 */

import { notFound } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchHealth, fetchSession, type Category, type Level, type SessionScript, type Variation } from '@/lib/api';
import { resolveSession } from '@/audio/lines';

const CATEGORIES: Category[] = ['ownership_turn', 'physical_boundary', 'verbal_discomfort', 'rule_violation'];

// 레벨시스템 v1.2 §2-3 — 거절(ownership_turn) 스킬 9종 QA용. 제품 경로 아님.
const LEVELS: Level[] = ['1', '2', '3'];
const VARIATIONS: Variation[] = ['1', '2', '3'];

export default function DevHarness() {
  if (process.env.NODE_ENV === 'production') notFound();

  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [out, setOut] = useState<string>('');

  useEffect(() => {
    fetchHealth().then(setHealth).catch((e) => setOut(String(e)));
  }, []);

  async function run(category: Category, level?: Level, variation?: Variation) {
    setOut('요청 중…');
    const t0 = performance.now();
    try {
      const sc: SessionScript = await fetchSession({ category, level, variation });
      const r = resolveSession(sc);
      setOut(
        JSON.stringify(
          {
            elapsed_ms: Math.round(performance.now() - t0),
            source: sc.source,
            level: sc.level,
            variation: sc.variation,
            turn0_ask: sc.turns[0].ask.t,
            emotion_track: sc.turns.map((t) => [t.emo, t.back_emo]),
            sanitize_blocked: r.blocked,
            parent_meta: sc.parent_meta,
          },
          null,
          2,
        ),
      );
    } catch (e) {
      setOut(`실패: ${String(e)}`);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'monospace', fontSize: 13 }}>
      <h1 style={{ fontSize: 18 }}>/__dev — 개발 하네스 (제품 경로 아님)</h1>

      <h2 style={{ fontSize: 15 }}>/api/health</h2>
      <pre>{health ? JSON.stringify(health, null, 2) : '…'}</pre>

      <h2 style={{ fontSize: 15 }}>/api/session</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => run(c)} style={{ minHeight: 32, padding: '4px 10px' }}>
            {c}
          </button>
        ))}
      </div>
      <h2 style={{ fontSize: 15 }}>레벨×변이 9종 (거절/ownership_turn, 레벨시스템 v1.2 §2-3)</h2>
      {LEVELS.map((level) => (
        <div key={level} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          {VARIATIONS.map((variation) => (
            <button
              key={`${level}-${variation}`}
              onClick={() => run('ownership_turn', level, variation)}
              style={{ minHeight: 32, padding: '4px 10px' }}
            >
              L{level}V{variation}
            </button>
          ))}
        </div>
      ))}

      <pre style={{ whiteSpace: 'pre-wrap' }}>{out}</pre>
    </main>
  );
}
