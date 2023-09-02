export function createCollection<S extends (...params: any) => any>(
  selector: S
) {
  type R = ReturnType<S>;
  type P = Parameters<S>;

  const dataCache = new Map<string, R>();

  return {
    get(...params: P): R {
      const key = hashQueryKey(params);
      let result = dataCache.get(key)!;
      if (!result && !dataCache.has(key)) {
        result = selector(...(params as any));
        dataCache.set(key, result);
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
