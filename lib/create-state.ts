import { activeExternalState, Dependency } from "./core";

export interface ActiveState<V> {
  get: () => V;
  set: (value: V) => void;
  subscribe: (listener: (dependency: Dependency) => any) => () => void;
}

export function activeState<V>(initialValue: V) {
  let value = initialValue;

  const topic = activeExternalState(
    () => value,
    (emit) => () => null
  );

  const result: ActiveState<V> = {
    get: topic.get,
    set(newValue: V) {
      if (!Object.is(newValue, value)) {
        value = newValue;
        topic.notify();
      }
    },
    subscribe: topic.subscribe,
  };

  return result;
}
