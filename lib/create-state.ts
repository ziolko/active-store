import { createTopic } from "./core";

export function createState<V>(initialValue: V) {
  let value = initialValue;
  const topic = createTopic({ get: () => value });

  return {
    get(): V {
      return topic.get() as V;
    },
    set(newValue: V) {
      if (!Object.is(newValue, value)) {
        value = newValue;
        topic.notify();
      }
    },
  };
}
