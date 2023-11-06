import { useSyncExternalStore, useMemo } from "react";
import shallowequal from "shallowequal";

import { compute } from "./core";
import { createDependenciesTracker } from "./create-dependencies-tracker";

export function useSelector<
  R extends NoFunctionsAllowed<R extends (...props: any) => any ? never : R>
>(selector: () => R) {
  const state = useMemo(createUseSelectorState, []);

  return useSyncExternalStore(state.subscribe, () =>
    state.getSnapshot(selector)
  );
}

function createUseSelectorState() {
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
      const { value, dependencies: topics } = compute(selector);
      dependencies.update(topics);

      if (onUpdated) {
        dependencies.subscribe();
      }

      if (!Object.is(cachedValue, value) && !shallowequal(cachedValue, value)) {
        cachedValue = value;
      }

      return cachedValue;
    },
  };
}

type NoFunctionsAllowed<T> = {
  [P in keyof T]: T[P] extends (...args: any) => any ? never : T[P];
};
