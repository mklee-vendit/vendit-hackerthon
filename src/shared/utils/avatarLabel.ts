/** 아바타 원 안에 들어갈 글자. 한국 실명 기준으로 성을 떼고 이름 두 글자. */
export function avatarLabel(displayName: string): string {
  const name = displayName.trim();
  return name.length > 2 ? name.slice(-2) : name;
}
