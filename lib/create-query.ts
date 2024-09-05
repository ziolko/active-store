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
      const result = item.get();

      if (result.hasData) return result.data!;
      else if (result.hasError) throw result.error!;
      else throw item.promise();
    },
    state(...params: Parameters<S>) {
      const item = collection.get(...(params as any));
      return item.get() as any;
    },
    fetch(...params: Parameters<S>) {
      return collection.get(...(params as any)).fetch() as any;
    },
  };

  return result;
}

function createQuerySingle<R>(
  factory: () => Promise<R>,
  options: QueryOptions
) {
  let currentPromise: any = null;
  let currentState: State<R> = {
    status: "pending",
    isLoadingInitial: false,
    isLoadingUpdate: false,
    hasData: false,
    hasError: false,
  };
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
      return () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        timeoutHandle = null;
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
      debugger;
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
          currentState = currentState = {
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

  return {
    get: state.get,
    subscribe: state.subscribe,
    promise: () => currentPromise ?? fetch(),
    fetch,
  };
}

// function getStatuses<T>(status: Status, data?: T, error?: any) {
//   const statuses = {
//     [Status.INITIAL]: getStatus(false, false, false, false),
//     [Status.LOADING]: getStatus(false, false, true, false),
//     [Status.SUCCESS]: getStatus("success", false, false, true, false),
//     [Status.ERROR]: getStatus("error", false, false, false, true),
//   };

//   return {
//     ...statuses[status],
//     data,
//     error,
//   };
// }

function getStatus(
  hasData: boolean,
  hasError: boolean,
  isLoading: boolean,
  isRefreshing: boolean
) {
  return { hasData, hasError, isLoading, isRefreshing };
}
