import { createSignal, execute } from "./core";

export default function createState<V>(initialValue: V) {
  let value = initialValue;
  const signal = createSignal();

  return {
    get(): V {
      execute.current.register(signal);
      return value;
    },
    set(newValue: V) {
      if (!Object.is(newValue, value)) {
        value = newValue;
        signal.notify();
      }
    },
  };
}
