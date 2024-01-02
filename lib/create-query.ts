import { createExternalState } from "./core";
import { createCollection } from "./create-collection";

enum Status {
  INITIAL = "initial",
  LOADING = "loading",
  ERROR = "error",
  SUCCESS = "success",
}

type State<T> = {
  hasData: boolean;
  hasError: boolean;
  isLoadingInitial: boolean;
  isLoadingUpdate: boolean;
  data?: T;
  error?: any;
};

export interface QueryOptions {
  ttl?: number;
}

export function createQuery<S extends (...args: any) => Promise<any>>(
  factory: S,
  options: QueryOptions = {}
) {
  type P = Parameters<S>;
  type R = ReturnType<S> extends Promise<infer A> ? A : never;

  const collection = createCollection(
    (...params: P) =>
      createQuerySingle<R>(() => factory(...(params as any)), options),
    { inertia: options.ttl }
  );

  return {
    get(...params: Parameters<typeof factory>) {
      return collection.get(...(params as any)).get();
    },
    fetch(...params: Parameters<typeof factory>) {
      return collection.get(...(params as any)).fetch();
    },
    item(...params: Parameters<typeof factory>) {
      return collection.get(...(params as any));
    },
    getAll() {
      return collection.getAll();
    },
  };
}

function createQuerySingle<R>(
  factory: () => Promise<R>,
  options: QueryOptions
) {
  let currentPromise: any = null;
  let currentState: State<R> = {
    isLoadingInitial: false,
    isLoadingUpdate: false,
    hasData: false,
    hasError: false,
  };
  let timeoutHandle: number | null = null;

  const state = createExternalState(
    function get() {
      return currentState;
    },
    function onSubscribe() {
      setTimeout(() => fetch(), 0);
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

    const value = factory();
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
