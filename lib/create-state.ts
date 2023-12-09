import { createExternalState } from "./core";

export function createState<V>(initialValue: V) {
  let value = initialValue;

  const topic = createExternalState(
    () => value,
    (emit) => () => null
  );

  return {
    get: topic.get,
    set(newValue: V) {
      if (!Object.is(newValue, value)) {
        value = newValue;
        topic.notify();
      }
    },
    subscribe: topic.subscribe,
  };
}
