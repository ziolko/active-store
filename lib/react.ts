import {
  useSyncExternalStore,
  useMemo,
  useRef,
  useEffect,
  useState,
} from "react";
import shallowequal from "shallowequal";

import { compute } from "./core";
import { createDependenciesTracker } from "./create-dependencies-tracker";

export function useData<
  R extends NoFunctionsAllowed<R extends (...props: any) => any ? never : R>
>(selector: () => R): R {
  return useSelector(selector) as any;
}

export function useActions<
  R extends Record<string, (...args: any) => any> | ((...args: any) => any)
>(selector: () => R) {
  return useSelector(selector) as R;
}

export function useAsyncAction<S extends () => (...args: any) => Promise<any>>(
  selector: S
) {
  type MutationState = {
    status: "idle" | "pending" | "success" | "error";
    result?: ReturnType<ReturnType<S>> extends Promise<infer T>
      ? T
      : ReturnType<ReturnType<S>>;
    error?: any;
  };

  const action = useSelector(selector);
  const [state, setState] = useState<MutationState>({ status: "idle" });
  const lastCallIdRef = useRef(0);

  async function execute(...params: Parameters<ReturnType<S>>) {
    lastCallIdRef.current += 1;
    const callId = lastCallIdRef.current;
    try {
      setState((state) =>
        state.status === "pending" ? state : { status: "pending" }
      );
      const result = await action(...(params as any[]));
      if (lastCallIdRef.current === callId) {
        setState({ status: "success", result });
      }
    } catch (error: any) {
      if (lastCallIdRef.current === callId) {
        setState({ status: "error", error });
      }
    }
  }

  return { ...state, execute };
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
      const { value, topics } = compute(selector);
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

function useSelector<R>(selector: () => R) {
  const state = useMemo(createUseSelectorState, []);

  return useSyncExternalStore(state.subscribe, () =>
    state.getSnapshot(selector)
  );
}

type NoFunctionsAllowed<T> = {
  [P in keyof T]: T[P] extends (...args: any) => any ? never : T[P];
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
