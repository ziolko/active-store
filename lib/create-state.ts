import { activeExternalState } from "./core";
import { activeMap } from "./create-collection";

type ValueType<S> = S extends (...params: any) => infer V ? V : S;
type ParamsType<S> = S extends (...params: infer P) => any
  ? P
  : Parameters<() => void>;

export interface ActiveState<S extends (...params: any) => any> {
  get: (...params: Parameters<S>) => ReturnType<S>;
  set: (value: ReturnType<S>, ...params: Parameters<S>) => void;
  subscribe: (listener: () => void, ...params: Parameters<S>) => () => void;
}

export function activeState<S>(
  initialValue: S,
  options: {
    onSubscribe?: (...params: ParamsType<S>) => () => void;
    gcTime?: S extends (...params: any) => any ? number : never;
  } = {}
): S extends (...params: any) => any ? ActiveState<S> : ActiveState<() => S> {
  if (typeof initialValue === "function") {
    type S2 = S extends (...params: any) => any ? S : never;
    return activeComplexState(initialValue as S2, options) as any;
  }

  return activeSingleState(initialValue, options) as any;
}

function activeSingleState<V>(
  initialValue: V,
  options: {
    onSubscribe?: () => () => void;
  } = {}
): ActiveState<() => V> {
  type S = () => V;

  let value = initialValue as ValueType<S>;

  function setValue(newValue: ValueType<S>) {
    if (!Object.is(newValue, value)) {
      value = newValue;
      topic.notify();
    }
  }

  const topic = activeExternalState(
    () => value,
    (): (() => void) => {
      if (options?.onSubscribe) {
        return options?.onSubscribe();
      } else {
        return () => null;
      }
    }
  );

  const result: ActiveState<S> = {
    get: topic.get,
    set: setValue,
    subscribe: (listener: () => void) => topic.subscribe(() => listener()),
  };

  return result;
}

function activeComplexState<S extends (...args: any) => any>(
  factory: S,
  options: {
    onSubscribe?: (...params: Parameters<S>) => () => void;
    gcTime?: number;
  } = {}
): ActiveState<S> {
  const map = activeMap({
    createItem: factory,
    gcTime: options.gcTime,
    onSubscribe: options.onSubscribe,
  });

  return {
    get: map.getOrCreate,
    set: map.set,
    subscribe: map.subscribe,
  };
}
