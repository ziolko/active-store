import { createDependencySignal, execute } from "./core";

export default function createState<T>(initialValue: T) {
  let value = initialValue;
  let version = 0;
  const effect = createDependencySignal({ getVersion: () => version });

  return {
    get(): T {
      execute.current.register(effect);
      return value;
    },
    set(newValue: T) {
      if (newValue !== value) {
        value = newValue;
        version += 1;
        effect.notify();
      }
    },
  };
}
