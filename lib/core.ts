export type Signal = {
  getId: () => number;
  subscribe: (listener: (effect: Signal) => any) => () => void;
  notify: () => void;
  getVersion: () => number;
};

type CreateSignalOptions = {
  getVersion?: () => number;
  onSubscribe?: () => (() => void) | void;
};

let lastSignalId = 0;

export function createSignal({
  onSubscribe,
  getVersion,
}: CreateSignalOptions = {}): Signal {
  let listenerCount = 0;
  let version = 0;
  let unsubscribe: (() => void) | void;

  const signalId = lastSignalId++;
  const listeners = new Map();

  const result = {
    getId() {
      return signalId;
    },
    notify() {
      version += 1;
      for (const entry of listeners) {
        entry[1](result);
      }
    },
    subscribe(listener: (effect: Signal) => void) {
      const id = listenerCount++;

      if (listeners.size === 0) {
        unsubscribe = onSubscribe?.();
      }

      listeners.set(id, listener);
      let hasUnsubscribed = false;
      return () => {
        if (hasUnsubscribed) {
          return;
        }

        listeners.delete(id);
        hasUnsubscribed = true;

        if (listeners.size === 0 && typeof unsubscribe === "function") {
          unsubscribe?.();
          unsubscribe = undefined;
        }
      };
    },
    getVersion: getVersion ?? (() => version),
  };
  return result;
}

export function execute<R>(selector: () => R): {
  value: R;
  signals: Set<Signal>;
} {
  const previousSignals = execute.current.signals;

  try {
    const signals = new Set<Signal>();
    execute.current.signals = signals;
    const value = selector();
    execute.current.signals = previousSignals;
    return { value, signals } as any;
  } catch (error) {
    execute.current.signals = previousSignals;
    throw error;
  }
}

execute.current = {
  signals: null as Set<Signal> | null,
  register(signal: Signal) {
    if (signal && execute.current.signals) {
      execute.current.signals.add(signal);
    }
  },
};
