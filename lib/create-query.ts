import { activeTopic, compute } from "./core";
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

export type ActiveQueryOptions<S extends (...args: any) => Promise<any>> = {
  gcTime?: number;
  retry?: number | false;
  initialState?: (
    ...params: Parameters<S>
  ) => InitialState<ReturnType<S> extends Promise<infer A> ? A : never>;
  onSubscribe?: (...params: Parameters<S>) => () => void;
};

export interface ActiveQuery<S extends (...args: any) => Promise<any>> {
  get: (
    ...params: Parameters<S>
  ) => ReturnType<S> extends Promise<infer A> ? A : never;
  getAsync: (
    ...params: Parameters<S>
  ) => ReturnType<S> extends Promise<infer A> ? Promise<A> : never;
  prefetch: (
    ...params: Parameters<S>
  ) => ReturnType<S> extends Promise<infer A> ? State<A> : never;
  state: (
    ...params: Parameters<S>
  ) => ReturnType<S> extends Promise<infer A> ? State<A> : never;
  setState: (
    state: InitialState<ReturnType<S> extends Promise<infer A> ? A : never>,
    ...params: Parameters<S>
  ) => void;
  invalidateOne: (...params: Parameters<S>) => Promise<void>;
  invalidate: (
    predicate?: ((...params: Parameters<S>) => boolean) | true,
    options?: { reset?: boolean }
  ) => Promise<void>;
  subscribe: (listener: () => void, ...params: Parameters<S>) => () => void;
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

      function onSubscribe() {
        if (typeof options.onSubscribe === "function") {
          return options.onSubscribe(...params);
        } else {
          return () => null;
        }
      }

      return createQuerySingle<R>(
        withRetry(
          () => factory(...(params as any[])),
          (options.retry ?? 2) || 0
        ),
        initialState,
        onSubscribe
      );
    },
    gcTime: options.gcTime ?? Number.POSITIVE_INFINITY,
  });

  const result: ActiveQuery<S> = {
    get(...params: Parameters<S>) {
      const item = collection.getOrCreate(...(params as any));
      // Start fetching data if it's not fetching yet. Errors are caught so that
      // React suspense always re-renders the components instead of showing an error
      const promise = item.promiseForSuspense(params);
      const result = item.get();

      if (result.isSuccess) return result.data!;
      else if (result.isError) throw result.error!;
      else throw promise;
    },
    getAsync(...params: Parameters<S>) {
      return collection.getOrCreate(...(params as any)).promise();
    },
    prefetch(...params: Parameters<S>) {
      const item = collection.getOrCreate(...(params as any));
      // Start fetching data if it's not fetching yets
      item.promiseForSuspense(params);
      return item.get() as any;
    },
    state(...params: Parameters<S>) {
      const item = collection.getOrCreate(...(params as any));
      // Start fetching data if it's not fetching yets
      item.promiseForSuspense(params);
      return item.get() as any;
    },
    setState(state: InitialState<R>, ...params: Parameters<S>) {
      collection.getOrCreate(...(params as any)).setState(state);
    },
    invalidateOne(...params: Parameters<S>) {
      return collection.getOrCreate(...(params as any)).invalidate();
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
    subscribe(listener: () => void, ...params: Parameters<S>) {
      const unsubscribe1 = collection.subscribe(listener, ...params);
      const unsubscribe2 = collection
        .getOrCreate(...params)
        .subscribe(listener);

      return () => {
        unsubscribe2();
        unsubscribe1();
      };
    },
  };

  return result;
}

function createQuerySingle<R>(
  factory: () => R | Promise<R>,
  initialState: InitialState<R>,
  onSubscribeParam: () => () => void
) {
  let isSubscribed = false;
  let currentState = getFullState(initialState);
  let currentPromise: any = null;
  let currentPromiseForSuspense: any = null;

  if (currentState.isSuccess) {
    currentPromise = Promise.resolve(currentState.data);
  }

  if (currentState.isError) {
    currentPromise = Promise.reject(currentState.error);
    currentPromise.catch(() => null); // prevent "unhandled rejection" error
  }

  const state = activeTopic(
    function get() {
      return currentState;
    },
    function onSubscribe() {
      setTimeout(() => fetchIfNeedRefresh().catch(() => null), 0);
      isSubscribed = true;
      const unsubscribe = onSubscribeParam();
      return () => {
        isSubscribed = false;
        unsubscribe();
      };
    }
  );

  function fetchIfNeedRefresh() {
    // Return cached promise if it's already fetching
    if (currentPromise && (currentState.isFetching || !currentState.isStale)) {
      return currentPromise;
    }

    const isInitialLoading = !currentState.isSuccess && !currentState.isError;
    currentState = {
      ...currentState,
      isPending: isInitialLoading,
      fetchStatus: "fetching",
      isFetching: true,
      isRefetching: !isInitialLoading,
    };

    const { value, error } = compute(factory, { trackDependencies: false });

    currentPromise = null;
    currentPromiseForSuspense = null;

    if (error) {
      currentPromise = Promise.reject(error);
      setError(error);
      return currentPromise;
    }

    const isPromise =
      value instanceof Promise || typeof (value as any)?.then === "function";

    if (!value || !isPromise) {
      currentPromise = Promise.resolve(value);
      setSuccess(value);
      return currentPromise;
    }

    currentPromise = value;
    state.notify();

    //@ts-expect-error
    value.then(
      (data: any) => value === currentPromise && setSuccess(data),
      (error: any) => value === currentPromise && setError(error)
    );
    return value;
  }

  function setSuccess(data: any) {
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

  function setError(error: any) {
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

  async function invalidate(reset?: boolean) {
    currentState = reset
      ? getFullState({ status: "pending" })
      : { ...currentState, isStale: true };
    currentPromise = null;
    currentPromiseForSuspense = null;
    if (isSubscribed) {
      await fetchIfNeedRefresh().catch(() => null);
    }
  }

  async function setState(newState: InitialState<R>) {
    currentState = getFullState(newState);
    currentPromise = null;
    currentPromiseForSuspense = null;

    if (currentState.isSuccess) {
      currentPromise = Promise.resolve(currentState.data);
    }

    if (currentState.isError) {
      currentPromise = Promise.reject(currentState.error);
      currentPromise.catch(() => null); // prevent "unhandled rejection" error
    }

    if (isSubscribed) {
      fetchIfNeedRefresh().catch(() => null);
    }

    state.notify();
  }

  return {
    get: state.get,
    subscribe: state.subscribe,
    promise: fetchIfNeedRefresh,
    promiseForSuspense: (params: any[]) => {
      if (!currentPromiseForSuspense) {
        const promise = fetchIfNeedRefresh().then(
          () => null,
          () => null
        );
        currentPromiseForSuspense = Error(
          `activeQuery is still fetching data for params: (${params.join(
            ", "
          )}). If you've got this error in React component or 'activeComputed' you must rethrow it immediately. Otherwise use 'getActive' to wait for the requested value.`
        );
        currentPromiseForSuspense.then = Promise.prototype.then.bind(promise);
        currentPromiseForSuspense.catch = Promise.prototype.catch.bind(promise);
        currentPromiseForSuspense.finally =
          Promise.prototype.finally.bind(promise);
      }
      return currentPromiseForSuspense;
    },
    invalidate,
    setState,
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

function withRetry<S extends () => Promise<any>>(
  factory: S,
  retryCount: number
) {
  function run(attempt: number): Promise<any> {
    let promise = null;
    try {
      promise = Promise.resolve(factory());
    } catch (error) {
      promise = Promise.reject(error);
    }
    return promise.catch((error) => {
      // Don't retry when suspense error - it should surface immediatelly
      // to get developer's attention
      if (error instanceof Promise || typeof error?.then === "function") {
        throw error;
      }

      const retryDelay = attempt < retryCount ? (attempt + 1) * 1000 : 0;
      if (!retryDelay) {
        throw error;
      } else {
        const wait = new Promise((res) => setTimeout(res, retryDelay));
        return wait.then(() => run(attempt + 1));
      }
    });
  }
  return () => run(0);
}
