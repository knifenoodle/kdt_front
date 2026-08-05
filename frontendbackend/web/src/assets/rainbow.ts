/**
 * 무지개떡 6층 진행률 — mockup-v1.html:1112-1129(`svgRainbow`/`RAINBOW`) 이식.
 * 색·기하 리터럴은 에셋이므로 여기 둔다(컴포넌트 파일 hex 리터럴 금지, docs/02 B-7).
 */

export const RAINBOW_COLORS = ['#E86A6A', '#FF9F45', '#FFC12E', '#2FB477', '#5AA9E6', '#9B7BD4'];

export interface RainbowLayer {
  x: number;
  y: number;
  width: number;
  color: string;
}

export const RAINBOW_LAYERS: RainbowLayer[] = RAINBOW_COLORS.map((color, i) => {
  const width = 172 - i * 7;
  return { x: (240 - width) / 2, y: 192 - i * 27, width, color };
});

/* 6층 완성 시 위에서 덮이는 꿀 코팅 — 층을 가리지 않고 옆으로 흘러내리는 폭만 */
export const HONEY_COAT_PATH =
  'M46,50 H194 V74' +
  ' q-9.25,22 -18.5,0 q-9.25,36 -18.5,0 q-9.25,17 -18.5,0 q-9.25,42 -18.5,0' +
  ' q-9.25,20 -18.5,0 q-9.25,31 -18.5,0 q-9.25,15 -18.5,0 q-9.25,27 -18.5,0 Z';
export const HONEY_COAT_FILL = '#F0B440';
export const HONEY_COAT_SHEEN = '#FFF1C9';
