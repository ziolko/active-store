import { useState, useEffect } from "react";
import { Signal, execute } from "./core";
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

function useSelector<R>(selector: () => R) {
  const [state, updateState] = useState({
    version: NaN,
    dependencies: createDependenciesTracker(),
  });

  const { value, signals } = execute(selector);
  const versions = new Map<Signal, number>();

  for (const signal of signals) {
    versions.set(signal, signal.getVersion());
  }

  useEffect(() => {
    state.version = 0;
    return () => {
      state.dependencies.unsubscribe();
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

    state.dependencies.update(signals);
    state.dependencies.subscribe(forceRerender);
  });

  return value;
}

type NoFunctionsAllowed<T> = {
  [P in keyof T]: T[P] extends (...args: any) => any ? never : T[P];
};

type OnlyFunctionsAllowed<T> = {
  [P in keyof T]: T[P] extends (...args: any) => any ? T[P] : never;
};
