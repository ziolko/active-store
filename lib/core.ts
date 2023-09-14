export type Topic = {
  register: () => void;

  getVersion: () => number;
  newVersion: () => void;
  subscribe: (listener: (topic: Topic) => any) => () => void;
};

type CreateTopicOptions = {
  getVersion?: () => number;
  onSubscribe?: () => (() => void) | void;
};

export function createTopic({
  onSubscribe,
  getVersion,
}: CreateTopicOptions = {}): Topic {
  let listenerCount = 0;
  let version = 0;
  let unsubscribe: (() => void) | void;

  const listeners = new Map();

  const result = {
    register: () => currentTopics?.add(result as any),
    getVersion: getVersion ?? (() => version),
    newVersion() {
      version += 1;
      for (const entry of listeners) {
        entry[1](result);
      }
    },
    subscribe(listener: (effect: Topic) => void) {
      const id = listenerCount++;

      if (listeners.size === 0) {
        unsubscribe = onSubscribe?.();
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

export function execute<R>(selector: () => R): {
  value: R;
  topics: Set<Topic>;
} {
  const previousTopics = currentTopics;

  try {
    const topics = new Set<Topic>();
    currentTopics = topics;
    const value = selector();
    currentTopics = previousTopics;
    return { value, topics } as any;
  } catch (error) {
    currentTopics = previousTopics;
    throw error;
  }
}
