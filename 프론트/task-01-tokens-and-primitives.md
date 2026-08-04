# Task 01 — 디자인 토큰 + 기본 컴포넌트 3종

`CLAUDE.md` 를 먼저 읽어라. 아래 지시와 충돌하면 `CLAUDE.md` 가 우선이다.

## 목표

이 작업에서는 **토큰과 원시 컴포넌트만** 만든다. 화면(Talk/Listening/Reward)은
Task 02에서 한다. 화면을 미리 만들지 마라.

## 만들 것

### 1. `src/tokens/`

| 파일 | 내용 |
|---|---|
| `color.ts` | `CLAUDE.md` 3절의 팔레트. 역할 이름으로만 export (`bg`, `action`, `ink` …). `blue`, `gray` 같은 색 이름 금지 |
| `type.ts` | 3단계면 충분: `voice`(캐릭터 대사, 28), `label`(버튼, 22), `parent`(보호자 화면, 14). 각각 lineHeight 포함 |
| `space.ts` | 4의 배수 스케일. 인접 조작 요소 간격 상수 `TOUCH_GAP = 16` 포함 |
| `size.ts` | `TAP_MIN = 76`, `TAP_PRIMARY = 88`, `TAP_PARENT = 56` |
| `motion.ts` | duration 3개(`instant` 100, `normal` 220, `slow` 400)와 easing. `reduceMotion` 대응 헬퍼 포함 |
| `index.ts` | 배럴 export |

전부 `as const`. 타입은 토큰에서 추론해서 뽑아라 (`type ColorToken = keyof typeof color`).

### 2. `src/components/Tap.tsx`

아이 화면의 **유일한** 터치 원시 컴포넌트.

```ts
type TapProps = {
  onPress: () => void
  size?: 'min' | 'primary'      // 기본 'min'
  label: string                  // 접근성 + TTS 재생용. 화면에 글자로 안 나올 수 있음
  children: ReactNode
  disabled?: boolean
}
```

동작:
- 최소 크기를 토큰에서 강제. props로 더 작게 만들 수 없어야 한다
- 누름: 100ms 내 `translateY` + 그림자 제거. `useNativeDriver: true`
- 누름과 동시에 `sfx.tap()` 호출 (오디오 모듈은 아직 스텁이어도 된다)
- `accessibilityRole="button"`, `accessibilityLabel={label}`
- `onLongPress` 를 노출하지 않는다. 타입에 아예 없어야 한다
- `disabled` 는 회색 처리하지 않는다 — 투명도 0.5 + 터치 무시

### 3. `src/components/MicButton.tsx`

Voice-First의 중심. 화면에서 가장 큰 요소.

- 상태: `idle | listening | disabled`
- `idle`: `action` 색 원형, 지름 `TAP_PRIMARY * 1.6`, 느린 맥동(2초 주기)
- `listening`: 바깥으로 퍼지는 링 2개(엇갈린 딜레이), 마이크 아이콘 유지
- 탭 → `onStart` / 다시 탭 → `onStop`. **누르고 있기(push-to-talk) 방식 금지** —
  이 나이는 누른 상태를 유지하지 못한다
- 15초가 지나면 자동으로 `onStop` 호출

### 4. `src/components/ParentGate.tsx`

- 두 자리 덧셈을 **매번 난수 생성** (`a`,`b` 각각 10~29, 답 4지선다, 오답은 답±1, ±10 계열)
- 오답 선택 시: 화면 흔들림 없이 조용히 문제만 새로 생성. 실패 카운트 노출 안 함
- 애니메이션·사운드 없음. `CLAUDE.md` 5절대로 의도적으로 밋밋하게
- 성공 시 `onUnlock()` 호출. 세션 내 재잠금 정책은 props로 (`relockAfterMs`, 기본 5분)

### 5. `scripts/check-ui-rules.mjs` + `package.json` 의 `check:ui`

`CLAUDE.md` 7절의 4개 검사를 구현. 위반 시 파일·라인과 함께 exit 1.
지금은 화면 파일이 없으므로 `src/components` 대상으로 돌아가면 된다.

### 6. 테스트

`Tap`, `ParentGate` 만. 각 3케이스 이내.
- `Tap`: 렌더된 크기가 76 이상 / `accessibilityLabel` 전달 / disabled 시 onPress 미호출
- `ParentGate`: 정답 시 onUnlock 1회 / 오답 시 onUnlock 미호출 + 문제 변경

## 완료 조건

아래가 전부 통과해야 끝이다. 하나라도 실패하면 고치고 다시 돌려라.

```bash
npx tsc --noEmit
npm test
npm run check:ui
```

## 진행 방식

1. 먼저 **plan mode로 파일 목록과 각 파일의 export 시그니처만** 제시하고 멈춰라.
   내가 승인하면 구현에 들어간다.
2. 구현 중 `CLAUDE.md` 의 규칙과 충돌하는 지점을 발견하면, 임의로 우회하지 말고
   **어떤 규칙이 왜 걸리는지 말하고 멈춰라.**
3. 완료 후에는 요약 대신 **위 3개 명령의 실제 출력**을 붙여라.

## 하지 말 것

- 화면(screen) 파일 생성
- 색·크기 리터럴을 컴포넌트에 하드코딩
- 라이브러리 추가 (`CLAUDE.md` 0절에 없는 것)
- "준비되었습니다" 류의 서두. 바로 plan을 내라
