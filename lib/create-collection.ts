import { Dependency, activeExternalState } from "./core";

export interface CollectionOptions {
  inertia?: number;
}

export function activeCollection<S extends (...params: any) => any>(
  selector: S,
  options: CollectionOptions = {}
) {
  type R = ReturnType<S>;
  type P = Parameters<S>;

  type CacheEntry = { data: R; topic?: Dependency };
  const cache = new Map<string, CacheEntry>();

  function createCacheEntry(key: string, params: any) {
    const entry: CacheEntry = { data: selector(...params) };

    if (options.inertia == null) {
      return entry;
    }

    let version = 0;
    entry.topic = activeExternalState(
      () => version,
      () => {
        stopTimer();
        return startTimer;
      }
    );

    let timeoutHandler: number | undefined;

    function startTimer() {
      clearTimeout(timeoutHandler);
      timeoutHandler = setTimeout(onTimeout, options.inertia) as any;
    }

    function stopTimer() {
      clearTimeout(timeoutHandler);
      timeoutHandler = undefined;
    }

    function onTimeout() {
      cache.delete(key);
      version += 1;
    }

    startTimer();

    return entry;
  }

  return {
    get(...params: P): R {
      const key = hashQueryKey(params);
      let result = cache.get(key)!;
      if (!cache.has(key)) {
        result = createCacheEntry(key, params);
        cache.set(key, result);
      }

      result.topic?.get();
      return result.data;
    },
    getAll() {
      const result = new Set<R>();
      for (const entry of cache.values()) {
        result.add(entry.data);
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
