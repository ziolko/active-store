import { Signal } from "./core";

interface CachedSignal {
  unsubscribe?: () => void;
  version?: number;
}

export function createDependenciesTracker(onDependencyChanged: () => void) {
  let isInitialized = false;
  const cache = new Map<Signal, CachedSignal>();

  return {
    hasChanged(dependencies: Set<Signal> = new Set(cache.keys())) {
      if (!isInitialized) {
        return true;
      }

      if (cache.size !== dependencies.size) {
        return true;
      }

      for (const signal of dependencies) {
        if (cache.get(signal)?.version !== signal.getVersion?.()) {
          return true;
        }
      }

      return false;
    },
    update(dependencies: Set<Signal>) {
      // Search for existing and new signals
      for (const signal of dependencies) {
        let cached = cache.get(signal);
        if (!cached) {
          cached = {};
          cache.set(signal, cached);
        }

        cached.version = signal.getVersion?.();
      }

      // Search for signals that are no longer there
      for (const [key, value] of cache) {
        if (!cache.has(key)) {
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
