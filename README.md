## Basic building blocks

- activeState<T>(initialState: T) : { get, set } - state tracked internally
- activeQuery<T>(factor: (...params: any[]) => T): { get, state } - async query (e.g. fetch from API)
- activeComputed<T>(factory: (...params: any[]) => T): { get, state } - state derived from other state
- useActive() - subscribe to state from React component

## Secondary

- compute<T>(factory: () => T, options?: { trackDependencies?: boolean = true }) : { value : T, dependencies: Set<Dependency> } - compute value of the provided factory function and get list of all dependencies used while executing this function

- activeExternalState<T>(get: () => T, onSubscribe: (notify) => () => void): { get, subscribe, notify } - external state, can return current value of the external state and subscribe/unsubscribe from it as needed
