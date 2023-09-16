export type Topic = {
  get: () => unknown;
  notify: () => void;
  subscribe: (listener: (topic: Topic) => any) => () => void;
};

type CreateTopicOptions = {
  onSubscribe?: () => (() => void) | void;
};

export function createTopic(get: () => any, options: CreateTopicOptions = {}) {
  let listenerCount = 0;
  let unsubscribe: (() => void) | void;

  const listeners = new Map();

  const result: Topic = {
    get() {
      currentTopics?.add(result as any);

      const previousTopics = currentTopics;
      try {
        currentTopics = null;
        return get();
      } finally {
        currentTopics = previousTopics;
      }
    },
    notify() {
      for (const entry of listeners) {
        entry[1](result);
      }
    },
    subscribe(listener: (effect: Topic) => void) {
      const id = listenerCount++;

      if (listeners.size === 0) {
        unsubscribe = options?.onSubscribe?.();
      }

      listeners.set(id, listener);
      let hasUnsubscribed = false;
      return () => {
        if (hasUnsubscribed) {
          return;
        }

        listeners.delete(id);
        hasUnsubscribed = true;

        if (listeners.size === 0 && typeof unsubscribe === "function") {
          unsubscribe?.();
          unsubscribe = undefined;
        }
      };
    },
  };
  return result;
}

let currentTopics: Set<Topic> | null = null;

export function compute<R>(selector: () => R): {
  value: R;
  topics: Set<Topic>;
} {
  const previousTopics = currentTopics;

  try {
    const topics = new Set<Topic>();
    currentTopics = topics;
    return { value: selector(), topics } as any;
  } finally {
    currentTopics = previousTopics;
  }
}
