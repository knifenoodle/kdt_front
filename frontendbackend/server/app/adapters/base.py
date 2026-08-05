"""SessionScriptAdapter 인터페이스.

교체 지점이 **서버에** 있는 이유: 프런트에 두면 (b) backend_session 으로 갈 때
프런트를 다시 뜯어야 하고, "아이가 들을 문장을 조립하는 로직"이 브라우저에 노출된다.

  1단계  template_deck    저작 3턴 데크 + 백엔드 값 주입          ← 현재
  Phase2 derived          백엔드 산문에서 턴 파생
  Phase3 backend_session  백엔드가 턴 트리 직접 생성

🚨 backend_session 전환 선행조건 4건 (docs/01 §5). 하나라도 빠지면 아동 안전 회귀다:
  1. validator.py:29-30 _flatten_text 재귀화 — 현재 top-level str 만 스캔하므로
     중첩 턴 트리를 추가하면 아이가 듣는 15줄 전부에 금칙어 스캔이 돌지 않는다
  2. _REQUIRED_OUTPUT_FIELDS 턴 트리까지 확장 (현재 6개 고정)
  3. 규칙 6(오답 페널티 금지) 위반 검사 신설 — validator 에 항목 자체가 없다
  4. validator.py:71-73 fail-open 재결정 — GDL-002 카테고리 위반이 통과한다
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from ..schemas import SessionRequest, SessionScript


class SessionScriptAdapter(ABC):
    name: str

    @abstractmethod
    def build(self, req: SessionRequest) -> SessionScript:
        """SessionScript 를 반환한다.

        🚨 계약: **절대 예외를 던지지 않는다.**
        백엔드가 키 부재로 500 을 내든, 빈 배열을 주든, 미지 카테고리로 헛돌든,
        저작 폴백 데크로 세션을 완성해 반환한다. 사유는 source.fallback_reason 에만 남는다.
        아이 화면은 백엔드 실패를 인지할 수 없어야 한다 — 1단계 합격선이다.
        """
        raise NotImplementedError
