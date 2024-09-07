import { Dependency, activeExternalState } from "./core";

export interface ActiveMapOptions<S extends (...params: any) => any> {
  createItem: S;
  gcTime?: number;
  gcCallback?: (...params: Parameters<S>) => void;
}

export interface ActiveMap<S extends (...args: any) => any> {
  type: "active-map";
  has: (...params: Parameters<S>) => boolean;
  set: (...params: Parameters<S>) => { value: (value: ReturnType<S>) => void };
  getOrCreate: (...params: Parameters<S>) => ReturnType<S>;
  filter: (predicate: (...params: Parameters<S>) => boolean) => ReturnType<S>[];
}

export function activeMap<S extends (...params: any) => any>({
  createItem: initItem,
  gcTime = Number.POSITIVE_INFINITY,
  gcCallback,
}: ActiveMapOptions<S>): ActiveMap<S> {
  type R = ReturnType<S>;
  type P = Parameters<S>;

  type CacheEntry = { data: R; topic?: Dependency };
  const cache = new Map<string, CacheEntry>();

  function createCacheEntry(key: string, data: R) {
    const entry: CacheEntry = { data };

    if (gcTime === Number.POSITIVE_INFINITY) {
      return entry;
    }

    let isSubscribed = false;
    let version = 0;
    entry.topic = activeExternalState(
      () => version,
      () => {
        isSubscribed = true;
        stopTimer();
        return () => {
          isSubscribed = false;
          startTimer();
        };
      }
    );

    let timeoutHandler: number | undefined;

    function startTimer() {
      if (timeoutHandler) {
        clearTimeout(timeoutHandler);
      }
      timeoutHandler = setTimeout(onTimeout, gcTime) as any;
    }

    function stopTimer() {
      if (timeoutHandler) {
        clearTimeout(timeoutHandler);
      }
      timeoutHandler = undefined;
    }

    function onTimeout() {
      timeoutHandler = undefined;
      if (!isSubscribed) {
        gcCallback?.(...JSON.parse(key));
      }

      // Ensure that nobody subscribed in gcCallback
      if (!isSubscribed) {
        cache.delete(key);
        version += 1;
      }
    }

    startTimer();

    return entry;
  }

  return {
    type: "active-map" as const,
    has(...params: P[]): boolean {
      return cache.has(hashQueryKey(params));
    },
    getOrCreate(...params: P[]): R {
      const key = hashQueryKey(params);
      let result = cache.get(key)!;
      if (!cache.has(key)) {
        result = createCacheEntry(key, initItem(...params));
        cache.set(key, result);
      }

      result.topic?.get();
      return result.data;
    },
    set(...params: P) {
      return {
        value: (value: R) => {
          const key = hashQueryKey(params);
          let result = cache.get(key)!;
          if (!cache.has(key)) {
            result = createCacheEntry(key, value);
            cache.set(key, result);
          }
        },
      };
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
