## Basic building blocks

- createState<T>(initialState: T) : { get, set } - state tracked internally
- createComputed<T>(factory: () => T): { get } - state derived from other state
- createExternalState<T>(get: () => T, onSubscribe: (notify) => () => void): { get, subscribe, notify } - external state, can return current value of the external state and subscribe/unsubscribe from it as needed

- compute<T>(factory: () => T, options?: { trackDependencies?: boolean = true }) : { value : T, dependencies: Set<Dependency> } - compute value of the provided factory function and get list of all dependencies used while executing this function

## Derived

- createCollection
- createQuery
- useSelector
