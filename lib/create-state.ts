import { createExternalState } from "./core";

export function createState<V>(initialValue: V) {
  let value = initialValue;
  let onValueChanged: null | (() => void) = null;

  const topic = createExternalState(
    () => value,
    (emitValueChanged) => {
      onValueChanged = emitValueChanged;
      return () => (onValueChanged = null);
    }
  );

  return {
    get(): V {
      return topic.get() as V;
    },
    set(newValue: V) {
      if (!Object.is(newValue, value)) {
        value = newValue;
        onValueChanged?.();
      }
    },
  };
}
