import { activeTopic } from "./core";
import { activeMap } from "./create-collection";

export interface ActiveExternalState<S extends (...args: any) => any> {
  get: (
    ...params: Parameters<S>
  ) => ReturnType<S> extends Promise<infer A> ? A : never;
  notify: (...params: Parameters<S>) => void;
  subscribe: (listener: () => void, ...params: Parameters<S>) => () => void;
}

export function activeExternalState<S extends (...args: any) => any>(
  factory: S,
  options: {
    onSubscribe?: (...params: Parameters<S>) => () => void;
    gcTime?: number;
  } = {}
): ActiveExternalState<S> {
  type P = Parameters<S>;

  function createItem(...params: P) {
    const onSubscribe = options.onSubscribe ?? (() => () => null);
    return activeTopic(
      () => factory(...params),
      () => onSubscribe(...params)
    );
  }

  const map = activeMap({
    createItem,
    gcTime: options.gcTime,
  });

  return {
    get: (...params: P) => map.getOrCreate(...params).get(),
    notify: (...params: P) => map.getOrCreate(...params).notify(),
    subscribe: (listener: () => void, ...params: P) => {
      const unsubscribeMap = map.subscribe(listener, ...params);
      const unsubscribeItem = map.getOrCreate(...params).subscribe(listener);
      return () => {
        unsubscribeItem();
        unsubscribeMap();
      };
    },
  };
}
