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
    createQuerySingle<R>(() => factory(...(params as any)), factory)
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

function createQuerySingle<R>(factory: () => Promise<R>, originalFactory: any) {
  let currentPromise: any = null;
  const state = createState<State<R>>({ status: "pending" });

  const signal = createSignal({
    onSubscribe: () => void update(),
  });

  function update() {
    const { value, signals } = execute(factory);

    if (signals.size > 0) {
      console.warn(
        "You have used signals in createQuery factory function. This will lead to bugs.",
        originalFactory
      );
    }

    currentPromise = value;
    value.then(
      (data: any) => {
        if (value === currentPromise) {
          state.set({ status: "success", data });
        }
      },
      (error: any) => {
        if (value === currentPromise) {
          state.set({ status: "error", error });
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
