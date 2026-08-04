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
 */

import { useEffect, useState } from 'react';
import { fetchHealth, fetchSession, type Category, type SessionScript } from '@/lib/api';
import { resolveSession } from '@/audio/lines';

const CATEGORIES: Category[] = ['ownership_turn', 'physical_boundary', 'verbal_discomfort', 'rule_violation'];

export default function DevHarness() {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [out, setOut] = useState<string>('');

  useEffect(() => {
    fetchHealth().then(setHealth).catch((e) => setOut(String(e)));
  }, []);

  async function run(category: Category) {
    setOut('요청 중…');
    const t0 = performance.now();
    try {
      const sc: SessionScript = await fetchSession({ category });
      const r = resolveSession(sc);
      setOut(
        JSON.stringify(
          {
            elapsed_ms: Math.round(performance.now() - t0),
            source: sc.source,
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
      <pre style={{ whiteSpace: 'pre-wrap' }}>{out}</pre>
    </main>
  );
}
