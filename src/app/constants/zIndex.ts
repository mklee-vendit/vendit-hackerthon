// 레이어 순서는 index.html 의 포털 루트 순서와 함께 읽으세요 — 포털 순서가 같은 z-index
// 안에서의 쌓임을 정하고, 이 표는 레이어끼리의 순서를 정합니다.
export const Z_INDEX = {
  modal: 10000,
  toast: 10001,
} as const;
