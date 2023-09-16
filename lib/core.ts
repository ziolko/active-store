export function createExternalState<R = any>(
  get: () => R,
  onSubscribe: (notify: () => void) => () => void
) {
  let listenerCount = 0;
  let unsubscribe: (() => void) | void;

  const listeners = new Map();

  function notify() {
    for (const entry of listeners) {
      entry[1](result);
    }
  }

  const result = {
    get() {
      currentDependencies?.add(result as any);
      return get();
    },
    notify,
    subscribe(listener: (dependency: Dependency) => void) {
      const id = listenerCount++;

      if (listeners.size === 0) {
        unsubscribe = onSubscribe?.(notify);
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

export interface Dependency {
  get: () => unknown;
  subscribe: (listener: (dependency: Dependency) => any) => () => void;
}

let currentDependencies: Set<Dependency> | null = null;

export interface ComputeOptions {
  trackDependencies?: boolean;
}

export function compute<R>(
  selector: () => R,
  { trackDependencies = true }: ComputeOptions = {}
) {
  const previousDependencies = currentDependencies;

  try {
    const dependencies = trackDependencies ? new Set<Dependency>() : null;
    currentDependencies = dependencies;
    return { value: selector() as R, dependencies: dependencies ?? new Set() };
  } finally {
    currentDependencies = previousDependencies;
  }
}
