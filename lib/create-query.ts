import { createExternalState, compute } from "./core";
import { createCollection } from "./create-collection";
import { createState } from "./create-state";

enum Status {
  IDLE = "idle",
  LOADING = "loading",
  ERROR = "error",
  SUCCESS = "success",
}

type State<T> = {
  isSuccess: boolean;
  isIdle: boolean;
  isError: boolean;
  isLoading: boolean;
  status: "idle" | "loading" | "error" | "success";
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
  let currentState: State<R> = getStatuses<R>(Status.IDLE);

  const state = createExternalState(
    function get() {
      return currentState;
    },
    function onSubscribe() {
      setTimeout(() => fetch(), 0);
      return () => null;
    }
  );

  function fetch() {
    const value = factory();
    currentPromise = value;
    const current = currentState;

    currentState = getStatuses(Status.LOADING, current.data, current.error);
    state.notify();

    value.then(
      (data: any) => {
        if (value === currentPromise) {
          currentState = getStatuses(Status.SUCCESS, data);
          state.notify();
        }
      },
      (error: any) => {
        if (value === currentPromise) {
          currentState = getStatuses(Status.ERROR, undefined, error);
          state.notify();
        }
      }
    );
    return value;
  }

  return {
    get: state.get,
    fetch,
  };
}

function getStatuses<T>(status: Status, data?: T, error?: any) {
  const statuses = {
    [Status.IDLE]: getStatus("idle", true, false, false, false),
    [Status.LOADING]: getStatus("loading", false, true, false, false),
    [Status.SUCCESS]: getStatus("success", false, false, true, false),
    [Status.ERROR]: getStatus("error", false, false, false, true),
  };

  return {
    ...statuses[status],
    data,
    error,
  };
}

function getStatus(
  status: any,
  isIdle: boolean,
  isLoading: boolean,
  isSuccess: boolean,
  isError: boolean
) {
  return { status, isIdle, isLoading, isSuccess, isError };
}
