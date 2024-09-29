import { ActiveExternalState, Dependency, activeExternalState } from "./core";

export interface ActiveMapOptions<S extends (...params: any[]) => any> {
  createItem: S;
  gcTime?: number;
  onSubscribe?: (...params: Parameters<S>) => () => void;
}

export interface ActiveMap<S extends (...args: any[]) => any> {
  getOrCreate: (...params: Parameters<S>) => ReturnType<S>;
  filter: (predicate: (...params: Parameters<S>) => boolean) => ReturnType<S>[];
  set: (value: ReturnType<S>, ...params: Parameters<S>) => void;
  subscribe: (listener: () => void, ...params: Parameters<S>) => () => void;
}

export function activeMap<S extends (...params: any[]) => any>({
  createItem: initItem,
  gcTime = Number.POSITIVE_INFINITY,
  onSubscribe,
}: ActiveMapOptions<S>): ActiveMap<S> {
  type R = ReturnType<S>;
  type P = Parameters<S>;

  type CacheEntry = {
    data: R;
    version: number;
    topic: ActiveExternalState<number>;
  };
  const cache = new Map<string, CacheEntry>();

  function createCacheEntry(key: string, data: R, params: P) {
    let isSubscribed = false;
    let timeoutHandler: number | undefined;

    const entry: CacheEntry = {
      data,
      version: 0,
      topic: activeExternalState(
        () => entry.version,
        () => {
          isSubscribed = true;
          if (gcTime !== Number.POSITIVE_INFINITY) {
            stopTimer();
          }
          const unsbuscribe = onSubscribe?.(...params);

          return () => {
            isSubscribed = false;
            if (gcTime !== Number.POSITIVE_INFINITY) {
              startTimer();
            }
            unsbuscribe?.();
          };
        }
      ),
    };

    function startTimer() {
      if (gcTime === Number.POSITIVE_INFINITY) return;
      if (timeoutHandler) clearTimeout(timeoutHandler);
      timeoutHandler = setTimeout(onTimeout, gcTime) as any;
    }

    function stopTimer() {
      if (gcTime === Number.POSITIVE_INFINITY) return;
      if (timeoutHandler) clearTimeout(timeoutHandler);
      timeoutHandler = undefined;
    }

    function onTimeout() {
      timeoutHandler = undefined;
      entry.version += 1;
      cache.delete(key);
    }

    startTimer();

    return entry;
  }

  return {
    getOrCreate(...params: P): R {
      const key = hashQueryKey(params);
      let result = cache.get(key)!;
      if (!result) {
        result = createCacheEntry(key, initItem(...params), params);
        cache.set(key, result);
      }

      result.topic.get();
      return result.data;
    },
    set(value: R, ...params: P) {
      const key = hashQueryKey(params);
      let entry = cache.get(key)!;

      if (!entry) {
        cache.set(key, createCacheEntry(key, value, params));
      } else if (!Object.is(entry.data, value)) {
        entry.data = value;
        entry.version += 1;
        entry.topic?.notify();
      }
    },
    subscribe: (listener: () => void, ...params: P) => {
      const key = hashQueryKey(params);
      let entry = cache.get(key);
      if (!entry) {
        entry = createCacheEntry(key, initItem(...params), params);
        cache.set(key, entry);
      }
      return entry.topic.subscribe(listener);
    },
    filter(predicate: (...params: P) => boolean): R[] {
      const result = [];
      for (const [key, value] of cache.entries()) {
        if (predicate(...JSON.parse(key))) {
          result.push(value.data);
        }
      }
      return result;
    },
  };
}

type QueryKey = readonly unknown[];

//  https://github.com/TanStack/query/blob/main/packages/query-core/src/utils.ts#L269C1-L280C2
export function hashQueryKey(queryKey: QueryKey): string {
  return JSON.stringify(queryKey, (_, val) =>
    isPlainObject(val)
      ? Object.keys(val)
          .sort()
          .reduce((result, key) => {
            result[key] = val[key];
            return result;
          }, {} as any)
      : val
  );
}

// Copied from: https://github.com/jonschlinkert/is-plain-object
export function isPlainObject(o: any): o is Object {
  if (!hasObjectPrototype(o)) {
    return false;
  }

  // If has modified constructor
  const ctor = o.constructor;
  if (typeof ctor === "undefined") {
    return true;
  }

  // If has modified prototype
  const prot = ctor.prototype;
  if (!hasObjectPrototype(prot)) {
    return false;
  }

  // If constructor does not have an Object-specific method
  if (!prot.hasOwnProperty("isPrototypeOf")) {
    return false;
  }

  // Most likely a plain Object
  return true;
}

function hasObjectPrototype(o: any): boolean {
  return Object.prototype.toString.call(o) === "[object Object]";
}
