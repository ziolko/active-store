import { useSyncExternalStore, useState } from "react";
import shallowequal from "shallowequal";

import { compute, isRunningReactSelector } from "./core";
import { createDependenciesTracker } from "./create-dependencies-tracker";

type ExcludeMethods<T> = {
  [P in keyof T]: T[P] extends Function ? never : ExcludeMethods<T[P]>;
};

export function useActive<R>(
  selector: { get: () => R } | (() => R extends Function ? never : R)
): ExcludeMethods<R> {
  const [state] = useState(createActiveSelectorState);
  const result = useSyncExternalStore(state.subscribe, () =>
    state.getSnapshot(typeof selector === "function" ? selector : selector.get)
  );

  if (typeof (result as any)?.then === "function") {
    throw result;
  }

  return result;
}

function createActiveSelectorState() {
  let onUpdated: any;
  let dependencies = createDependenciesTracker(() => onUpdated?.());
  let cachedValue: any = undefined;
  let subscriptionsCount = 0;

  return {
    subscribe(updated: () => void) {
      onUpdated = updated;
      dependencies.subscribe();
      subscriptionsCount += 1;

      return () => {
        // Unsubscribe in the next tick so that we don't
        // refetch data if data is resubscribed in the same render
        setTimeout(() => {
          subscriptionsCount -= 1;
          if (subscriptionsCount === 0) {
            dependencies?.unsubscribe();
            onUpdated = null;
          }
        }, 0);
      };
    },
    getSnapshot(selector: () => any) {
      let wasRunningReactSelector = isRunningReactSelector.value;
      try {
        isRunningReactSelector.value = true;
        const { value, error, dependencies: topics } = compute(selector);

        dependencies.update(topics);

        if (onUpdated) {
          dependencies.subscribe();
        }

        if (typeof (error as any)?.then === "function") {
          return error;
        }

        if (error) {
          throw error;
        }

        if (
          !Object.is(cachedValue, value) &&
          !shallowequal(cachedValue, value)
        ) {
          cachedValue = value;
        }

        return cachedValue;
      } finally {
        isRunningReactSelector.value = wasRunningReactSelector;
      }
    },
  };
}
