import { activeExternalState, compute, State } from "./core";
import { activeCollection } from "./create-collection";
import { createDependenciesTracker } from "./create-dependencies-tracker";

export interface ActiveComputed<S extends (...args: any) => any> {
  get: (...params: Parameters<S>) => ReturnType<S>;
  state: (...params: Parameters<S>) => State<ReturnType<S>>;
}

export function activeComputed<S extends (...args: any) => any>(selector: S) {
  type P = Parameters<S>;
  type R = ReturnType<S>;

  const collection = activeCollection(
    (...params: P) =>
      createComputedSingle<R>(() => selector(...(params as any))),
    { gcTime: Number.POSITIVE_INFINITY }
  );

  const result: ActiveComputed<S> = {
    get(...params: P): R {
      return collection.get(...params).get();
    },
    state(...params: P): State<R> {
      try {
        return { status: "success", data: collection.get(...params).get() };
      } catch (error: any) {
        if (error instanceof Promise || typeof error?.then === "function") {
          return { status: "pending" };
        } else {
          return { error, status: "error" };
        }
      }
    },
  };

  return result;
}

function createComputedSingle<R>(selector: () => R) {
  const state = {
    value: undefined as R | undefined,
    error: undefined as any,
    isSubscribed: false,
    hasAnyDependencyChanged: false,
    notifyAboutChanges: null as null | (() => void),
  };

  const dependencies = createDependenciesTracker(() => {
    state.hasAnyDependencyChanged = true;
    state.notifyAboutChanges?.();
  });

  const topic = activeExternalState(
    function get() {
      if (state.isSubscribed && !state.hasAnyDependencyChanged) {
        if (state.error) {
          throw state.error;
        }

        return state.value;
      }

      if (!state.isSubscribed && !dependencies.hasChanged()) {
        if (state.error) {
          throw state.error;
        }

        return state.value;
      }

      const { value, error, dependencies: topics } = compute(selector);

      dependencies.update(topics);
      state.hasAnyDependencyChanged = false;
      state.value = value;
      state.error = error;

      if (state.isSubscribed) {
        dependencies.subscribe();
      }

      if (state.error) {
        throw state.error;
      }

      return value;
    },
    function onSubscribe(notifyAboutChanges) {
      state.isSubscribed = true;
      state.notifyAboutChanges = notifyAboutChanges;

      if (dependencies.hasChanged()) {
        const { value, error, dependencies: topics } = compute(selector);
        dependencies.update(topics);
        state.value = value;
        state.error = error;
        notifyAboutChanges();
      }

      dependencies.subscribe();
      state.hasAnyDependencyChanged = false;

      return function unsbuscribe() {
        state.isSubscribed = false;
        state.notifyAboutChanges = null;
        dependencies.unsubscribe();
      };
    }
  );

  return { get: () => topic.get() as R, subscribe: topic.subscribe };
}
