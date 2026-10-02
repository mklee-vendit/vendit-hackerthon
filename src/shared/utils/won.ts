export const formatWon = (amount: number) => amount.toLocaleString('ko-KR');

/** 입력창 문자열 → 원. 숫자가 하나도 없으면 null (0원과 구분해야 한다). */
export function parseWon(input: string): number | null {
  const digits = input.replace(/\D/g, '');
  return digits === '' ? null : Number(digits);
}
