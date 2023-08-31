import { Effect, createDependencySignal, execute } from "./core";
import { createCollection } from "./create-collection";

export function createComputed<S extends (...params: any[]) => any>(
  selector: S
) {
  type T = ReturnType<S>;
  type P = Parameters<S>;

  const collection = createCollection((...params: P) =>
    createComputedSingle(() => selector(...params))
  );

  return {
    get(...params: P): T {
      return collection.get(...params).get();
    },
  };
}

function createComputedSingle<S extends () => unknown>(selector: S) {
  type T = ReturnType<S>;

  const cache: Cache<T> = {
    value: null as any,
    version: NaN,
    nestedDependencies: new Map(),
  };

  const effect = createDependencySignal({
    getVersion: () => state.getVersion(),
    onSubscribe() {
      state = state.onSubscribe();
      let isSubscribed = true;
      return () => {
        if (isSubscribed) {
          isSubscribed = false;
          state = state.onUnsubscribe();
        }
      };
    },
  });

  let state: State<T> = new WithoutSubscribers<T>(
    selector as any,
    0,
    effect.notify,
    cache
  );

  return {
    get(): T {
      execute.current.register(effect);
      return state.getValue();
    },
  };
}

interface State<T> {
  getValue(): T;
  getVersion(): number;
  onSubscribe(): State<T>;
  onUnsubscribe(): State<T>;
}

interface Cache<T> {
  nestedDependencies: Map<Effect, EffectDescription>;
  value: T;
  version: number;
}

export interface EffectDescription {
  unsubscribe?: () => void;
  version?: number;
}

class WithoutSubscribers<T> implements State<T> {
  constructor(
    private selector: () => T,
    private currentVersion: number,
    private onChange: () => void,
    private cached: Cache<T>
  ) {}
  getValue() {
    if (
      this.cached.version > 0 &&
      !hasAnyDependencyChanged(
        this.cached.nestedDependencies,
        new Set(this.cached.nestedDependencies.keys())
      )
    ) {
      return this.cached.value;
    }

    const { value, effects } = execute(this.selector);

    updateCachedEffects(this.cached.nestedDependencies, effects);

    if (!Object.is(value, this.cached.value)) {
      this.currentVersion += 1;
      this.cached.value = value;
    }

    this.cached.version = this.currentVersion;

    return value;
  }
  getVersion() {
    for (const [effect, cache] of this.cached.nestedDependencies) {
      if (effect.getVersion?.() !== cache.version) {
        return this.currentVersion + 1 || 0;
      }
    }

    return this.currentVersion;
  }
  onSubscribe() {
    return new WithSubscribers(
      this.selector,
      this.currentVersion,
      this.onChange,
      this.cached
    );
  }
  onUnsubscribe(): State<T> {
    throw new Error("Not expected to run this 'onUnsubscribe' on this class");
  }
}

class WithSubscribers<T> implements State<T> {
  private subscriptionsCount = 0;

  constructor(
    private selector: () => T,
    private currentVersion: number,
    private onChange: () => void,
    private cached: Cache<T>
  ) {
    this.subscriptionsCount = 1;
    cached.version = NaN;
    this.getValue();
  }
  getValue() {
    // Is subscribed and no dependency changed - return cached value
    if (this.currentVersion === this.cached.version) {
      return this.cached.value;
    }
    // If all dependencies are in cached version - return cached value
    if (
      this.cached.version > 0 &&
      !hasAnyDependencyChanged(
        this.cached.nestedDependencies,
        new Set(this.cached.nestedDependencies.keys())
      )
    ) {
      return this.cached.value;
    }

    const { value, effects } = execute(this.selector);

    updateCachedEffects(
      this.cached.nestedDependencies,
      effects,
      this.onDependencyChanged
    );

    if (!Object.is(value, this.cached.value)) {
      this.cached.value = value;
    }

    this.cached.version = this.currentVersion;
    return this.cached.value;
  }
  getVersion() {
    return this.currentVersion;
  }
  onSubscribe(): State<T> {
    this.subscriptionsCount += 1;
    return this;
  }
  onUnsubscribe(): State<T> {
    this.subscriptionsCount -= 1;

    if (this.subscriptionsCount === 0) {
      for (const effect of this.cached.nestedDependencies.values()) {
        effect.unsubscribe?.();
        effect.unsubscribe = undefined;
      }
      return new WithoutSubscribers(
        this.selector,
        this.currentVersion,
        this.onChange,
        this.cached
      );
    }

    return this;
  }
  onDependencyChanged = () => {
    this.currentVersion += 1;
    this.onChange();
  };
}

export function updateCachedEffects(
  cachedEffects: Map<Effect, EffectDescription>,
  newEffects: Set<Effect>,
  onDependencyChanged?: () => void
) {
  // Search for existing and new effects
  for (const effect of newEffects) {
    let cached = cachedEffects.get(effect);
    if (!cached) {
      cached = {};
      cachedEffects.set(effect, cached);
    }

    cached.version = effect.getVersion?.();

    if (onDependencyChanged && !cached.unsubscribe) {
      cached.unsubscribe = effect.subscribe(onDependencyChanged);
    }
  }

  // Search for effects that are no longer there
  for (const [key, value] of cachedEffects) {
    if (!cachedEffects.has(key)) {
      if (value.unsubscribe && !onDependencyChanged) {
        throw new Error("Unexpected to have unsubscribe here");
      }
      value.unsubscribe?.();
      cachedEffects.delete(key);
    }
  }
}

function hasAnyDependencyChanged(
  cachedEffects: Map<Effect, EffectDescription>,
  newEffects: Set<Effect>
) {
  if (cachedEffects.size !== newEffects.size) {
    return true;
  }

  for (const effect of newEffects) {
    if (cachedEffects.get(effect)?.version !== effect.getVersion?.()) {
      return true;
    }
  }

  return false;
}
