import { create, type StateCreator } from 'zustand';

// 스토어 본체가 아니라 **리셋 클로저**를 모은다. 스토어마다 상태 타입이 다르므로 본체를
// 한 집합에 담으려면 `any` 로 지워야 하는데, 클로저로 잡으면 타입이 각자 안에 남는다.
const resetters = new Set<() => void>();

/**
 * zustand 스토어를 만들면서 리셋 레지스트리에 등록한다. 훅에 `reset()` 이 붙고,
 * `resetAllStores()` 로 일괄 초기화할 수 있다 — 세션 종료·홈 복귀처럼 "화면을 떠날 때
 * 클라이언트 상태 전부를 버린다"를 호출부가 스토어 목록을 들고 다니지 않고 표현하기 위한 것.
 *
 * 초기 상태는 **얕은 복사**로 떠 둔다. 중첩 객체를 제자리에서 변형하면 리셋해도 그 변형이
 * 남으므로, 상태는 불변으로 다뤄야 한다(zustand 의 기본 계약과 같다).
 */
export function createStore<T extends object>(stateCreator: StateCreator<T>) {
  const store = create<T>(stateCreator);
  const initialState = { ...store.getState() };

  const reset = () => store.setState(initialState, true);
  resetters.add(reset);

  return Object.assign(store, {
    reset,
    /** 동적으로 만든 스토어를 버릴 때. 정적 스토어는 부를 일이 없다. */
    unregister: () => resetters.delete(reset),
  });
}

export function resetAllStores() {
  for (const reset of resetters) reset();
}
