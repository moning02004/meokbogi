export const DEFAULT_ITEMS = [
  '치킨', '피자', '회', '중식', '찜닭', '집밥', '토스트', '족발', '떡볶이', '아구찜',
];

export const ACCENT_COLORS = [
  '#E08A5E', '#4FBF9A', '#9C93E8', '#E8A94A', '#E087A8',
  '#6FA8E0', '#7FBF4A', '#E0787E', '#D9C24E', '#5FB8B0',
];

export const CARD_W = 68;
export const CARD_H = 96;

export function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}