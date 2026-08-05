# UI/UX 리뷰 — 프론트엔드 구현 대 문서·목업

**결론 먼저**: 지금 화면에서는 **의사소통 연습이 일어나지 않는다.** 아이는 이야기를 듣고
버튼을 3번 누르고 떡 한 층을 받는다. 무슨 말을 해야 하는지 듣지 못하고(H1), 유일하게
항상 켜져 있어야 할 "다시 듣기"는 반복이 아니라 **건너뛰기**로 작동하며(H2), 입을 한 번도
열지 않아도 세션이 완주된다. 서비스의 핵심 가치는 `백엔드/Communication_simulator/README.md:27`가
**"'싫다'는 말이 입 밖으로 나오기까지 필요한 실전 연습 횟수"**라고 못박았는데, 현재 UI는
그 횟수를 0으로 만든다.

이 결함들은 STT·보호자 동의 게이트(G2-1~4)와 **무관하다** — 지금 당장 코드만으로
고칠 수 있는 범주다. 이 문서는 코드를 수정하지 않는다(요청 범위 밖). 대신 근거·재현
방법·수정 방향을 표준 포맷으로 남긴다.

---

## 0. 범위와 판정 기준

**대상**: 아이가 실제로 보는 화면(`web/src/screens/*`, `web/src/components/*`) +
개발자 하네스(`/__dev`) + 문서에 정의됐지만 아직 없는 화면.

**"어긋난다"의 기준**은 이 저장소가 스스로 정한 문서 위계를 그대로 따른다
(`frontendbackend/CLAUDE.md:19`):

```
프론트/CLAUDE.md > 캐릭터_가이드_v1.md > 캐릭터연출_기획_v1.md   (아동 안전·연출·문구)
mockup-v1.html                                                  (시각 회귀 기준 — docs/07:64
                                                                   "이 프로젝트에서 아동 안전이
                                                                   가장 잘 검증된 자산")
LEGAL/GOV/ETH/GDL 자사 규칙                                      (규제 근거)
```

**검증 수단** — 서술이 아니라 전부 재현 가능한 방법으로 확인했다:

1. **빌드된 CSS 실측** (`web/.next/static/css/*.css`) — 소스가 아니라 실제로 배포되는 것
2. **실행 중인 서버에 `curl`** — 서버가 실제로 주는 값과 화면이 실제로 말하는 값을 대조
3. **Puppeteer 브라우저 실측** — 뷰포트별 버튼 좌표, TTS 스텁 후 `다시 듣기` 반복 탭
4. **적대적 재검증** — 초기 발견 7건을 별도 에이전트가 반증 목표로 재검사. 결과 3건은
   수정·축소, 1건은 신규 발견(H2) 추가로 이어졌다. 이 문서에 실린 값은 **전부 이 과정을
   통과한 것**이다.

리스크 보고는 `frontendbackend/CLAUDE.md:29-61`의 표준 포맷을 따르되, High만 근거·재현·영향을
풀어 쓰고 Med·Low는 표로 축약했다.

---

## 1. 서비스 목적·타겟 요약

- **대상**: 만 4~6세 미취학, 페르소나 만 5세(`compliance/DECISIONS.md:19`). **전제 하나**:
  "아이는 글자를 읽지 못한다"(`프론트/CLAUDE.md:4`).
- **목적**: AI 캐릭터와 소리로 롤플레잉하며 거절·경계 표현을 반복 연습(`README.md:1-4`).
  가치의 핵심은 "말이 입 밖으로 나오기까지 필요한 **실전 연습 횟수**를 제공"하는 것
  (`백엔드/README.md:27`) — 판정이나 정답 공개가 아니라 **반복**이다.
- **절대 규칙 9개** 중 이 리뷰와 직결되는 것: 규칙 4(글자 없이 작동), 규칙 5(100ms 내
  시각+청각 응답), 규칙 7(세션은 끝난다 → 보상 → 종료 안내), 규칙 8(스크롤 없음),
  규칙 9(문자열은 `lines.ts`에만).
- **안전 불변식 S1**(최상위): 캐릭터 감정은 아이 발화 평가에 바인딩되지 않는다.

---

## 2. 🔴 High — 타겟/목적 적합성을 직접 해치는 것

### H1 — 송편의 `hint`가 한 번도 재생되지 않는다

```
심각도   : HIGH
분류     : [1] 배포 코드
영역     : 유해성·안전(학습 목표 무력화)
근거     : web/src/screens/Talk.tsx:105-128 (ask 이펙트) · server/app/deck/ownership_turn.json
           (turn0.hint = "\"안 돼\" 하고 말해볼까?") · mockup-v1.html:1735-1750
자사규칙 : GDL-001-R5 (연습할 표현은 2~5글자 한 마디로 설계)
현상     : 데크에는 턴마다 "아이가 뭐라고 말하면 되는지" 알려주는 hint가 있다
           (turn0 "\"안 돼\" 하고 말해볼까?" · turn1 "싫으면 다시 한 번 말해도 괜찮아." ·
           turn2 "같이 놀고 싶으면 \"좋아\"라고 해봐."). 목업 askTurn()은
           ask → hint → 대기 순인데, 구현은 ask 직후 바로 waitForChild로 간다.
재현     : node scripts/capture-full-session.mjs 3000 실행 후 turn0 로그와
           서버 응답의 turns[0].hint.t를 대조 — 화면 로그에 hint가 없다.
영향     : 글자를 못 읽는 아이가 무슨 말을 해야 하는지 듣지 못한 채 "말했어요"를 누른다.
           지원 사다리(hint→sup1→sup2 "함께 말하기", session-machine.ts의 retry()/
           supportSlot())도 UI에서 호출되지 않아 전부 죽은 코드다(docs/07:19가 이미
           "미배선"으로 기록). 목업의 nudgeSoon(대기 유도, mockup:1667-1677)도 함께
           빠져 대기가 길어져도 아무 신호가 없다.
완화     : 없음
완화붕괴 : 해당 없음
필요조치 : ask 이펙트에서 hint를 이어서 재생한 뒤 waitForChild로 전이. sup1/sup2는
           retry() 배선까지 포함하면 완전 복구.
게이트   : G1 (STT·동의와 무관 — 지금 고칠 수 있다)
상태     : 미착수
```

### H2 — "다시 듣기"가 반복이 아니라 건너뛰기다 (실측 확인)

```
심각도   : CRITICAL
분류     : [1] 배포 코드
영역     : 유해성·안전 / 사용성 붕괴
근거     : web/src/audio/speak.ts:44-63 (speak() → shutUp() → cancel() → onend/onerror
           둘 다 onEnd() 호출) · web/src/screens/Talk.tsx:163-165 (replay())
자사규칙 : 프론트/CLAUDE.md:130 "다시 듣기 버튼은 항상 화면에 있다"
현상     : replay()는 speak(bubble.t)만 호출하고 onEnd 콜백을 넘기지 않는다. 그런데
           speak() 내부에서 새 발화 전 shutUp()이 진행 중이던 발화를 취소하고,
           그 취소가 onend/onerror를 발화시켜(둘 다 onEnd?.() 호출) 그 발화에
           연결돼 있던 원래 콜백 체인이 실행된다. 즉 "다시 듣기"를 누르면 현재
           대사를 다시 듣는 게 아니라 다음 대사로 넘어간다.
재현     : Puppeteer로 TTS를 스텁(onend를 즉시 발화)하고 "시작하기" → "다시 듣기"를
           4회 연속 탭. 실측 로그:
             1) 시작 직후 : "나는 컴퓨터가 만든 친구야…" (AI 고지)
             2) 다시듣기×1: "시루떡이 네 장난감을 가져가려고 해…" (인트로로 건너뜀)
             3) 다시듣기×2: "먼저 내가 어떻게 말하는지 보여줄게…" (시범 예고로 건너뜀)
             4) 다시듣기×3: "그거 나 줘. 지금 당장!" (시범 1번째 줄로 건너뜀)
             5) 다시듣기×4: "안 돼. 이건 내가 쓰고 있어." (시범 2번째 줄로 건너뜀)
           4번의 탭으로 AI 고지 → 인트로 → 시범 예고 → 시범 2줄까지 전부 건너뛰었다.
영향     : "다시 듣기"는 유일하게 항상 존재해야 하는 안전판인데(규칙 "지시를 한 번만
           들려주지 않기"), 실제로는 정반대 — 누를수록 지시를 더 못 듣게 된다.
           호기심 많은 아이가 몇 번 누르면 인트로·시범 전체를 건너뛰고 갑자기
           대기 화면에 도달할 수 있다. 목업은 replay()에서 clearTimers(); shutUp();
           후 askTurn()/runDemo()를 처음부터 결정론적으로 재시작해 이 문제 자체가
           없었다(mockup:1752-1758).
완화     : 없음
완화붕괴 : 해당 없음
필요조치 : speak()에 세대(generation) 카운터나 래치를 둬서, cancel로 인한 onend가
           의도된 완료와 구분되게 한다. 최소 수정: replay()가 현재 재생 중인
           콜백 체인을 이어가지 않도록 별도 경로로 분리.
게이트   : G1
상태     : 미착수 · 적대적 재검증에서 신규 발견(원 계획엔 없었음)
```

### H3 — 서버가 만든 상황 설명이 아이에게 도달하지 않는다

```
심각도   : HIGH
분류     : [1] 배포 코드
근거     : web/src/screens/Talk.tsx:39-91 — start()가 useCallback(…, [prefetch, resolved, say])로
           그 시점의 resolved를 클로저에 담근다. 세션 1은 초기값이 null(:44)이고, 세션
           2 이후는 handleReplay()가 setResolved(null)과 setScreen('start')를 같은
           배치로 실행한다(:171-184) — 즉 start 화면은 resolved가 채워진 채로 렌더될
           수 있는 경로가 구조적으로 없다.
현상     : 실측 — 서버는 intro로 "너는 지금 빨간 자동차를 가지고 놀고 있어…"를
           반환하고 backend_fields_used에 background가 있는데, 아이는 항상 정적
           폴백 "시루떡이 네 장난감을 가져가려고 해…"를 듣는다.
재현     : curl -s -X POST http://127.0.0.1:8100/api/session \
             -H 'Content-Type: application/json' \
             -d '{"category":"ownership_turn","age_band":"5","scene":"kids"}' \
             | python3 -c "import sys,json;print(json.load(sys.stdin)['lines']['intro']['t'])"
           → web/src/audio/lines.ts의 FALLBACK_DECK.intro와 값이 다름을 확인.
영향     : turns[0].ask는 이펙트에서 매번 새로 resolved를 읽으므로(정상 동작)
           LLM이 만든 "그 빨간 자동차 나 줘" 같은 요구가 실제로 재생된다. 하지만
           인트로는 "장난감"이라는 일반 명사만 언급한 정적 문장이다 — 즉 아이는
           "네 장난감을 지킨다"는 안내를 듣고, 실제로는 (LLM이 뭘 만들었든) 다른
           구체 물건을 요구받는다. 롤플레잉의 전제(내가 지키려는 것 = 상대가
           요구하는 것)가 매 세션 어긋난다. 이것은 타이밍 경합이 아니라 구조적으로
           불가능한 상태다 — 어떤 네트워크 속도에서도 재현된다.
           참고: ai_disclosure/demo_in/demo[0..2]는 데크 값과 폴백 상수가 어차피
           바이트 단위로 동일해 실질적 영향이 없다. 실질적으로 매번 어긋나는 건
           intro 하나뿐이다.
완화     : 없음(있어 보이지만 없음 — docs/09:37은 "주입 자리"라고 신중하게 적어
           문서 자체는 오류를 주장하지 않는다)
완화붕괴 : 해당 없음
필요조치 : start()가 참조하는 lines를 prefetch 완료 후의 최신 상태로 바꾸거나,
           intro도 ask처럼 이펙트에서 서버 값이 도착한 뒤 재생하도록 구조 변경.
게이트   : G1
상태     : 미착수
```

### H4 — 보상 화면 음성이 그림과 어긋나고, 폴백 시 같은 문장을 두 번 듣는다

```
심각도   : HIGH
분류     : [1] 배포 코드 · [3] 통합이 신규 도입(무지개떡 누적은 68e860a에서 추가)
근거     : web/src/screens/Reward.tsx:41-77 · web/src/components/RainbowCake.tsx:40 ·
           web/src/lib/progress.ts:17-22
현상 A   : Reward 마운트 시 매번 "무지개떡을 다 모았어! 꿀파티다!"를 말하지만
           RainbowCake는 fillNextLayer()가 반환한 층수만큼만(1회차=1/6) 채운다.
           음성은 "다 모았다", 그림은 "1/6"이라고 말하는 셈이다. 6회차가 돼야
           그림과 말이 일치한다.
현상 B   : lines가 없을 때(서버 응답 실패, 또는 party 문구가 sanitizeForChild에
           걸릴 때) cheer와 party 둘 다 LINES.cheer.t로 대체되어(:46,:48) 같은
           칭찬 문장을 ~7초 간격으로 두 번 듣는다. (참고: 6회차 완성 보상 자체는
           cheer가 shutUp()에 잘려 실제로 두 번 들리지는 않는다 — 이 부분은
           적대적 재검증에서 반증되어 이 문서에는 신지 않는다.)
재현     : 서버 프로세스를 잠시 내린 채 세션 1회 완주 → 보상 화면에서 같은 문장
           반복 재생 확인.
영향     : 규칙 4(그림과 소리가 정보의 본체)가 정면으로 깨진다. 목업은 보상을
           "6층 완성 시에만" 발동시켰는데(캐릭터_가이드_v1.md:106), 통합
           과정에서 "3턴 완주 즉시 발동"으로 바뀌면서(docs/07:20,28) 이 모순이
           생겼다 — §5 상충 표 참조.
완화     : 없음
완화붕괴 : 해당 없음
필요조치 : 1~5회차엔 party 대신 "무지개떡이 한 층 더 쌓였어!" 류의 누적 전용
           문구를 신설. 폴백 시 cheer/party를 서로 다른 상수로 분리(현재 party
           폴백이 cheer와 동일한 게 근본 원인).
게이트   : G1
상태     : 미착수
```

### H5 — 배경 씬 10종이 전혀 보이지 않는다

```
심각도   : HIGH
분류     : [3] 통합이 신규 도입 — 08-05 커밋(68e860a)에서 내가 만든 회귀
근거     : web/src/components/Scene.module.css:1-7 (.scene{position:absolute;
           inset:0;z-index:-1}) vs web/src/screens/Talk.module.css:3-14
           (.start,.talk{position:relative;…;background:var(--bg)}, z-index 없음)
현상     : .talk은 position:relative만 있고 z-index:auto라 새 스택 컨텍스트를
           만들지 않는다. 따라서 CSS 2.1 Appendix E 순서상 .scene(음수 z)은
           루트 스택 컨텍스트의 2단계에서 그려지고, body와 .talk의 불투명
           배경(3단계, in-flow 블록 배경)이 그 위를 덮는다. 씬은 두 겹으로
           가려진다.
재현     : grep -oE '\.(Scene_scene|Talk_talk)[A-Za-z0-9_]*\{[^}]*\}' \
             web/.next/static/css/*.css
           docs/screenshots/10-turn0-ask.png, 04-talk-intro.png에서 배경이
           완전히 단색 #F4F1FB인 것으로 육안 확인됨(이미 저장소에 커밋된 증거).
영향     : SVG 20.8KB(페이지 청크 64.8KB의 1/3)가 매 세션 다운로드되지만
           한 픽셀도 그려지지 않는다. 부수 피해: 목업의 demo-mode 배경
           채도 감소(.scene{filter:saturate(.5)}, "시범은 턴이 아니다"라는
           비언어 신호, mockup:438)도 같이 죽어 있다 — 이식되지 않았다.
완화     : 없음
완화붕괴 : 해당 없음
필요조치 : .talk에 z-index:0(또는 isolation:isolate) 한 줄 추가로 해결.
게이트   : G1
상태     : 미착수 · 내가 만든 회귀
```

### H6 — TTS가 `onend`를 쏘지 않으면 세션이 영구 정지한다

```
심각도   : HIGH
분류     : [1] 배포 코드(이식 시 누락)
근거     : mockup-v1.html:1472-1486(speakTimer=setTimeout(fin, fallback+900) 워치독,
           speechSynthesis 유무와 무관하게 항상 무장) vs web/src/audio/speak.ts:44-63
           (워치독은 !window.speechSynthesis 분기에만 존재, :47-51)
현상     : speechSynthesis가 존재하지만 onend/onerror가 끝내 발화하지 않으면(iOS
           Safari에서 문서화된 동작 — 캡처 스크립트들이 TTS를 스텁하는 이유이기도
           하다) INTRO_DONE/DEMO_NEXT/ASK_DONE/RESPOND_DONE 중 어느 것도
           dispatch되지 않는다.
영향     : intro/demo/ask/respond 중 정지하면 복구 불가 — 유일하게 살아있는
           "다시 듣기"도 onEnd 콜백 없이 speak(bubble.t)만 호출하므로(H2와 같은
           코드 경로) phase를 진행시키지 못한다. waitForChild 중 정지한 경우만
           "말했어요"로 복구된다. 대상 기기가 태블릿이라 실사용 영향이 크다.
완화     : 없음
완화붕괴 : 해당 없음
필요조치 : speak()에 mockup과 동일한 길이 기반 워치독을 speechSynthesis 유무와
           무관하게 항상 무장.
게이트   : G1
상태     : 미착수
```

### H7 — 가로 모드 폰에서 주 버튼에 물리적으로 도달할 수 없다

```
심각도   : HIGH
분류     : [1] 배포 코드
근거     : 사이즈 기반 미디어쿼리 0개(web/src 전체) + .talk{overflow:hidden}
현상     : Puppeteer 실측(4개 뷰포트):
             820×1180(검증된 유일 형태)  bottom=840  vh=1180  ✅
             1180×820(iPad 가로)         bottom=660  vh=820   ✅
             390×844(iPhone 세로)        bottom=784  vh=844   ✅
             844×390(iPhone 가로)        bottom=531  vh=390   ❌ 141px 화면 밖,
                                          내용높이 563px, overflow:hidden이라
                                          스크롤도 불가 → 세션이 그 자리에서 멈춘다
영향     : 규칙 8(스크롤 없음)을 지키려다 규칙 1(주 행동 도달 가능)이 깨진다.
           목업은 fit()(mockup:2359-2365)으로 뷰포트에 맞춰 프레임 전체를
           균일 축소해 이 문제 자체를 만들지 않았다 — 이식에서 빠진 장치.
완화     : 없음
완화붕괴 : 해당 없음
필요조치 : mockup의 fit() 패턴(균일 스케일 + 음수 마진) 이식, 또는 세로 방향
           강제 힌트 + 짧은 뷰포트 전용 컴팩트 레이아웃.
게이트   : G1
상태     : 미착수
```

### H8 — 화자를 알 수 없다

```
심각도   : MED-HIGH
분류     : [1] 배포 코드(이식 시 후퇴)
근거     : mockup-v1.html:791-793(#bubble-name 18px 별도 줄, otherNow()로 매번
           해석) vs web/src/screens/Talk.tsx:234(말풍선에 이름 없음)
현상     : 목업은 말풍선 위에 화자 이름을 항상 표시했다. 구현엔 이름도 없고
           위치·색·꼬리 방향 구분도 없어, 누가 말하는지 알 수 있는 유일한
           단서가 입 움직임 애니메이션뿐이다.
영향     : 규칙 4("글자 없이 작동")를 엄밀히 지키려면 원래 화자 정보도 음성·
           캐릭터만으로 전달돼야 하지만("글자 끄기" 테스트에서 입 모양이
           유일한 단서), 현재는 그 최소선조차 목업보다 후퇴했다 — 최소한
           이름이라도 있던 목업 대비 정보가 더 줄었다. 프론트/작업기록_UIUX_v1.md:555
           "갭 2"가 이미 알려진 미해결 과제.
완화     : 캐릭터 입 모양 애니메이션(부분적 완화)
완화붕괴 : "글자 끄기" 상태 + 두 캐릭터가 동시에 화면에 있을 때 입 모양만으로
           빠르게 구분하기 어려움(특히 반응속도가 느린 유아)
필요조치 : 최소: 목업처럼 화자 이름 텍스트 라인 복구. 이상적: 위치·색·꼬리
           방향까지.
게이트   : G2(완전한 해법은 디자인 작업 필요) / G1(이름 복구는 지금 가능)
상태     : 미착수
```

### H9 — 아이 화면에 영어 오류 페이지가 도달할 수 있다

```
심각도   : MED-HIGH
분류     : [3] 통합이 신규 도입
근거     : app/ 디렉터리에 error.tsx·not-found.tsx 부재(확인: find/ls 결과 0건)
현상     : 렌더 예외나 존재하지 않는 URL 접근 시 Next.js 기본 오류/404 페이지
           (영어, 빨강 계열 스타일)가 뜬다.
영향     : S3 / 프론트/CLAUDE.md:81 "아이 화면에 오류 색 자체가 없다"의
           정면 구멍. 발생 빈도는 낮지만 발생하면 이 프로젝트가 가장 엄격하게
           막으려 한 것(오류 색·오류 어휘)이 그대로 노출된다.
완화     : 없음
완화붕괴 : 해당 없음
필요조치 : error.tsx/not-found.tsx를 한국어·오류색 없이(캐릭터 cantHear 상태
           재사용) 작성.
게이트   : G1
상태     : 미착수
```

### H10 — `/__dev`가 프로덕션 빌드에 무인증으로 실려 아이 화면 금지 데이터를 노출한다

```
심각도   : MED
분류     : [1] 배포 코드
근거     : web/app/%5F%5Fdev/page.tsx — parent_meta(scenario_title, learning_goal,
           conflict_trigger, dev_issues)를 JSON.stringify로 렌더. api.ts:65가
           이 값을 "🚨 아이 화면 노출 금지"로 명시
현상     : 개발자 하네스가 별도 인증 없이 빌드에 포함되며 라우팅된다.
영향     : 직접적인 아동 피해는 아니지만, 계약서가 못박은 비노출 대상이
           실제로는 인증 없는 경로 하나 뒤에 있다. G1이 원본 index.html
           병행 시연을 승격 조건으로 다룬 것과 같은 성격의 리스크인데
           별도 게이트 항목이 없다.
완화     : 프로덕션 도메인을 아직 공개 배포하지 않음(현재 로컬 전용)
완화붕괴 : 공개 배포 순간 즉시 노출
필요조치 : 빌드 플래그로 프로덕션에서 라우트 제외, 또는 기본 인증 추가.
게이트   : G2-8(공개 배포 시 인증·레이트리밋)에 준하는 신규 항목으로 등재 제안
상태     : 미착수
```

---

## 3. 🟡 Med — 일관성·상태 처리·접근성

| # | 발견 | 근거 |
|---|---|---|
| M1 | 비활성 마이크가 무반응 데코이 — 176px 고채도 버튼을 탭해도 소리·눌림 응답이 전혀 없다(`Tap.handle`이 `disabled`면 조기 반환, 규칙 5 위반). 게다가 아이 차례가 되면 이 버튼이 **사라지고** "말했어요" 버튼이 그 자리에 나타난다 — 목업은 마이크를 같은 자리에 두고 상태만 바꿨다(`.idle` 맥동/`.rec` 녹색+링/`data-off` 50%). 말할 수 없을 때 마이크가 보이고 말해야 할 때 사라진다 | `MicButton.tsx`, `Talk.tsx:241-249` |
| M2 | 진행 표시(turnbar) 없음 — 목업은 3점을 상단에 고정하고 `done`을 색+scale 1.15 이중 채널로 표시. 구현엔 없어 3턴 중 어디인지 아이도 보호자도 모른다 | mockup `144-151` |
| M3 | 송편·상대역 크기 위계 없음, 발바닥선 약 30px 어긋남 — 둘 다 200px로 렌더. 목업은 290 vs 420 + `margin-bottom:-34px`로 위계·정렬을 만들었다. (인용 시 주의: 가이드`:511`의 "상대역보다 작게"는 §9 5단계 연계 조항이라 §2 절대 규칙이 아니다 — 근거는 목업 자체 기하로 잡는다) | mockup `174-176`, `10-turn0-ask.png` |
| M4 | reduced-motion에서 팥고물·폭죽 입자가 완전히 숨지 않고 정지 흔적을 남긴다 — 목업은 `.pat-burst{display:none!important}`로 아예 숨겼는데 이식본은 `animation:none`만 걸었다. 실측 영향은 작다(팥고물은 몸통과 같은 색이라 대부분 안 보이고 색이 다른 하나만 ~5px 튀어나온 채 1.5초 정지). 완성 보상 화면의 폭죽(`RewardParty`)도 같은 문제이나 **이건 목업도 마찬가지**(공유 결함, 회귀 아님) | `Character.module.css:146-148`, mockup `743` |
| M5 | 완성 보상 화면(꿀파티)의 파티클 생성이 무한 `setInterval` — 2.6초마다 영구 생성, 규칙 7과 긴장. 목업도 동일 패턴(공유 결함) | `RewardParty.tsx:53-56`, mockup `1994` |
| M6 | 무지개떡 진행이 새로고침으로 초기화 — 모듈 스코프 변수(S6 준수 목적)라 6층 완성 보상은 **한 번도 새로고침 없이 6세션**을 해야 도달. 사실상 대부분의 아이가 보지 못할 콘텐츠 | `progress.ts:10` |
| M7 | 한글 단어 중간 줄바꿈 — `max-width:22ch`에 `word-break` 미지정, `11-reward.png`에서 "말했구"/"나."로 쪼개짐 | `Reward.module.css`, `Talk.module.css` |
| M8 | 시스템 이모지가 팔레트 밖 색을 끌고 온다 — 🔁 회청색, 🎤 진회색. 가이드는 회색·검정을 면적색으로 금지. 플랫폼별 렌더 차이로 시각 회귀 기준도 못 됨. 목업은 인라인 SVG 아이콘 사용 | `프론트/캐릭터_가이드_v1.md:78` |
| M9 | 접근성 — `aria-live` 0건(대사가 스크린리더에 전달 안 됨) · 화면 전환마다 포커스가 `<body>`로 유실 · `disabled`는 `aria-disabled`만 있고 네이티브 속성 미적용(비활성 마이크가 포커스 가능) · `maximumScale:1`+`userScalable:false`(WCAG 1.4.4 위반). 자동 a11y 검사 도구 0개 | `layout.tsx`, `Tap.tsx` |
| M10 | 서버 미응답 시 3턴이 사실상 같은 대사 반복 — 폴백 `ask`/`back`이 각 1종뿐이라 `angry→sad→shy` 감정 궤적(가이드`:327-333`의 핵심 교육 설계)이 사라진다. README`:51-62`의 "아이 화면은 차이를 인지하지 못한다"는 이 경로에선 과장 | `FALLBACK_DECK`, `Talk.tsx:110,141` |
| M11 | 종료 안내 없음 — 목업엔 `#bye`("오늘 연습은 여기까지야") + `끝내기`가 있는데 구현엔 `다시 하기` 하나뿐. 규칙 7 "보상 화면 → **종료 안내**"에서 종료 안내가 빠졌다. 아이에게 주어진 선택지가 사실상 "또 하기" 하나 | mockup `#bye`/`끝내기`, `프론트/CLAUDE.md:53` |
| M12 | 대사 전량이 `GDL-001` 재작성(2026-08-05) 이후 재감수되지 않았다 — `R1`(문장 10단어 내외, 접속절 금지)·`R7`(시간 표현 '지금'·'이따가' 수준)이 새로 생겼는데, 예 `rewardPound` "인절미랑 떡메로 쳐**서** 더 쫄깃하게 만들자"는 접속어미+낯선 명사+추상 촉감어. `sanitizeForChild`는 길이·위험패턴만 검사하고 R1/R5/R7은 기계 검사가 아예 없다 | `GDL-001-R1,R5,R7`, `lines.ts` |

---

## 4. 🟢 Low — 정리·부채

- `src/tokens/index.ts` 전체가 런타임 死코드 — 실제 토큰은 `globals.css`의 손복사 `:root`이고
  4색만 드리프트 검사됨. 실제 CSS는 문서 토큰의 2배(152/176 vs 76/88).
- `.module.css`의 hex 리터럴이 S7 검사를 우회 — S7은 `.ts/.tsx`만 스캔(`RewardParty.module.css`에
  hex 6개).
- `npm test`가 아무것도 실행하지 않음(`src/**/*.test.mjs` 매치 0건).
- `next.config.mjs`에 `127.0.0.1:8100` 하드코딩.
- `docs/screenshots/01~09`가 stale — 버튼 확대(`a14b0a1`) 이전 UI이고 `docs/09`가 이를
  현재 증거로 참조.
- 死코드: `retry()`·`supportSlot()`·`CHILD_SPOKE_UNCLEAR`·`canthear`·`ESCALATE`·
  `escalate*` 대사·`classifyChildUtterance`·`MicButton.listening`·`Tap.parent`·`soft`·
  `LINES.start`/`replay`·`AGE_BAND_LABEL`. `session-machine`의 `charState`/`retry`/
  `support`/`done`도 미사용. `CharState` 유니온이 `cantHear`/`canthear`로 표기 불일치.
- `resetIfComplete()`는 정확히 6에서만 리셋한다 — 6 초과 상태로 들어갈 경로는 없지만
  방어적 성격의 코드일 뿐 실사용에 영향 없음(참고용, 조치 불필요).

---

## 4-b. 잘 지켜진 것

지적만 나열하면 리뷰가 안 읽힌다. 실제로 검증해서 **옳았던** 것들:

- **S1(최상위 불변식)이 구조적으로 안전하다.** `Talk.tsx`는 송편에게 `emo`를 아예 넘기지
  않고, 상대역의 `emoToShow`는 턴 인덱스에만 의존한다. 판정 로직이 없으니 감정이 아이
  발화에 닿을 경로 자체가 없다 — 주석이 아니라 구조로 막았다.
- **감정 궤적이 데크에서 실제로 누그러지는 방향이다** — 실측 `angry→surprised`,
  `sad→none`, `shy→joy`. 가이드`:327-333`과 일치.
- **오류 색·실패음·랭킹·스트릭·결제가 진짜로 0건이다.** 토큰에 `--error`가 없고 `sfx`에
  실패음이 없다. S3·S12는 문서 주장 그대로다.
- **`sanitizeForChild`가 자르지 않고 통째로 교체한다** — 문장을 중간에서 끊는 것보다
  저작 폴백이 낫다는 판단. 좋은 선택이다.
- **`Tap`이 250ms 연타 방지를 넣었다** — 아이는 반드시 연타한다는 관찰이 반영됐다.
- **`:focus-visible` 링이 있다 — 목업에는 없었다.** 구현이 설계 원본보다 나은 지점.

---

## 5. 문서 간 상충

| 상충 | 위치 |
|---|---|
| **연령**: engine 사본의 `ETH-002`·`GDL-002`·`LEGAL-002`·`GOV-002`·`LEGAL-003`이 아직 초등/7~9세 기준 | `CHILD-SAFETY-GATES.md` 자체가 G1-2(잔존)와 G1-13(완료)로 자기모순 |
| **감정 개수**: 헤더 7종 / 표 8행 / 실제 CSS 6종 — 어느 2개가 빠졌는지 미문서화 | `캐릭터_가이드_v1.md:219` vs `:233-242` vs `docs/07:14` |
| **불변식 개수**: 14건 / 13건(목록 12개만 나열) / 14건. S11·S13은 표에 없고 G1-9는 결번 | `README:107` vs `docs/05:110,114` vs `docs/09:22` |
| **pytest 개수**: 50 / 46 / 56 | `README:142` vs `docs/05:101` vs `docs/09:22` |
| **골든 픽스처**: "7건"인데 4문장만 표기 | `README:123` vs `:130-135` |
| **PARTNER_ECHO 표**가 가이드/기획에서 다름(`proud` 행 유무, "(약)" 표기) | `가이드:295-307` vs `기획:282-289` |
| **수치 3건**: 절구 면적 4% vs 12% · 채도 .5 vs .55 · 콩고물 7알 vs 6~8알 | `가이드` vs `기획` |
| **보상 발동 조건**: "6층 완성 시에만"(가이드) vs "3턴 완주 즉시"(통합 문서) — **H4의 뿌리** | `가이드:106` vs `docs/07:20,28` |
| **Tailwind**: "쓰지 않음"(프론트) vs 기술스택에 포함(백엔드 README) — `docs/02`에서 미조정 | `프론트/CLAUDE.md:12` vs `백엔드/README:101` |
| **LLM 벤더**: OpenAI GPT-4o 표기 vs 실제 Gemini | `백엔드/README:103` vs `engine/RULE_ENGINE_README:81` |
| **README 수정 완료 여부** 불일치 | `CLAIMS-SUBSTANTIATION:83-89`(⬜) vs `FORK-LOG:110-116`(적용됨) |
| **"빨강 0건"** 오독 위험 — `docs/05:135`는 "컴파일된 CSS에서"라고 정확히 한정했지만, 무지개떡 1층 `#E86A6A`는 에셋(`rainbow.ts`)에 있어 화면에는 빨강이 실제로 보인다(의도된 것). 체크리스트 문면만 보면 "화면에 빨강 없음"으로 오독된다 | `docs/05:134-135`(B-7이 `src/assets/` 면제) |

---

## 6. 아직 없는 화면 — 설계 제안

문서엔 정의됐지만 화면이 없는 것들. 각 항목에 이미 존재하는 스펙을 근거로 붙인다.

1. **송편 색 선택** — 목업 시작 화면의 88px 스와치 3개. 가이드`:509`가 "아이가 이
   서비스에서 가진 **유일한 소유권**"이라고 못박은 것이 구현에 아예 없다. 기본값은
   반드시 쑥색(분홍 예외 조항의 조건).
2. **ParentGate** — 스펙 완성됨(`task-01-tokens-and-primitives.md:59-63`): 두 자리
   덧셈 4지선다, 매번 난수, 오답 시 조용히 재생성, 실패 카운트 비노출, 애니메이션·
   사운드 없음, 56px.
3. **ParentHome** — 문안 이미 작성됨(`AI-DISCLOSURE-COPY.md:28-70`,
   `PARENT_NOTICE`/`REPORT_DISCLAIMER` 키만 미구현). "또랑은 심리검사·진단·치료가
   아닙니다"가 가장 중요한 줄.
4. **연령 선택(4/5/6)** — `AGE_BANDS`는 있는데 `'5'` 하드코딩. `GDL-001:37-49`에
   연령별 확장 표가 있어 4세와 6세가 같은 콘텐츠를 받는 현재 상태는 설계 의도와 다르다.
5. **종료 안내** — 규칙 7이 요구(M11). 목업 `#bye` + `끝내기`.
6. **아동 안전 오류 경계** — `error.tsx`/`not-found.tsx`를 한국어·오류색 없이(H9 대응).
7. **`cantHear`/`listening` 화면** — 상태기계엔 있고 도달 불가. STT 켜질 때 필요.
8. **나머지 5개 연습 + locked-row** — 목업엔 `opacity:.45`·`aria-hidden` 예고 행이 있었다.

---

## 7. 우선순위 요약표

| # | 등급 | 한 줄 | 수정 난이도 |
|---|---|---|---|
| H1 | 🔴 | hint 미재생 — 아이가 뭐라고 말할지 못 듣는다 | 낮음(effect 하나 추가) |
| H2 | 🔴 CRITICAL | "다시 듣기"가 반복이 아니라 건너뛰기 | 낮음(speak() 래치 추가) |
| H3 | 🔴 | 서버가 만든 상황설명이 화면에 도달 안 함 | 낮음(클로저 수정) |
| H4 | 🔴 | 보상 음성·그림 불일치, 폴백 시 문장 중복 | 낮음(문구 분기 추가) |
| H5 | 🔴 | 배경 씬 10종 전부 안 보임(내가 만든 회귀) | 매우 낮음(CSS 1줄) |
| H6 | 🔴 | TTS `onend` 무응답 시 세션 영구 정지 | 낮음(워치독 이식) |
| H7 | 🔴 | 가로 폰에서 주 버튼 도달 불가(실측) | 중간(레이아웃 스케일링) |
| H8 | 🟠 | 화자 구분 불가(목업보다 후퇴) | 낮음(이름 라인 복구) |
| H9 | 🟠 | 영어 오류 페이지 노출 가능 | 낮음(error.tsx 추가) |
| H10 | 🟡 | `/__dev` 무인증 프로덕션 노출 | 낮음(빌드 제외) |
| M1~M12 | 🟡 | §3 참조 | 대부분 낮음~중간 |
| Low | 🟢 | §4 참조 | 낮음(정리성) |

---

## 부록. 재현 방법

```bash
cd frontendbackend

# H1 — hint를 실제로 재생하는 코드가 있는지 (lines.ts의 sanitize 호출 외 0건이면 확인됨)
grep -rn '\.hint' web/src

# H2 — "다시 듣기"가 반복인지 건너뛰기인지 (puppeteer-core 필요)
cd web && node --input-type=module -e "
import puppeteer from 'puppeteer-core';
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const b=await puppeteer.launch({executablePath:CHROME,headless:'shell',args:['--no-sandbox']});
const p=await b.newPage();
await p.setViewport({width:820,height:1180});
await p.evaluateOnNewDocument(()=>{
  let cur=null,timer=null;
  window.speechSynthesis={
    speak(u){ cur=u; timer=setTimeout(()=>{const c=cur;cur=null;c.onend&&c.onend();},4000); },
    cancel(){ if(cur){clearTimeout(timer); const c=cur; cur=null; c.onend&&c.onend();} },
    getVoices:()=>[],
  };
});
await p.goto('http://127.0.0.1:3000',{waitUntil:'networkidle2'});
const bubble=()=>p.evaluate(()=>document.querySelector('main p')?.textContent||'(없음)');
const tap=(label)=>p.evaluate(l=>[...document.querySelectorAll('button')]
  .find(b=>b.getAttribute('aria-label')===l)?.click(),label);
await tap('시작하기'); await new Promise(r=>setTimeout(r,300));
console.log('1)', await bubble());
for (let i=2;i<=5;i++){ await tap('다시 듣기'); await new Promise(r=>setTimeout(r,300));
  console.log(i+')', await bubble()); }
await b.close();
"

# H3 — 서버가 준 intro와 아이가 듣는 intro가 다른지
curl -s -X POST http://127.0.0.1:8100/api/session -H 'Content-Type: application/json' \
  -d '{"category":"ownership_turn","age_band":"5","scene":"kids"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['lines']['intro']['t'])"
# → web/src/audio/lines.ts FALLBACK_DECK.intro 값과 비교

# H5 — 배경 씬이 부모 배경에 덮이는지 (빌드된 CSS 실측)
cd web && grep -oE '\.(Scene_scene|Talk_talk)[A-Za-z0-9_]*\{[^}]*\}' .next/static/css/*.css

# H7 — 가로 모드 폰에서 주 버튼이 뷰포트 밖인지 (기대값: bottom=531, vh=390, 스크롤 불가)
#   위 H2 스크립트의 setViewport를 {width:844,height:390}으로 바꿔 동일하게 실행

# 회귀 확인 (수정 후 필수)
cd web && node scripts/check-safety-rules.mjs && npx tsc --noEmit
node scripts/capture-full-session.mjs 3000
node scripts/capture-screens.mjs   # 01~09 재생성 — 현재 버전은 stale
```
