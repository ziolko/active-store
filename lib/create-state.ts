import { activeExternalState } from "./core";

export interface ActiveState<V> {
  type: "active-state";
  get: () => V;
  set: (value: V) => void;
  subscribe: (listener: (value: V) => any) => () => void;
}

export function activeState<V>(
  initialValue: V,
  options: {
    onSubscribe?: (set: (value: V) => void, get: () => V) => () => void;
  } = {}
) {
  let value = initialValue;

  function setValue(newValue: V) {
    if (!Object.is(newValue, value)) {
      value = newValue;
      topic.notify();
    }
  }

  const topic = activeExternalState(
    () => value,
    (): (() => void) => {
      if (options?.onSubscribe) {
        return options?.onSubscribe(setValue, topic.get);
      } else {
        return () => null;
      }
    }
  );

  const result = {
    get: topic.get,
    set: setValue,
    subscribe: (listener: (value: V) => void) =>
      topic.subscribe(() => listener(topic.get())),
  };
  return result;
}
