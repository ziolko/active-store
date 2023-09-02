import { createSignal, execute } from "./core";
import { createCollection } from "./create-collection";
import createState from "./create-state";

type State<T> = {
  status: "pending" | "error" | "success";
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
  };
}

function createQuerySingle<R>(factory: () => Promise<R>) {
  let currentPromise: any = null;
  const state = createState<State<R>>({ status: "pending" });

  const signal = createSignal({
    onSubscribe: () => void update(),
  });

  function update() {
    const promise = factory();
    currentPromise = promise;
    promise.then(
      (data: any) => {
        if (promise === currentPromise) {
          state.set({ status: "success", data });
        }
      },
      (error: any) => {
        if (promise === currentPromise) {
          state.set({ status: "error", error });
        }
      }
    );
    return promise;
  }

  return {
    get() {
      execute.current.register(signal);
      return state.get();
    },
    update,
  };
}
