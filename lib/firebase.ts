import { Database, ref, set, onValue } from "firebase/database";
import { createSignal, execute } from "./core";

export function createDocument<T = unknown>(
  path: string,
  options: { db: Database }
) {
  let value: T | undefined = undefined;

  const reference = ref(options.db, path);
  const signal = createSignal({
    onSubscribe() {
      return onValue(reference, (snapshot) => {
        value = snapshot.val();
        signal.notify();
      });
    },
  });

  return {
    get() {
      execute.current.register(signal);
      return value;
    },
    set: (value: T) => set(reference, value),
  };
}
