import { createSignal, execute } from "./core";
import { createCollection } from "./create-collection";
import createState from "./create-state";

type State<T> = {
  isSuccess: boolean;
  isIdle: boolean;
  isError: boolean;
  isLoading: boolean;
  status: "loading" | "idle" | "error" | "success";
  data?: T;
  error?: any;
};

export function createQuery<S extends (...args: any) => any>(factory: S) {
  type P = Parameters<S>;
  type R = ReturnType<S> extends Promise<infer A> ? A : never;

  const collection = createCollection((...params: P) =>
    createQuerySingle<R>(() => factory(...(params as any)))
  );

  return {
    get(...params: Parameters<typeof factory>) {
      return collection.get(...(params as any)).get();
    },
    update(...params: Parameters<typeof factory>) {
      return collection.get(...(params as any)).update();
    },
    getAll() {
      return collection.getAll();
    },
  };
}

function createQuerySingle<R>(factory: () => Promise<R>) {
  let currentPromise: any = null;
  const state = createState<State<R>>({
    status: "idle",
    isError: false,
    isLoading: false,
    isSuccess: false,
    isIdle: true,
  });

  const signal = createSignal({
    onSubscribe: () => void update(),
  });

  function update() {
    const value = factory();
    currentPromise = value;

    state.set({
      ...state.get(),
      isLoading: true,
    });

    value.then(
      (data: any) => {
        if (value === currentPromise) {
          state.set({
            status: "success",
            data,
            isSuccess: true,
            isError: false,
            isIdle: false,
            isLoading: false,
          });
        }
      },
      (error: any) => {
        if (value === currentPromise) {
          state.set({
            status: "error",
            error,
            isSuccess: false,
            isError: true,
            isIdle: false,
            isLoading: false,
          });
        }
      }
    );
    return value;
  }

  return {
    get() {
      execute.current.register(signal);
      return state.get();
    },
    update,
  };
}
