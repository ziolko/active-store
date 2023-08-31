import { useState, useEffect } from "react";
import { Effect, execute } from "./core";
import { EffectDescription, updateCachedEffects } from "./create-computed";

export function useData<R extends NoFunctionsAllowed<R>>(selector: () => R): R {
  return useSelector(selector);
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
    cachedEffects: Map<Effect, EffectDescription>;
  }>({} as any);

  const { value, effects } = execute(selector);
  const versions = new Map<Effect, number>();

  for (const effect of effects) {
    versions.set(effect, effect.getVersion());
  }

  useEffect(() => {
    state.version = 0;
    state.cachedEffects = new Map();

    return () => {
      for (const effect of state.cachedEffects.values()) {
        effect.unsubscribe?.();
      }
      state.cachedEffects.clear();
    };
  }, []);

  useEffect(() => {
    const forceRerender = () =>
      updateState((state: any) => ({ ...state, version: state.version + 1 }));

    for (const effect of effects) {
      if (versions.get(effect) !== effect.getVersion()) {
        return forceRerender();
      }
    }

    updateCachedEffects(state.cachedEffects, effects, forceRerender);
  });

  return value;
}
