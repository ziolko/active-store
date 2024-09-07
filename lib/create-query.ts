import { activeExternalState, isRunningQuerySelector } from "./core";
import { activeMap } from "./create-collection";
import { activeState } from "./create-state";

type State<T> = {
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  isLoading: boolean;
  isRefetching: boolean;
  isFetching: boolean;
  isStale: boolean;
  data?: T;
  error?: any;
  status: "pending" | "success" | "error";
};

export interface QueryOptions<S extends (...args: any) => Promise<any>> {
  gcTime?: number;
  // TODO: implement options below
  // initialData?: ReturnType<S> extends Promise<infer A>
  //   ? A | ((...params: Parameters<S>) => boolean)
  //   : never;
  // refetchOnWindowFocus?: boolean | ((...params: Parameters<S>) => boolean);
  // refetchOnReconnect?: boolean | ((...params: Parameters<S>) => boolean);
  // refetchInterval?: number | false;
  // refetchIntervalInBackground?: boolean;
}

export interface ActiveQuery<S extends (...args: any) => Promise<any>> {
  type: "active-query";
  get: (
    ...params: Parameters<S>
  ) => ReturnType<S> extends Promise<infer A> ? A : never;
  state: (
    ...params: Parameters<S>
  ) => ReturnType<S> extends Promise<infer A> ? State<A> : never;
  refetch: (...params: Parameters<S>) => ReturnType<S>;
  invalidate: (
    predicate: (...params: Parameters<S>) => boolean
  ) => Promise<void>;
}

export function activeQuery<S extends (...args: any) => Promise<any>>(
  factory: S,
  { gcTime = Number.POSITIVE_INFINITY }: QueryOptions<S> = {}
): ActiveQuery<S> {
  type P = Parameters<S>;
  type R = ReturnType<S> extends Promise<infer A> ? A : never;

  const collection = activeMap({
    createItem: (...params: P) =>
      createQuerySingle<R>(() => factory(...(params as any)), { gcTime }),
    gcTime: gcTime,
  });

  const result = {
    type: "active-query" as const,
    get(...params: Parameters<S>) {
      const item = collection.getOrCreate(...(params as any));
      const promise = item.promise(); // start fetching data if it's not fetching yet
      const result = item.get();

      if (result.isSuccess) return result.data!;
      else if (result.isError) throw result.error!;
      else throw promise;
    },
    state(...params: Parameters<S>) {
      const item = collection.getOrCreate(...(params as any));
      item.promise(); // start fetching data if it's not fetching yet
      return item.get() as any;
    },
    refetch(...params: Parameters<S>) {
      return collection.getOrCreate(...(params as any)).fetch() as any;
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
  options: { gcTime: number }
) {
  const initialState: State<R> = {
    status: "pending",
    isPending: true,
    isSuccess: false,
    isError: false,
    isLoading: false,
    isFetching: false,
    isRefetching: false,
    isStale: false,
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
      handleRefetchHooks({ clear: true, setup: true });
      isSubscribed = true;
      return () => {
        handleRefetchHooks({ clear: true, setup: false });
        isSubscribed = false;
        return null;
      };
    }
  );

  function fetch() {
    handleRefetchHooks({ clear: true, setup: true });

    let value: Promise<R>;
    let wasRunningQuerySelector = isRunningQuerySelector.value;
    try {
      isRunningQuerySelector.value = true;
      value = factory();
      isRunningQuerySelector.value = wasRunningQuerySelector;
    } catch (error) {
      isRunningQuerySelector.value = wasRunningQuerySelector;
      value = Promise.reject(error);
    }
    currentPromise = value;

    const isInitialLoading = !currentState.isSuccess && !currentState.isError;

    currentState = {
      ...currentState,
      isPending: isInitialLoading,
      isLoading: isInitialLoading,
      isFetching: true,
      isRefetching: !isInitialLoading,
    };

    state.notify();

    value.then(
      (data: any) => {
        if (value === currentPromise) {
          currentState = {
            status: "success",
            isPending: false,
            isLoading: false,
            isFetching: false,
            isRefetching: false,
            isSuccess: true,
            isError: false,
            isStale: false,
            data,
          };
          state.notify();
        }
      },
      (error: any) => {
        if (value === currentPromise) {
          currentState = {
            status: error,
            isPending: false,
            isLoading: false,
            isFetching: false,
            isRefetching: false,
            isSuccess: false,
            isError: true,
            isStale: false,
            error,
          };
          state.notify();
        }
      }
    );
    return value;
  }

  function handleRefetchHooks(opts: { clear: boolean; setup: boolean }) {
    if (opts.clear && timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }

    if (opts.setup && options.gcTime !== Number.POSITIVE_INFINITY) {
      timeoutHandle = setTimeout(() => fetch(), options.gcTime) as any;
    }
  }

  async function invalidate() {
    currentState = currentState = { ...currentState, isStale: true };
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
