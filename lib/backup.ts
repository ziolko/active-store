import { Effect, createDependencySignal, execute } from "./core";

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

class WithoutSubscribers<T> implements State<T> {
  constructor(
    private selector: () => T,
    private onChange: () => void,
    private currentVersion: number,
    private cached: Cache<T>
  ) {}
  getValue(): T {
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

    this.currentVersion += 1;

    this.cached.value = value;
    this.cached.version = this.currentVersion;

    return value;
  }
  getVersion() {
    return this.currentVersion;
  }
  onSubscribe(): State<T> {
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
  }
  getValue(): T {
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

    this.cached.value = value;
    this.cached.version = this.currentVersion;

    return this.cached.value;
  }
  getVersion() {
    return this.currentVersion;
  }
  onSubscribe(): State<T> {
    this.subscriptionsCount++;
    return this;
  }
  onUnsubscribe(): State<T> {
    throw new Error("Method not implemented.");
  }
  onDependencyChanged = () => {
    this.currentVersion += 1;
    this.onChange();
  };
}

export function createComputed<T extends () => unknown>(selector: T) {
  const cachedEffects = new Map<Effect, EffectDescription>();
  const cached = {
    value: null as any,
    version: NaN,
  };

  let subscribersCount = 0;
  let version = 0;
  const effect = createDependencySignal({
    getVersion: () => {
      if (subscribersCount > 0) {
        return version;
      }

      for (const [effect, cache] of cachedEffects) {
        if (effect.getVersion?.() !== cache.version) {
          return cached.version + 1 || 0;
        }
      }

      return version;
    },
    onSubscribe() {
      subscribersCount += 1;

      // First subscriber - recompute value and subscribe to all dependencies
      if (subscribersCount === 1) {
        version = 1;
        cached.version = NaN;

        getValueAndUpdateCache();
      }

      let hasAlreadyUnsubscribed = false;
      return function unsubscribe() {
        if (hasAlreadyUnsubscribed) {
          return;
        }

        subscribersCount -= 1;
        // Last subscriber unsubscribed - unsubscribe from dependencies
        if (subscribersCount === 0) {
          for (const effect of cachedEffects.values()) {
            effect.unsubscribe?.();
          }
          cachedEffects.clear();
        }
      };
    },
  });

  function onDependencyChanged() {
    effect.notify();
    version += 1;
  }

  function getValueAndUpdateCache(): ReturnType<T> {
    execute.current.register(effect);

    const hasSubscribers = subscribersCount > 0;

    // Is subscribed and no dependency changed - return cached value
    if (hasSubscribers && version === cached.version) {
      return cached.value;
    }

    // If all dependencies are in cached version - return cached value
    if (
      cached.version > 0 &&
      !hasAnyDependencyChanged(cachedEffects, new Set(cachedEffects.keys()))
    ) {
      return cached.value;
    }

    // Recompute value from scratch
    const { value, effects } = execute(selector);

    updateCachedEffects(
      cachedEffects,
      effects,
      hasSubscribers,
      onDependencyChanged
    );

    // If there are no subscribers and we recompute value we can safely update version
    if (!hasSubscribers) {
      version += 1;
    }

    cached.value = value;
    cached.version = version;
    return value;
  }

  return { get: getValueAndUpdateCache };
}

export type EffectDescription = {
  unsubscribe?: () => void;
  version?: number;
};

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
