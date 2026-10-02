import { describe, expect, test } from 'bun:test';
import type { Profile } from './types';
import type { useProfile } from './useProfile';

// 생성된 DB 타입이 없어 클라이언트가 `SupabaseClient<any>` 라서, `.returns<Profile>()` 를
// 빼면 data 가 조용히 `any` 가 된다. `any` 는 무엇에든 할당되므로 등식 검사만으로는
// 안 걸린다 — IsAny 를 같이 본다.
type IsAny<T> = 0 extends 1 & T ? true : false;
type AssertEqual<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;

type ProfileData = ReturnType<typeof useProfile>['data'];

describe('useProfile', () => {
  test('data 는 Profile | undefined 이고 any 가 아니다', () => {
    const notAny: AssertEqual<IsAny<ProfileData>, false> = true;
    // 멤버가 아니면 null, 아직 안 읽었으면 undefined.
    const shape: AssertEqual<ProfileData, Profile | null | undefined> = true;

    expect([notAny, shape]).toEqual([true, true]);
  });
});
