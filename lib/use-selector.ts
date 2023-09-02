import { useState, useEffect } from "react";
import { Signal, execute } from "./core";
import { SignalDescription, updateCachedDependencies } from "./create-computed";

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

type NoFunctionsAllowed<T> = {
  [P in keyof T]: T[P] extends (...args: any) => any ? never : T[P];
};

type OnlyFunctionsAllowed<T> = {
  [P in keyof T]: T[P] extends (...args: any) => any ? T[P] : never;
};

function useSelector<R>(selector: () => R) {
  const [state, updateState] = useState<{
    version: number;
    cachedSignals: Map<Signal, SignalDescription>;
  }>({} as any);

  const { value, signals } = execute(selector);
  const versions = new Map<Signal, number>();

  for (const signal of signals) {
    versions.set(signal, signal.getVersion());
  }

  useEffect(() => {
    state.version = 0;
    state.cachedSignals = new Map();

    return () => {
      for (const signal of state.cachedSignals.values()) {
        signal.unsubscribe?.();
      }
      state.cachedSignals.clear();
    };
  }, []);

  useEffect(() => {
    const forceRerender = () =>
      updateState((state: any) => ({ ...state, version: state.version + 1 }));

    for (const signal of signals) {
      if (versions.get(signal) !== signal.getVersion()) {
        return forceRerender();
      }
    }

    updateCachedDependencies(state.cachedSignals, signals, forceRerender);
  });

  return value;
}
