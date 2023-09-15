import { createTopic, compute } from "./core";
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
  const state = {
    value: undefined as R,
    isSubscribed: false,
    hasAnyDependencyChanged: false,
  };

  const dependencies = createDependenciesTracker(() => {
    state.hasAnyDependencyChanged = true;
    topic.notify();
  });

  const topic = createTopic({
    onSubscribe() {
      state.isSubscribed = true;

      if (dependencies.hasChanged()) {
        const { value, topics } = compute(selector);
        dependencies.update(topics);
        state.value = value;
        topic.notify();
      }

      dependencies.subscribe();
      state.hasAnyDependencyChanged = false;

      return () => {
        state.isSubscribed = false;
        dependencies.unsubscribe();
      };
    },
    get() {
      if (state.isSubscribed && !state.hasAnyDependencyChanged) {
        return state.value;
      }

      if (!state.isSubscribed && !dependencies.hasChanged()) {
        return state.value;
      }

      const { value, topics } = compute(selector);

      dependencies.update(topics);

      if (state.isSubscribed) {
        dependencies.subscribe();
      }

      state.value = value;
      state.hasAnyDependencyChanged = false;
      return value;
    },
  });

  // @ts-ignore - used for testing
  topic.isDependencies = true;

  return () => topic.get() as R;
}
