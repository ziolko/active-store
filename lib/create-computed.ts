import { Signal, createSignal, execute } from "./core";
import { createCollection } from "./create-collection";

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
  const cache: Cache<R> = {
    value: null as any,
    version: NaN,
    nestedSignals: new Map(),
  };

  const signal = createSignal({
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

  let state: State<R> = new WithoutSubscribers<R>(
    selector as any,
    0,
    signal.notify,
    cache
  );

  return {
    get(): R {
      execute.current.register(signal);
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
  nestedSignals: Map<Signal, SignalDescription>;
  value: T;
  version: number;
}

export interface SignalDescription {
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
        this.cached.nestedSignals,
        new Set(this.cached.nestedSignals.keys())
      )
    ) {
      return this.cached.value;
    }

    const { value, signals: effects } = execute(this.selector);

    updateCachedDependencies(this.cached.nestedSignals, effects);

    if (!Object.is(value, this.cached.value)) {
      this.currentVersion += 1;
      this.cached.value = value;
    }

    this.cached.version = this.currentVersion;

    return value;
  }
  getVersion() {
    for (const [effect, cache] of this.cached.nestedSignals) {
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
  constructor(
    private selector: () => T,
    private currentVersion: number,
    private onChange: () => void,
    private cached: Cache<T>
  ) {
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
        this.cached.nestedSignals,
        new Set(this.cached.nestedSignals.keys())
      )
    ) {
      return this.cached.value;
    }

    const { value, signals: effects } = execute(this.selector);

    updateCachedDependencies(
      this.cached.nestedSignals,
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
    throw new Error("Not expected to run this 'onSubscribe' on this class");
  }
  onUnsubscribe(): State<T> {
    for (const effect of this.cached.nestedSignals.values()) {
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
  onDependencyChanged = () => {
    this.currentVersion += 1;
    this.onChange();
  };
}

export function updateCachedDependencies(
  cachedSignals: Map<Signal, SignalDescription>,
  newSignals: Set<Signal>,
  onDependencyChanged?: () => void
) {
  // Search for existing and new signals
  for (const signal of newSignals) {
    let cached = cachedSignals.get(signal);
    if (!cached) {
      cached = {};
      cachedSignals.set(signal, cached);
    }

    cached.version = signal.getVersion?.();

    if (onDependencyChanged && !cached.unsubscribe) {
      cached.unsubscribe = signal.subscribe(onDependencyChanged);
    }
  }

  // Search for effects that are no longer there
  for (const [key, value] of cachedSignals) {
    if (!cachedSignals.has(key)) {
      if (value.unsubscribe && !onDependencyChanged) {
        throw new Error("Unexpected to have unsubscribe here");
      }
      value.unsubscribe?.();
      cachedSignals.delete(key);
    }
  }
}

function hasAnyDependencyChanged(
  cachedSignals: Map<Signal, SignalDescription>,
  newSignals: Set<Signal>
) {
  if (cachedSignals.size !== newSignals.size) {
    return true;
  }

  for (const signal of newSignals) {
    if (cachedSignals.get(signal)?.version !== signal.getVersion?.()) {
      return true;
    }
  }

  return false;
}
