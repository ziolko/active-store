import { createTopic } from "./core";

export function createState<V>(initialValue: V) {
  let value = initialValue;
  const topic = createTopic();

  return {
    get(): V {
      topic.register();
      return value;
    },
    set(newValue: V) {
      if (!Object.is(newValue, value)) {
        value = newValue;
        topic.newVersion();
      }
    },
  };
}
