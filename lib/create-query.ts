import { activeExternalState } from "./core";
import { activeMap } from "./create-collection";

type State<R> = {
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  isRefetching: boolean;
  isFetching: boolean;
  isStale: boolean;
  data?: R;
  error?: any;
  dataUpdatedAt?: number;
  errorUpdatedAt?: number;
  status: "pending" | "success" | "error";
};

type InitialState<R> =
  | { status: "pending" }
  | {
      status: "success";
      data: R;
      isStale: boolean;
    }
  | { status: "error"; error: any; isStale: boolean };

type RetryDelayFunction<S extends (...args: any) => Promise<any>> = (
  retryAttempt: number,
  error: any
) => number | false | ((...params: Parameters<S>) => number | false);

export type ActiveQueryOptions<S extends (...args: any) => Promise<any>> = {
  gcTime?: number;
  initialState?: (
    ...params: Parameters<S>
  ) => InitialState<ReturnType<S> extends Promise<infer A> ? A : never>;
  retryDelay?: RetryDelayFunction<S>;
};

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
  options: ActiveQueryOptions<S> = {}
): ActiveQuery<S> {
  type P = Parameters<S>;
  type R = ReturnType<S> extends Promise<infer A> ? A : never;

  const collection = activeMap({
    createItem: (...params: P) => {
      const initialState = options.initialState?.(...params) ?? {
        status: "pending",
      };
      const getRetryDelay = (attempt: number, error: any) => {
        if (!options.retryDelay) {
          return attempt < 3 ? attempt * 1000 : false;
        }
        const result = options.retryDelay(attempt, error);
        return typeof result === "function" ? result(...params) : result;
      };
      const factoryWithRetry = (): Promise<R> => {
        function run(attempt: number): Promise<R> {
          let promise: Promise<R>;
          try {
            promise = factory(...(params as any));
          } catch (error) {
            // if error is thrown synchronously, convert it to exception
            promise = Promise.reject(error);
          }

          return promise.catch((error) => {
            const retryDelay = getRetryDelay(attempt + 1, error);
            if (retryDelay === false) {
              throw error;
            } else {
              return new Promise((res) => setTimeout(res, retryDelay)).then(
                () => run(attempt + 1)
              );
            }
          });
        }

        return run(0);
      };
      return createQuerySingle<R>(factoryWithRetry, initialState);
    },
    gcTime: options.gcTime ?? Number.POSITIVE_INFINITY,
  });

  const result = {
    type: "active-query" as const,
    get(...params: Parameters<S>) {
      const item = collection.getOrCreate(...(params as any));
      // Start fetching data if it's not fetching yet. Errors are caught so that
      // React suspense always renders the components
      const promise = item.promiseWithCatchErrors();
      const result = item.get();

      if (result.isSuccess) return result.data!;
      else if (result.isError) throw result.error!;
      else throw promise;
    },
    state(...params: Parameters<S>) {
      const item = collection.getOrCreate(...(params as any));
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
  initialState: InitialState<R>
) {
  let isSubscribed = false;
  let currentState = getFullState(initialState);
  let currentPromise: any = null;
  let currentPromiseWithCatchErrors: any = null;

  if (currentState.isSuccess && !currentState.isStale) {
    currentPromise = Promise.resolve(currentState.data);
  }

  if (currentState.isError && !currentState.isStale) {
    currentPromise = Promise.reject(currentState.error);
  }

  const state = activeExternalState(
    function get() {
      return currentState;
    },
    function onSubscribe() {
      setTimeout(() => (currentPromise ? null : fetch()), 0);
      isSubscribed = true;
      return () => {
        isSubscribed = false;
      };
    }
  );

  function fetch() {
    let value: Promise<R>;
    try {
      value = factory();
    } catch (error) {
      value = Promise.reject(error);
    }
    currentPromise = value;

    const isInitialLoading = !currentState.isSuccess && !currentState.isError;

    currentState = {
      ...currentState,
      isPending: isInitialLoading,
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
            isFetching: false,
            isRefetching: false,
            isSuccess: true,
            isError: false,
            isStale: false,
            data,
            dataUpdatedAt: Date.now(),
          };
          state.notify();
        }
      },
      (error: any) => {
        if (value === currentPromise) {
          currentState = {
            status: error,
            isPending: false,
            isFetching: false,
            isRefetching: false,
            isSuccess: false,
            isError: true,
            isStale: false,
            error,
            errorUpdatedAt: Date.now(),
          };
          state.notify();
        }
      }
    );
    return value;
  }

  async function invalidate() {
    currentState = { ...currentState, isStale: true };
    currentPromise = null;
    currentPromiseWithCatchErrors = null;
    if (isSubscribed) {
      await fetch();
    }
  }

  const getPromise = () => currentPromise ?? fetch();

  return {
    get: state.get,
    subscribe: state.subscribe,
    fetch,
    promise: getPromise,
    promiseWithCatchErrors: () => {
      if (!currentPromiseWithCatchErrors) {
        currentPromiseWithCatchErrors = getPromise().catch(() => null);
      }
      return currentPromiseWithCatchErrors;
    },
    invalidate,
  };
}

function getFullState<R>(initialState: InitialState<R>): State<R> {
  if (initialState.status === "success") {
    return {
      status: "success",
      isPending: false,
      isSuccess: true,
      isError: false,
      isFetching: false,
      isRefetching: false,
      data: initialState.data,
      dataUpdatedAt: Date.now(),
      isStale: initialState.isStale,
    };
  }

  if (initialState.status === "error") {
    return {
      status: "error",
      isPending: false,
      isSuccess: false,
      isError: true,
      isFetching: false,
      isRefetching: false,
      error: initialState.error,
      errorUpdatedAt: Date.now(),
      isStale: initialState.isStale,
    };
  }

  return {
    status: "pending",
    isPending: true,
    isSuccess: false,
    isError: false,
    isFetching: false,
    isRefetching: false,
    isStale: false,
  };
}
