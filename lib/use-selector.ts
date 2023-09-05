import {
  useSyncExternalStore,
  useMemo,
  useRef,
  useEffect,
  useState,
} from "react";
import shallowequal from "shallowequal";

import { execute } from "./core";
import { createDependenciesTracker } from "./create-dependencies-tracker";

export function useData<
  R extends NoFunctionsAllowed<R extends (...props: any) => any ? never : R>
>(selector: () => R): R {
  return useSelector(selector) as any;
}

export function useActions<R extends OnlyFunctionsAllowed<R>>(
  selector: () => R
) {
  return useSelector(selector);
}

function createUseSelectorState() {
  let onUpdated: any;
  let dependencies = createDependenciesTracker(() => onUpdated());
  let cachedValue: any = undefined;

  return {
    subscribe(updated: () => void) {
      onUpdated = updated;
      dependencies.subscribe();

      return () => {
        dependencies?.unsubscribe();
        onUpdated = null;
      };
    },
    getSnapshot(selector: () => any) {
      const { value, signals } = execute(selector);
      dependencies.update(signals);

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

function useSelector<R>(selector: () => R) {
  const state = useMemo(createUseSelectorState, []);

  return useSyncExternalStore(state.subscribe, () =>
    state.getSnapshot(selector)
  );
}

type NoFunctionsAllowed<T> = {
  [P in keyof T]: T[P] extends (...args: any) => any ? never : T[P];
};

type OnlyFunctionsAllowed<T> = {
  [P in keyof T]: T[P] extends (...args: any) => any ? T[P] : never;
};

export function useStaleWhileRevalidate<T>(value: T, isValid: boolean) {
  const cache = useRef(value);
  useEffect(() => {
    if (isValid) {
      cache.current = value;
    }
  }, [isValid, value]);
  return isValid ? value : cache.current;
}

export function useMutation<S extends () => any>(action: S) {
  const [state, setState] = useState({
    status: "idle",
    result: undefined,
    error: undefined,
  });

  function execute() {
    // TODO: Implement mutation hook (asnyc)
  }

  return { ...state, execute };
}
