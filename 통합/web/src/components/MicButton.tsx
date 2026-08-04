'use client';

/**
 * 마이크 버튼.
 *
 * 🚨 1단계에서는 **렌더하되 비활성**이다 (결정 D2).
 * STT 를 제외하면 아동 음성이 기기를 떠나지 않으므로 만 14세 미만
 * 법정대리인 동의 체계(LEGAL-003-R1) 리스크가 1단계에서 0 이 된다.
 * 백엔드에 동의 저장소·보호자 계정·로깅이 전무해 동의 사실을 기록할 곳조차 없다.
 *
 * 활성화 전 선행조건 (compliance/CHILD-SAFETY-GATES.md G2-1~G2-4):
 *   보호자 동의 플로우 · 처리방침/국외이전 고지 · STT 벤더 위탁 계약 ·
 *   보관/삭제 절차 · 위험 발화 에스컬레이션 분기(classifyChildUtterance)
 *
 * 비활성 표현은 회색이 아니라 **투명도**다 — 회색은 아이 화면 면적색으로 쓰지 않는다.
 */

import { Tap } from './Tap';

interface Props {
  onSpeak: () => void;
  /** 1단계 기본값 true */
  disabled?: boolean;
  listening?: boolean;
}

export function MicButton({ onSpeak, disabled = true, listening = false }: Props) {
  return (
    <Tap
      primary
      disabled={disabled}
      onTap={onSpeak}
      label={listening ? '듣는 중' : '말하기'}
    >
      <span aria-hidden>{listening ? '🔴' : '🎤'}</span>
    </Tap>
  );
}
