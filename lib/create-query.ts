import { activeExternalState } from "./core";
import { activeCollection } from "./create-collection";

type State<T> = {
  hasData: boolean;
  hasError: boolean;
  isLoadingInitial: boolean;
  isLoadingUpdate: boolean;
  data?: T;
  error?: any;
  status: "pending" | "success" | "error";
};

export interface QueryOptions {
  ttl?: number;
}

export interface ActiveQuery<S extends (...args: any) => Promise<any>> {
  get: (
    ...params: Parameters<S>
  ) => ReturnType<S> extends Promise<infer A> ? A : never;
  state: (
    ...params: Parameters<S>
  ) => ReturnType<S> extends Promise<infer A> ? State<A> : never;
  fetch: (...params: Parameters<S>) => ReturnType<S>;
}

export function activeQuery<S extends (...args: any) => Promise<any>>(
  factory: S,
  options: QueryOptions = {}
): ActiveQuery<S> {
  type P = Parameters<S>;
  type R = ReturnType<S> extends Promise<infer A> ? A : never;

  const collection = activeCollection(
    (...params: P) =>
      createQuerySingle<R>(() => factory(...(params as any)), options),
    { inertia: options.ttl }
  );

  const result = {
    get(...params: Parameters<S>) {
      const item = collection.get(...(params as any));
      const promise = item.promise(); // start fetching data if it's not fetching yet
      const result = item.get();

      if (result.hasData) return result.data!;
      else if (result.hasError) throw result.error!;
      else throw promise;
    },
    state(...params: Parameters<S>) {
      const item = collection.get(...(params as any));
      item.promise(); // start fetching data if it's not fetching yet
      return item.get() as any;
    },
    fetch(...params: Parameters<S>) {
      return collection.get(...(params as any)).fetch() as any;
    },
    async invalidate(predicate: (...params: Parameters<S>) => boolean) {
      const promises: Promise<void>[] = [];
      for (const item of collection.filter(predicate)) {
        promises.push(item.invalidate());
      }
      await Promise.all(promises);
    },
  };

  return result;
}

function createQuerySingle<R>(
  factory: () => Promise<R>,
  options: QueryOptions
) {
  const initialState: State<R> = {
    status: "pending",
    isLoadingInitial: false,
    isLoadingUpdate: false,
    hasData: false,
    hasError: false,
  };

  let isSubscribed = false;
  let currentPromise: any = null;
  let currentState = initialState;
  let timeoutHandle: number | null = null;

  const state = activeExternalState(
    function get() {
      return currentState;
    },
    function onSubscribe() {
      setTimeout(() => currentPromise ?? fetch(), 0);
      if (options.ttl) {
        timeoutHandle = setTimeout(() => fetch(), options.ttl) as any;
      }
      isSubscribed = true;
      return () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        timeoutHandle = null;
        isSubscribed = false;
        return null;
      };
    }
  );

  function fetch() {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = setTimeout(() => fetch(), options.ttl) as any;
    }

    let value: Promise<R>;
    try {
      value = factory();
    } catch (error) {
      value = Promise.reject(error);
    }
    currentPromise = value;

    const isInitialLoading = !currentState.hasData && !currentState.hasError;

    currentState = {
      ...currentState,
      isLoadingInitial: isInitialLoading,
      isLoadingUpdate: !isInitialLoading,
    };

    state.notify();

    value.then(
      (data: any) => {
        if (value === currentPromise) {
          currentState = {
            status: "success",
            isLoadingInitial: false,
            isLoadingUpdate: false,
            hasData: true,
            hasError: false,
            data,
          };
          state.notify();
        }
      },
      (error: any) => {
        if (value === currentPromise) {
          currentState = {
            status: error,
            isLoadingInitial: false,
            isLoadingUpdate: false,
            hasData: false,
            hasError: true,
            error,
          };
          state.notify();
        }
      }
    );
    return value;
  }

  async function invalidate() {
    currentState = initialState;
    currentPromise = null;
    if (isSubscribed) {
      await fetch();
    }
  }

  return {
    get: state.get,
    subscribe: state.subscribe,
    promise: () => currentPromise ?? fetch(),
    fetch,
    invalidate,
  };
}
