import {
  activeExternalState,
  isRunningComputedPromise,
  isRunningReactSelector,
} from "./core";
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
  fetchStatus: "fetching" | "paused" | "idle";
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
  getAsync: (
    ...params: Parameters<S>
  ) => ReturnType<S> extends Promise<infer A> ? Promise<A> : never;
  state: (
    ...params: Parameters<S>
  ) => ReturnType<S> extends Promise<infer A> ? State<A> : never;
  refetch: (...params: Parameters<S>) => ReturnType<S>;
  invalidate: (
    predicate?: ((...params: Parameters<S>) => boolean) | true,
    options?: { reset?: boolean }
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
      // React suspense always re-renders the components instead of showing an error
      const promise = item.promiseForSuspense();
      const result = item.get();

      if (result.isSuccess) return result.data!;
      else if (result.isError) throw result.error!;
      else throw promise;
    },
    getAsync(...params: Parameters<S>) {
      return collection.getOrCreate(...(params as any)).promise();
    },
    state(...params: Parameters<S>) {
      const item = collection.getOrCreate(...(params as any));
      if (isRunningReactSelector.value || isRunningComputedPromise.value) {
        item.promiseForSuspense();
      }
      return item.get() as any;
    },
    refetch(...params: Parameters<S>) {
      return collection.getOrCreate(...(params as any)).fetch() as any;
    },
    async invalidate(
      predicate?: ((...params: Parameters<S>) => boolean) | true,
      options?: { reset?: boolean }
    ) {
      const promises: Promise<void>[] = [];
      predicate = typeof predicate === "function" ? predicate : () => true;
      for (const item of collection.filter(predicate)) {
        promises.push(item.invalidate(options?.reset));
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
  let currentPromiseForSuspense: any = null;

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
    currentPromiseForSuspense = null;

    const isInitialLoading = !currentState.isSuccess && !currentState.isError;

    currentState = {
      ...currentState,
      isPending: isInitialLoading,
      fetchStatus: "fetching",
      isFetching: true,
      isRefetching: !isInitialLoading,
    };

    state.notify();

    value.then(
      (data: any) => {
        if (value === currentPromise) {
          currentState = {
            status: "success",
            fetchStatus: "idle",
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
            status: "error",
            fetchStatus: "idle",
            isPending: false,
            isFetching: false,
            isRefetching: false,
            isSuccess: false,
            isError: true,
            isStale: false,
            error,
            errorUpdatedAt: Date.now(),
            data: currentState.data,
            dataUpdatedAt: currentState.dataUpdatedAt,
          };
          state.notify();
        }
      }
    );
    return value;
  }

  async function invalidate(reset?: boolean) {
    currentState = reset
      ? getFullState({ status: "pending" })
      : { ...currentState, isStale: true };
    currentPromise = null;
    currentPromiseForSuspense = null;
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
    promiseForSuspense: () => {
      if (!currentPromiseForSuspense) {
        const promise = getPromise().catch(() => null);
        currentPromiseForSuspense = Error(
          "Suspense Exception: This is not a real error! It's an implementation detail of `activeQuery` to interrupt the current render. You must rethrow it immediately. Capturing without rethrowing will lead to unexpected behavior.\n\nTo handle async errors, wrap your component in an ActiveBoundary."
        );
        currentPromiseForSuspense.then = Promise.prototype.then.bind(promise);
        currentPromiseForSuspense.catch = Promise.prototype.catch.bind(promise);
        currentPromiseForSuspense.finally =
          Promise.prototype.finally.bind(promise);
      }
      return currentPromiseForSuspense;
    },
    invalidate,
  };
}

function getFullState<R>(initialState: InitialState<R>): State<R> {
  if (initialState.status === "success") {
    return {
      status: "success",
      fetchStatus: "idle",
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
      fetchStatus: "idle",
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
    fetchStatus: "idle",
    isPending: true,
    isSuccess: false,
    isError: false,
    isFetching: false,
    isRefetching: false,
    isStale: false,
  };
}
