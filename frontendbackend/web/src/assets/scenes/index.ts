/**
 * 배경 씬 10종 — mockup-v1.html:1134-1424 이식.
 *
 * 목업의 SVG 문자열 생성기(`sc`/`rep`/장소별 함수)를 그대로 옮긴다. 신규 저작 0줄 —
 * 좌표·색상 리터럴은 원본과 동일하다. 모듈 로드 시 1회만 계산해 상수로 굳힌다.
 *
 * 🚨 캐릭터 위에 깔리는 배경일 뿐이다. 조작 요소가 아니므로 Tap 을 경유하지 않는다(규칙 3 무관).
 */

import type { Scene } from '@/lib/api';

function sc(wall: string, floorY: number, floor: string, inner: string): string {
  return (
    '<svg viewBox="0 0 820 560" preserveAspectRatio="xMidYMax slice">' +
    '<rect width="820" height="560" fill="' + wall + '"/>' +
    '<rect y="' + floorY + '" width="820" height="' + (560 - floorY) + '" fill="' + floor + '"/>' +
    inner +
    '</svg>'
  );
}
function rep(n: number, fn: (i: number) => string): string {
  let s = '';
  for (let i = 0; i < n; i++) s += fn(i);
  return s;
}

/* 편의점 — 냉장 진열장 + 곤돌라 + 계산대 */
function scCvs(): string {
  let s =
    '<rect x="110" y="24" width="250" height="14" rx="7" fill="#FFF7DC"/>' +
    '<rect x="460" y="24" width="250" height="14" rx="7" fill="#FFF7DC"/>';
  s += rep(3, (i) => {
    const x = 26 + i * 106;
    return (
      '<rect x="' + x + '" y="150" width="96" height="252" rx="8" fill="#D6E7F1" stroke="#B4CBDA" stroke-width="4"/>' +
      rep(4, (r) =>
        '<rect x="' + (x + 8) + '" y="' + (232 + r * 40) + '" width="80" height="7" rx="3" fill="#B4CBDA"/>' +
        rep(4, (b) =>
          '<rect x="' + (x + 10 + b * 20) + '" y="' + (202 + r * 40) + '" width="15" height="30" rx="5" fill="' +
          ['#EFB6AE', '#BEDCC3', '#F2DCA4', '#C3C7E8'][(r + b) % 4] + '"/>',
        ),
      )
    );
  });
  s += '<rect x="384" y="238" width="222" height="164" rx="6" fill="#E7E2D6"/>' +
    rep(3, (r) =>
      '<rect x="390" y="' + (288 + r * 38) + '" width="210" height="7" rx="3" fill="#CFC8B8"/>' +
      rep(7, (b) =>
        '<rect x="' + (394 + b * 29) + '" y="' + (262 + r * 38) + '" width="22" height="26" rx="4" fill="' +
        ['#E9C0B8', '#C7DDCB', '#EFDDAE', '#CBCFEA', '#DCC9E4'][(r * 2 + b) % 5] + '"/>',
      ),
    );
  s += '<rect x="648" y="290" width="150" height="112" rx="8" fill="#DCD6E6"/>' +
    '<rect x="660" y="238" width="126" height="52" rx="6" fill="#EDE9F4"/>' +
    '<rect x="676" y="250" width="94" height="30" rx="4" fill="#9FB6D8"/>' +
    '<rect x="640" y="120" width="166" height="46" rx="8" fill="#BFD9C7"/>';
  s += rep(6, (i) =>
    '<path d="M' + (i * 164) + ',402 L' + (i * 164 + 120) + ',560" stroke="#CBD4D8" stroke-width="3" fill="none"/>',
  );
  return sc('#EEF3F4', 402, '#DBE2E5', s);
}

/* 무인문방구 — 벽면 문구 진열 + 셀프 결제 키오스크 */
function scStat(): string {
  let s = '<rect x="30" y="120" width="250" height="282" rx="8" fill="#EDE7F6" stroke="#D3C9E6" stroke-width="4"/>' +
    rep(4, (r) =>
      '<rect x="36" y="' + (190 + r * 54) + '" width="238" height="7" rx="3" fill="#D3C9E6"/>' +
      rep(6, (b) =>
        '<rect x="' + (42 + b * 39) + '" y="' + (154 + r * 54) + '" width="28" height="36" rx="3" fill="' +
        ['#F3C9A8', '#AFD3E8', '#F0DCA0', '#C8E2C0', '#DCC2E4', '#EFB6B0'][(r + b) % 6] + '"/>',
      ),
    );
  s += '<rect x="540" y="120" width="250" height="282" rx="8" fill="#EDE7F6" stroke="#D3C9E6" stroke-width="4"/>' +
    rep(4, (r) =>
      '<rect x="546" y="' + (190 + r * 54) + '" width="238" height="7" rx="3" fill="#D3C9E6"/>' +
      rep(9, (b) =>
        '<rect x="' + (552 + b * 26) + '" y="' + (152 + r * 54) + '" width="9" height="38" rx="4" fill="' +
        ['#E8A0A8', '#8FC6E0', '#F0CE7A', '#9ED2A6', '#B9A6DE'][(r * 3 + b) % 5] + '"/>',
      ),
    );
  /* 셀프 결제 키오스크 */
  s += '<rect x="350" y="236" width="128" height="166" rx="10" fill="#DDD7EA"/>' +
    '<rect x="362" y="252" width="104" height="80" rx="7" fill="#7FA8D4"/>' +
    '<rect x="376" y="268" width="76" height="9" rx="4" fill="#DCE8F5"/>' +
    '<rect x="376" y="286" width="52" height="9" rx="4" fill="#DCE8F5"/>' +
    '<rect x="380" y="348" width="68" height="28" rx="6" fill="#F0C64A"/>' +
    '<rect x="336" y="150" width="156" height="42" rx="8" fill="#C7BCE4"/>' +
    '<rect x="352" y="164" width="124" height="14" rx="7" fill="#EDE9F6"/>';
  /* 천장등 + 벽 포스터 */
  s += '<rect x="120" y="26" width="240" height="13" rx="6" fill="#FFF7DC"/>' +
    '<rect x="460" y="26" width="240" height="13" rx="6" fill="#FFF7DC"/>' +
    rep(2, (i) => {
      const x = 308 + i * 106;
      return (
        '<rect x="' + x + '" y="58" width="90" height="70" rx="6" fill="#FBF7FF" stroke="#D3C9E6" stroke-width="3"/>' +
        '<rect x="' + (x + 12) + '" y="72" width="66" height="10" rx="5" fill="' + ['#F0B4AC', '#9FC6EA'][i] + '"/>' +
        '<rect x="' + (x + 12) + '" y="90" width="44" height="8" rx="4" fill="#D3C9E6"/>' +
        '<rect x="' + (x + 12) + '" y="104" width="56" height="8" rx="4" fill="#D3C9E6"/>'
      );
    });
  return sc('#F5F1FA', 402, '#E3DCEF', s);
}

/* 영화관 — 스크린 + 좌석 열. 검정을 면적색으로 쓰지 않는다 */
function scCinema(): string {
  let s = '<rect x="86" y="52" width="648" height="264" rx="10" fill="#4E4C74"/>' +
    '<rect x="98" y="64" width="624" height="240" rx="6" fill="#EFEADC"/>' +
    '<rect x="150" y="104" width="290" height="18" rx="9" fill="#D8D0BC"/>' +
    '<rect x="150" y="140" width="410" height="18" rx="9" fill="#D8D0BC"/>' +
    '<rect x="150" y="176" width="210" height="18" rx="9" fill="#D8D0BC"/>';
  /* 좌석 2열 */
  s += rep(7, (i) => {
    const x = 48 + i * 112;
    return (
      '<path d="M' + x + ',408 v-42 a26,26 0 0 1 52,0 v42 z" fill="#5F5C88"/>' +
      '<rect x="' + (x - 8) + '" y="372" width="16" height="40" rx="7" fill="#55527C"/>'
    );
  });
  s += rep(6, (i) => {
    const x = 104 + i * 112;
    return (
      '<path d="M' + x + ',508 v-52 a30,30 0 0 1 60,0 v52 z" fill="#6E6B98"/>' +
      '<rect x="' + (x - 9) + '" y="466" width="18" height="46" rx="8" fill="#5F5C88"/>'
    );
  });
  s += rep(9, (i) => '<circle cx="' + (30 + i * 98) + '" cy="536" r="5" fill="#F2E2A8"/>');
  return sc('#6B6894', 336, '#5A5782', s);
}

/* 백화점 — 에스컬레이터 + 매장 간판 + 대리석 바닥 */
function scDept(): string {
  let s = rep(3, (i) => '<circle cx="' + (180 + i * 230) + '" cy="60" r="26" fill="#FBF6E4"/>');
  s += '<rect x="60" y="128" width="196" height="58" rx="10" fill="#D9C8DE"/>' +
    '<rect x="300" y="128" width="196" height="58" rx="10" fill="#C9D6E4"/>' +
    '<rect x="540" y="128" width="196" height="58" rx="10" fill="#D8DCC6"/>' +
    rep(3, (i) => '<rect x="' + (88 + i * 240) + '" y="148" width="140" height="18" rx="9" fill="#F4F0F6"/>');
  /* 에스컬레이터 */
  s += '<path d="M470,410 L790,214 L790,268 L470,462 Z" fill="#DAD3E2"/>' +
    '<path d="M470,462 L790,268 L790,290 L470,484 Z" fill="#C3BBD0"/>' +
    rep(11, (i) => '<path d="M' + (480 + i * 28) + ',' + (456 - i * 17) + ' l26,-16" stroke="#B4AAC4" stroke-width="4" fill="none"/>') +
    '<path d="M470,382 L790,186" stroke="#EDE8F2" stroke-width="12" fill="none" stroke-linecap="round"/>';
  /* 매장 유리창 + 마네킹 실루엣 */
  s += '<rect x="40" y="196" width="200" height="206" rx="8" fill="#EDE8F2" stroke="#D6CDE2" stroke-width="4"/>' +
    '<rect x="272" y="196" width="176" height="206" rx="8" fill="#EDE8F2" stroke="#D6CDE2" stroke-width="4"/>';
  s += rep(3, (i) => {
    const x = [92, 178, 336][i];
    const sc2 = [1, 0.86, 0.94][i];
    return (
      '<g transform="translate(' + x + ',402) scale(' + sc2 + ')">' +
      '<path d="M-26,0 L-18,-96 h36 L26,0 Z" fill="' + ['#C6B6D8', '#B6C4D8', '#CBBFA8'][i] + '"/>' +
      '<circle cx="0" cy="-116" r="17" fill="#D8CFE2"/>' +
      '<rect x="-4" y="-104" width="8" height="12" fill="#D8CFE2"/></g>'
    );
  });
  /* 화분 */
  s += rep(2, (i) => {
    const x = 478 + i * -2;
    return (
      '<path d="M' + (x - 24) + ',402 l6,-46 h36 l6,46 z" fill="#C9BCA6"/>' +
      '<ellipse cx="' + x + '" cy="336" rx="34" ry="26" fill="#A9C4A0"/>' +
      '<ellipse cx="' + (x - 20) + '" cy="352" rx="22" ry="16" fill="#B8D0AE"/>'
    );
  });
  /* 유리 난간 */
  s += '<rect x="40" y="300" width="380" height="10" rx="5" fill="#CFC7DC" opacity=".9"/>' +
    rep(8, (i) => '<rect x="' + (48 + i * 46) + '" y="310" width="6" height="92" fill="#E2DCEC" opacity=".7"/>');
  s += rep(5, (i) => '<path d="M0,' + (430 + i * 30) + ' H820" stroke="#DDD6E4" stroke-width="2"/>');
  return sc('#F6F2F8', 412, '#E9E3EE', s);
}

/* 생활용품점 — 좁은 통로 + 노란 가격표가 빼곡한 진열대 */
function scVariety(): string {
  function rack(x: number, w: number): string {
    const shelves = rep(5, (r) => {
      const bins = rep(Math.floor((w - 14) / 26), (b) =>
        '<rect x="' + (x + 10 + b * 26) + '" y="' + (146 + r * 48) + '" width="20" height="28" rx="3" fill="' +
        ['#EFB4AC', '#9FCBE4', '#F2D488', '#A8D9AE', '#C6B4E2', '#F0A9C4'][(r * 2 + b) % 6] + '"/>' +
        '<rect x="' + (x + 10 + b * 26) + '" y="' + (174 + r * 48) + '" width="20" height="9" rx="2" fill="#FFD64A"/>',
      );
      return '<rect x="' + (x + 6) + '" y="' + (174 + r * 48) + '" width="' + (w - 12) + '" height="7" rx="3" fill="#E0D3B4"/>' + bins;
    });
    return (
      '<rect x="' + x + '" y="120" width="' + w + '" height="286" rx="6" fill="#F6EFDD" stroke="#E0D3B4" stroke-width="4"/>' +
      shelves
    );
  }
  let s = rack(20, 300) + rack(500, 300) +
    '<rect x="340" y="60" width="140" height="40" rx="8" fill="#FFD64A"/>' +
    '<rect x="356" y="74" width="108" height="12" rx="6" fill="#FFF6DC"/>';
  s += rep(5, (i) => '<path d="M330,' + (420 + i * 30) + ' H490" stroke="#DFD7C6" stroke-width="2"/>');
  return sc('#FFF9EC', 406, '#EDE6D6', s);
}

/* 키즈카페 — 무지개 벽화 + 가랜드 + 볼풀 + 미끄럼틀 */
function scKids(): string {
  const RB = ['#F3A9A0', '#F6C87A', '#F2E29A', '#A8D9AE', '#9FC6EA'];
  /* 벽 무지개 벽화 */
  let s = rep(5, (i) => {
    const r = 176 - i * 24;
    return '<path d="M' + (250 - r) + ',330 a' + r + ',' + r + ' 0 0 1 ' + (r * 2) + ',0" fill="none" stroke="' + RB[i] + '" stroke-width="21" opacity=".42"/>';
  });
  /* 가랜드 (삼각 깃발) */
  s += '<path d="M0,44 Q205,104 410,52 Q615,100 820,40" fill="none" stroke="#D8C6AE" stroke-width="4"/>';
  s += rep(14, (i) => {
    const x = 24 + i * 58;
    const y = 52 + Math.sin(i * 0.9) * 20;
    return '<path d="M' + (x - 15) + ',' + y + ' h30 l-15,34 z" fill="' + RB[i % 5] + '" opacity=".8"/>';
  });
  /* 구름 */
  s += rep(2, (i) => {
    const x = 470 + i * 250;
    const y = 150 + (i % 2) * 40;
    return (
      '<ellipse cx="' + x + '" cy="' + y + '" rx="60" ry="28" fill="#FFFFFF" opacity=".8"/>' +
      '<ellipse cx="' + (x - 36) + '" cy="' + (y + 8) + '" rx="34" ry="20" fill="#FFFFFF" opacity=".8"/>' +
      '<ellipse cx="' + (x + 34) + '" cy="' + (y + 10) + '" rx="30" ry="18" fill="#FFFFFF" opacity=".8"/>'
    );
  });
  /* 풍선 */
  s += rep(3, (i) => {
    const x = 612 + i * 68;
    const y = 246 + (i % 2) * 44;
    return (
      '<path d="M' + x + ',' + (y + 30) + ' v46" stroke="#D8C6AE" stroke-width="3" fill="none"/>' +
      '<ellipse cx="' + x + '" cy="' + y + '" rx="26" ry="31" fill="' + RB[(i + 1) % 5] + '"/>' +
      '<ellipse cx="' + (x - 8) + '" cy="' + (y - 10) + '" rx="7" ry="9" fill="#FFFFFF" opacity=".55"/>'
    );
  });
  /* 미끄럼틀 — 오른쪽 */
  s += '<rect x="700" y="196" width="98" height="118" rx="14" fill="#9FD3C0"/>' +
    '<rect x="712" y="208" width="74" height="46" rx="8" fill="#C8E8DC"/>' +
    '<path d="M596,392 C596,282 664,250 748,250 L748,314 C700,314 664,340 664,392 Z" fill="#F6C98E"/>' +
    '<path d="M624,392 C624,300 678,276 748,276 L748,300 C700,300 692,336 692,392 Z" fill="#FFE3BB"/>';
  /* 볼풀 — 왼쪽, 크게 */
  s += '<path d="M22,392 h396 v-74 a22,22 0 0 0 -22,-22 h-352 a22,22 0 0 0 -22,22 z" fill="#B9DCEA"/>' +
    '<path d="M22,318 h396" stroke="#8FC2D6" stroke-width="7" stroke-linecap="round" fill="none"/>';
  s += rep(39, (i) => {
    const col = i % 13;
    const row = Math.floor(i / 13);
    return '<circle cx="' + (48 + col * 29) + '" cy="' + (332 + row * 25) + '" r="14" fill="' + RB[(i * 3) % 5] + '"/>';
  });
  /* 굴러나온 공 2개 */
  s += '<circle cx="452" cy="440" r="17" fill="' + RB[0] + '"/><circle cx="500" cy="470" r="13" fill="' + RB[3] + '"/>';
  /* 바닥 매트 */
  s += rep(9, (i) => '<path d="M' + (i * 100) + ',392 v168" stroke="#F2DEBE" stroke-width="3"/>') +
    rep(3, (i) => '<path d="M0,' + (440 + i * 54) + ' H820" stroke="#F2DEBE" stroke-width="3"/>');
  return sc('#FFF3E4', 392, '#FBE9CC', s);
}

/* 교실 — 칠판 + 책상 + 사물함 + 게시판 */
function scClass(): string {
  const PB = ['#F3A9A0', '#F6C87A', '#A8D9AE', '#9FC6EA', '#C6B5E4'];
  /* 칠판 — 검정·짙은 초록을 쓰지 않는다(면적색 금지). 옅은 민트 화이트보드로 */
  let s = '<rect x="150" y="70" width="430" height="216" rx="14" fill="#E6F3EC"/>' +
    '<rect x="150" y="70" width="430" height="216" rx="14" fill="none" stroke="#C9DED4" stroke-width="8"/>' +
    '<rect x="196" y="120" width="180" height="12" rx="6" fill="#BFD6CB"/>' +
    '<rect x="196" y="152" width="290" height="12" rx="6" fill="#CFE3D8"/>' +
    '<rect x="196" y="184" width="120" height="12" rx="6" fill="#CFE3D8"/>' +
    '<rect x="150" y="286" width="430" height="14" rx="7" fill="#EFE3CC"/>';
  /* 게시판 — 아이들 그림 */
  s += '<rect x="618" y="92" width="176" height="150" rx="12" fill="#FBEFD8"/>' +
    rep(4, (i) => {
      const x = 634 + (i % 2) * 86;
      const y = 108 + Math.floor(i / 2) * 70;
      return '<rect x="' + x + '" y="' + y + '" width="70" height="56" rx="6" fill="' + PB[i % 5] + '" opacity=".62"/>';
    });
  /* 사물함 — 왼쪽 */
  s += rep(6, (i) => {
    const x = 22 + (i % 2) * 66;
    const y = 150 + Math.floor(i / 2) * 54;
    return (
      '<rect x="' + x + '" y="' + y + '" width="58" height="46" rx="8" fill="' + PB[i % 5] + '" opacity=".5"/>' +
      '<circle cx="' + (x + 46) + '" cy="' + (y + 23) + '" r="4" fill="#D8C6AE"/>'
    );
  });
  /* 책상 3개 — 앞줄 */
  s += rep(3, (i) => {
    const x = 96 + i * 230;
    return (
      '<rect x="' + x + '" y="404" width="184" height="20" rx="10" fill="#F6E6C8"/>' +
      '<rect x="' + (x + 16) + '" y="424" width="14" height="80" rx="7" fill="#E4D2B2"/>' +
      '<rect x="' + (x + 154) + '" y="424" width="14" height="80" rx="7" fill="#E4D2B2"/>' +
      '<rect x="' + (x + 58) + '" y="360" width="68" height="46" rx="10" fill="' + PB[(i + 1) % 5] + '" opacity=".55"/>'
    );
  });
  return sc('#FFF8EE', 392, '#F3E4CB', s);
}

/* 놀이터 — 미끄럼틀 + 그네 + 모래밭 + 나무 */
function scPlay(): string {
  /* 하늘 구름 */
  let s = rep(3, (i) => {
    const x = 120 + i * 300;
    const y = 78 + (i % 2) * 44;
    return (
      '<ellipse cx="' + x + '" cy="' + y + '" rx="66" ry="30" fill="#FFFFFF" opacity=".85"/>' +
      '<ellipse cx="' + (x - 40) + '" cy="' + (y + 10) + '" rx="38" ry="22" fill="#FFFFFF" opacity=".85"/>' +
      '<ellipse cx="' + (x + 38) + '" cy="' + (y + 12) + '" rx="34" ry="20" fill="#FFFFFF" opacity=".85"/>'
    );
  });
  /* 나무 — 왼쪽 */
  s += '<rect x="76" y="270" width="26" height="130" rx="13" fill="#D9BE93"/>' +
    '<ellipse cx="89" cy="248" rx="86" ry="66" fill="#A8CE86"/>' +
    '<ellipse cx="46" cy="272" rx="52" ry="40" fill="#B8D998"/>' +
    '<ellipse cx="132" cy="274" rx="48" ry="36" fill="#B8D998"/>';
  /* 그네 — 가운데 */
  s += '<path d="M330,392 L392,178 L454,392" fill="none" stroke="#EFC98F" stroke-width="14" stroke-linecap="round"/>' +
    '<rect x="330" y="170" width="128" height="14" rx="7" fill="#E8B978"/>' +
    '<path d="M362,184 v122 M422,184 v122" stroke="#D8C6AE" stroke-width="5"/>' +
    '<rect x="352" y="306" width="80" height="16" rx="8" fill="#9FC6EA"/>';
  /* 미끄럼틀 — 오른쪽 */
  s += '<rect x="672" y="196" width="104" height="122" rx="14" fill="#9FD3C0"/>' +
    '<rect x="686" y="210" width="76" height="46" rx="8" fill="#C8E8DC"/>' +
    '<path d="M566,394 C566,282 636,250 722,250 L722,316 C674,316 636,342 636,394 Z" fill="#F6C98E"/>' +
    '<path d="M594,394 C594,300 650,276 722,276 L722,300 C674,300 664,338 664,394 Z" fill="#FFE3BB"/>';
  /* 모래밭 */
  s += '<ellipse cx="410" cy="470" rx="330" ry="76" fill="#F5E2BE"/>' +
    rep(9, (i) => {
      const x = 140 + i * 66;
      const y = 440 + (i % 3) * 26;
      return '<circle cx="' + x + '" cy="' + y + '" r="4" fill="#E5CFA4"/>';
    });
  /* 굴러다니는 공 */
  s += '<circle cx="238" cy="452" r="22" fill="#F3A9A0"/>' +
    '<path d="M216,452 h44" stroke="#FFFFFF" stroke-width="5" opacity=".7"/>';
  return sc('#EAF4FB', 392, '#B8D998', s);
}

/* 풋살장 — 인조잔디 + 골대 + 펜스 + 조명탑 */
function scFutsal(): string {
  let s = rep(10, (i) => (i % 2 === 0 ? '<rect x="' + (i * 82) + '" y="300" width="82" height="260" fill="#7CAE68"/>' : ''));
  /* 펜스 */
  s += rep(28, (i) => '<path d="M' + (i * 30) + ',96 v204" stroke="#C4CDD4" stroke-width="3" opacity=".85"/>') +
    rep(5, (i) => '<path d="M0,' + (110 + i * 40) + ' H820" stroke="#C4CDD4" stroke-width="3" opacity=".85"/>') +
    '<rect y="292" width="820" height="10" fill="#9FA9B2"/>';
  /* 조명탑 */
  s += rep(2, (i) => {
    const x = 90 + i * 640;
    return (
      '<rect x="' + (x - 5) + '" y="30" width="10" height="266" fill="#A8B2BA"/>' +
      '<rect x="' + (x - 46) + '" y="16" width="92" height="30" rx="6" fill="#DCE4EA"/>'
    );
  });
  /* 골대 */
  s += '<rect x="292" y="176" width="238" height="128" rx="4" fill="none" stroke="#F4F7F9" stroke-width="9"/>' +
    rep(9, (i) => '<path d="M' + (300 + i * 26) + ',180 v120" stroke="#EAF0F4" stroke-width="2.5"/>') +
    rep(5, (i) => '<path d="M296,' + (186 + i * 26) + ' H526" stroke="#EAF0F4" stroke-width="2.5"/>');
  /* 라인 */
  s += '<path d="M0,338 H820" stroke="#F2F7F4" stroke-width="6"/>' +
    '<path d="M230,560 a190,120 0 0 1 360,0" fill="none" stroke="#F2F7F4" stroke-width="6"/>';
  return sc('#DCEAF4', 300, '#86B571', s);
}

/* 태권도장 — 매트 + 벽거울 + 띠 걸이 */
function scDojang(): string {
  let s = '<rect x="40" y="96" width="330" height="204" rx="8" fill="#DCE6EE" stroke="#C0CBD6" stroke-width="6"/>' +
    '<path d="M60,290 L200,116" stroke="#EDF3F8" stroke-width="18" opacity=".7" fill="none"/>' +
    '<path d="M150,290 L280,116" stroke="#EDF3F8" stroke-width="12" opacity=".55" fill="none"/>';
  /* 띠 걸이 */
  s += '<rect x="430" y="120" width="352" height="10" rx="5" fill="#C7B79E"/>' +
    rep(6, (i) => {
      const c = ['#E3E0DA', '#F2D785', '#8FC49C', '#8FAFD4', '#C29BD4', '#C98C7E'][i];
      return '<path d="M' + (452 + i * 58) + ',130 v78 q0,16 16,16 h10" stroke="' + c + '" stroke-width="13" fill="none" stroke-linecap="round"/>';
    });
  /* 격파판 거치대 */
  s += '<rect x="600" y="256" width="150" height="14" rx="7" fill="#C7B79E"/>' +
    '<rect x="612" y="212" width="42" height="44" rx="4" fill="#EFE6D4"/>' +
    '<rect x="664" y="212" width="42" height="44" rx="4" fill="#EFE6D4"/>';
  /* 벽 현수막 + 시계 */
  s += '<rect x="40" y="34" width="500" height="44" rx="8" fill="#C98C7E" opacity=".55"/>' +
    rep(3, (i) => '<rect x="' + (64 + i * 158) + '" y="48" width="112" height="16" rx="8" fill="#F7F2EA" opacity=".9"/>') +
    '<circle cx="626" cy="56" r="26" fill="#F7F2EA" stroke="#C7B79E" stroke-width="5"/>' +
    '<path d="M626,56 v-14 M626,56 h11" stroke="#8E8271" stroke-width="4" stroke-linecap="round"/>';
  /* 매트 격자 — 톤 낮춰 캐릭터를 방해하지 않게 */
  s += rep(5, (r) =>
    rep(9, (c) => {
      const on = (r + c) % 2 === 0;
      return '<rect x="' + (c * 92 - 20) + '" y="' + (380 + r * 40) + '" width="92" height="40" fill="' + (on ? '#C98C7E' : '#7E9AC9') + '" opacity=".55"/>';
    }),
  );
  s += '<rect y="374" width="820" height="8" fill="#B7A78E"/>';
  return sc('#F4F0E8', 380, '#D3A395', s);
}

/** 한글 표시명(개발용 — 아이 화면에 노출하지 않는다). */
export const SCENE_NAME: Record<Scene, string> = {
  class: '교실',
  play: '놀이터',
  kids: '키즈카페',
  cvs: '편의점',
  stat: '무인문방구',
  variety: '생활용품점',
  dept: '백화점',
  cinema: '영화관',
  futsal: '풋살장',
  dojang: '태권도장',
};

/** 장소별 배경 SVG. 모듈 로드 시 1회 계산. */
export const SCENE_SVG: Record<Scene, string> = {
  class: scClass(),
  play: scPlay(),
  kids: scKids(),
  cvs: scCvs(),
  stat: scStat(),
  variety: scVariety(),
  dept: scDept(),
  cinema: scCinema(),
  futsal: scFutsal(),
  dojang: scDojang(),
};
