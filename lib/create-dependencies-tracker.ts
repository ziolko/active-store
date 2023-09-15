import { Topic } from "./core";

interface CachedTopic {
  unsubscribe?: () => void;
  value?: unknown;
}

export function createDependenciesTracker(onDependencyChanged: () => void) {
  let isInitialized = false;
  const cache = new Map<Topic, CachedTopic>();

  return {
    hasChanged(dependencies: Set<Topic> = new Set(cache.keys())) {
      if (!isInitialized) {
        return true;
      }

      if (cache.size !== dependencies.size) {
        return true;
      }

      for (const topic of dependencies) {
        if (cache.get(topic)?.value !== topic.get?.()) {
          return true;
        }
      }

      return false;
    },
    update(dependencies: Set<Topic>) {
      // Search for existing and new topics
      for (const topic of dependencies) {
        let cached = cache.get(topic);
        if (!cached) {
          cached = {};
          cache.set(topic, cached);
        }

        cached.value = topic.get?.();
      }

      // Search for topics that are no longer there
      for (const [key, value] of cache) {
        if (!dependencies.has(key)) {
          value.unsubscribe?.();
          cache.delete(key);
        }
      }

      isInitialized = true;
    },
    subscribe() {
      for (const [key, value] of cache) {
        if (!value.unsubscribe) {
          value.unsubscribe = key.subscribe(onDependencyChanged);
        }
      }
    },
    unsubscribe() {
      for (const effect of cache.values()) {
        effect.unsubscribe?.();
        effect.unsubscribe = undefined;
      }
    },
  };
}
