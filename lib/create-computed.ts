import { createTopic, execute } from "./core";
import { createCollection } from "./create-collection";
import { createDependenciesTracker } from "./create-dependencies-tracker";
import { createState } from "./create-state";

export function createComputed<S extends (...args: any) => any>(selector: S) {
  type P = Parameters<S>;
  type R = ReturnType<S>;

  const collection = createCollection((...params: P) =>
    createComputedSingle<R>(() => selector(...(params as any)))
  );

  return {
    get(...params: P): R {
      return collection.get(...params)();
    },
  };
}

function createComputedSingle<R>(selector: () => R) {
  const dependencies = createDependenciesTracker(onDependencyUpdated);
  const cache = createState({ value: null as R, version: 0 });
  const state = { isSubscribed: false, hasAnyDependencyChanged: false };

  function onDependencyUpdated() {
    state.hasAnyDependencyChanged = true;
    topic.newVersion();
  }

  function updateCache() {
    if (state.isSubscribed && !state.hasAnyDependencyChanged) {
      return;
    }

    if (!state.isSubscribed && !dependencies.hasChanged()) {
      return;
    }

    const { value, topics } = execute(selector);

    dependencies.update(topics);

    if (state.isSubscribed) {
      dependencies.subscribe();
    }

    cache.set({ value, version: cache.get().version + 1 });
    state.hasAnyDependencyChanged = false;
  }

  const topic = createTopic({
    onSubscribe() {
      state.isSubscribed = true;

      if (dependencies.hasChanged()) {
        const { value, topics } = execute(selector);
        dependencies.update(topics);
        cache.set({ value, version: cache.get().version + 1 });
      }

      dependencies.subscribe();
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
  topic.isDependencies = true;

  return (): R => {
    topic.register();
    updateCache();
    return cache.get().value;
  };
}
