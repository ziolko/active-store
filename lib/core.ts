export type Effect = {
  getId: () => number;
  subscribe: (listener: (effect: Effect) => any) => () => void;
  notify: () => void;
  getVersion: () => number;
};

let lastEffectId = 0;

type CreateDependencySignalOptions = {
  getVersion?: () => number;
  onSubscribe?: () => () => void;
};

export function createDependencySignal({
  onSubscribe,
  getVersion = () => 0,
}: CreateDependencySignalOptions = {}): Effect {
  let listenerCount = 0;
  const effectId = lastEffectId++;
  const listeners = new Map();
  const result = {
    getId() {
      return effectId;
    },
    notify() {
      for (const entry of listeners) {
        entry[1](result);
      }
    },
    subscribe(listener: (effect: Effect) => void) {
      const id = listenerCount++;
      listeners.set(id, listener);
      const unsubscribe = onSubscribe?.();
      return () => {
        listeners.delete(id);
        unsubscribe?.();
      };
    },
    getVersion: getVersion,
  };
  return result;
}

export function execute<S extends () => unknown>(
  selector: S
): { value: ReturnType<S>; effects: Set<Effect> } {
  const oldEffects = execute.current.effects;

  try {
    const effects = new Set<Effect>();
    execute.current.effects = effects;
    const value = selector();
    execute.current.effects = oldEffects;
    return { value, effects } as any;
  } catch (error) {
    execute.current.effects = oldEffects;
    throw error;
  }
}

execute.current = {
  effects: null as Set<Effect> | null,
  register(effect: Effect) {
    if (effect && execute.current.effects) {
      execute.current.effects.add(effect);
    }
  },
};
