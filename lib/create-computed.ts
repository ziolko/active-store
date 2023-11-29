import { createExternalState, compute, Dependency } from "./core";
import { createCollection } from "./create-collection";
import { createDependenciesTracker } from "./create-dependencies-tracker";

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
    item(...params: P) {
      return collection.get(...params);
    },
  };
}

function createComputedSingle<R>(selector: () => R) {
  const state = {
    value: undefined as R,
    isSubscribed: false,
    hasAnyDependencyChanged: false,
    notifyAboutChanges: null as null | (() => void),
  };

  const dependencies = createDependenciesTracker(() => {
    state.hasAnyDependencyChanged = true;
    state.notifyAboutChanges?.();
  });

  const topic = createExternalState(
    function get() {
      if (state.isSubscribed && !state.hasAnyDependencyChanged) {
        return state.value;
      }

      if (!state.isSubscribed && !dependencies.hasChanged()) {
        return state.value;
      }

      const { value, dependencies: topics } = compute(selector);

      dependencies.update(topics);
      state.hasAnyDependencyChanged = false;
      state.value = value;

      if (state.isSubscribed) {
        dependencies.subscribe();
      }

      return value;
    },
    function onSubscribe(notifyAboutChanges) {
      state.isSubscribed = true;
      state.notifyAboutChanges = notifyAboutChanges;

      if (dependencies.hasChanged()) {
        const { value, dependencies: topics } = compute(selector);
        dependencies.update(topics);
        state.value = value;
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
