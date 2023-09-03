import { Signal, createSignal, execute } from "./core";
import { createCollection } from "./create-collection";
import { createDependenciesTracker } from "./create-dependencies-tracker";
import createState from "./create-state";

export function createComputed<S extends (...args: any) => any>(selector: S) {
  type P = Parameters<S>;
  type R = ReturnType<S>;

  const collection = createCollection((...params: P) =>
    createComputedSingle<R>(() => selector(...(params as any)))
  );

  return {
    get(...params: P): R {
      return collection.get(...params).get();
    },
  };
}

function createComputedSingle<R>(selector: () => R) {
  const dependencies = createDependenciesTracker();
  const cache = createState({ value: null as R, version: 0 });
  const state = { isSubscribed: false, hasAnyDependencyChanged: false };

  function updateCache() {
    if (state.isSubscribed && !state.hasAnyDependencyChanged) {
      return;
    }

    if (!state.isSubscribed && !dependencies.hasChanged()) {
      return;
    }

    const { value, signals } = execute(selector);

    dependencies.update(signals);

    if (state.isSubscribed) {
      dependencies.subscribe(onDependencyUpdated);
    }

    cache.set({ value, version: cache.get().version + 1 });
    state.hasAnyDependencyChanged = false;
  }

  function onDependencyUpdated() {
    state.hasAnyDependencyChanged = true;
    signal.notify();
  }

  const signal = createSignal({
    onSubscribe() {
      state.isSubscribed = true;

      if (dependencies.hasChanged()) {
        const { value, signals } = execute(selector);
        dependencies.update(signals);
        cache.set({ value, version: cache.get().version + 1 });
      }

      dependencies.subscribe(onDependencyUpdated);
      state.hasAnyDependencyChanged = false;

      return () => {
        state.isSubscribed = false;
        dependencies.unsubscribe();
      };
    },
    getVersion() {
      updateCache();
      return cache.get().version;
    },
  });

  // @ts-ignore - used for testing
  signal.isDependencies = true;

  return {
    get(): R {
      execute.current.register(signal);
      updateCache();
      return cache.get().value;
    },
  };
}
