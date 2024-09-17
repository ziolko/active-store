Active Store is a new state library for React that heavily utilizes the React Suspense API.

## Quick start

To get started install the npm package with `npm i active-store`. You can then create a store as shown below:

```typescript
import { createContext, useContext } from "react";
import { activeState, activeQuery, activeComputed } from "active-store";

function activeAppStore() {
  // activeState is the simplest building block of active store.
  // It keeps a piece of state and updates UI when the state changes
  // You can later access run:
  // - userLogin.get() to get the current value of the active state
  // - userLogin.set("new-value") to change the value stored in states
  const userLogin = activeState("ziolko");

  // activeQuery is like useQuery in react-query - it fetches data
  // for every unique set of arguments. In the case below there's only
  // one argument called - login.
  const githubProfile = activeQuery(
    (
      login: string
    ): Promise<{
      id: number;
      login: string;
      avatar_url: string;
      name: string;
    }> =>
      fetch(`https://api.github.com/users/${encodeURIComponent(login)}`).then(
        (x) => x.json()
      )
  );

  // activeComputed allows to get a computed value based on
  // activeState and activeQuery. It uses React Suspense api to wait
  // for activeQuery to resolve
  const profile = activeComputed(() => {
    // get currently selected github login. You will see a lot of `.get()`
    // in the databases using active-store
    const login = userLogin.get();

    // start fetching data from activeQuery for currently
    // selected github login. The line below will suspend until
    // github profile finishes loading.
    // There's no need for special handling of the async loading state.
    return githubProfile.get(login);
  });

  // Of course you can combine computed values in activeComputed, too
  const userName = activeComputed(() => profile.get().name);

  return {
    userLogin,
    profile,
    userName,
  };
}

const store = activeAppStore(); // Create an instance of the store

// Define a helper hook 'useStore' to get an instance
// of the store in your components
const storeContext = createContext<ReturnType<typeof activeAppStore>>(store);
export const useStore = () => useContext(storeContext);
```

You are now all set to use the store in your app:

```typescript
import "./App.css";
import { useStore } from "./store";
import { useActive, ActiveBoundary } from "active-store";

export default function App() {
  return (
    <div>
      <CurrentUserPicker />
      {/*  
        Active boundary wraps a section of the app that loads and fails
        together 
        - fallback is used while data required to load child components
      is loading. 
        - errorFallback is used when any of the data fails to load
      with an exception
      */}
      <ActiveBoundary
        fallback="Loading..."
        errorFallback="There was an error while loading the data :("
      >
        <GithubProfile />
      </ActiveBoundary>
    </div>
  );
}

function CurrentUserPicker() {
  const store = useStore();
  const currentLogin = useActive(store.userLogin);
  const options = ["stephencelis", "lidel", "arogozhnikov", "ziolko"];
  return (
    <>
      {options.map((login) => (
        <button
          key={login}
          onClick={() => store.userLogin.set(login)}
          style={{ background: currentLogin === login ? "red" : "transparent" }}
        >
          {login}
        </button>
      ))}
    </>
  );
}

function GithubProfile() {
  const store = useStore();

  // React will suspend until the data is loaded
  const profile = useActive(store.profile);

  // React will suspend until the data is loaded
  const name = useActive(store.userName);

  return (
    <div>
      {name} <img src={profile.avatar_url} width={80} />
    </div>
  );
}
```

## Examples

- [Simple HackerNews client](https://codesandbox.io/p/sandbox/headless-resonance-dfzgzw?file=%2Fsrc%2Fstore.ts)
- [Simple store for a feedback form with a single input](https://github.com/roombelt/timeline/blob/main/src/store/feedback.ts)
- [An example of a splitting a big store into several smaller stores](https://github.com/roombelt/timeline/blob/main/src/store/index.ts)
- [Custom utility activeDeferred acting like useDeferredValue](https://stackblitz.com/edit/vitejs-vite-f9y5fn?file=src%2FApp.tsx)

## Reference

### activeState

The simplest building block of the app state. It's like the `useState` hook.

```typescript
const state = activeState<T>(initialState: T);

// Returns the current value of the state
state.get();

// Sets new value for the state. Trigers re-renders of
// components that depend on it. Triggers invalidation
// on activeComputed that depend on it.
state.set(newValue: T);

// Manually subscribes to changes in the state.
// Takes a listener as a parameter. Returns unsubscribe function.
state.subscribe(listener: (dependency: Dependency) => any) => () => void;
```

### activeQuery

This is heavily based on React Query, so if you are familiar with this library you will feel like home.

```typescript
// Create a query with a factor function returning promise.
// Example: https://stackblitz.com/edit/vitejs-vite-mosens?file=src%2Fstore.ts
// Important: The query re-fetches based only on the provided parameters.
// If you use e.g. activeState in the factory function, updating it's state
// won't trigger a re-fetch.
const query = activeQuery(factory: (...args: P) => Promise<R>);

// If the query for "hello" "world" has already resolved, returns the value.
// If it rejected it throws the rejection reason as an exception
// If query is pending, it throws a React Suspense error that
// suspenses rendering React components and activeComputed
// (more on this below).
query.get("hello", "world");

// Returns the current state of the query. The returned state
// has the following fields that are very similar to react-query
// - status: "pending" | "success" | "error";
// - isPending: boolean;
// - isSuccess: boolean;
// - isError: boolean;
// - isRefetching: boolean;
// - isFetching: boolean;
// - isStale: boolean;
// - data?: R;
// - error?: any;
// - dataUpdatedAt?: number;
// - errorUpdatedAt?: number;
// - fetchStatus: "fetching" | "paused" | "idle";
query.state("hello", "world");

// Returns a promise for query for given parameters
query.getAsync("hello" ,"world");

// Invalidate query for given parameters - will mark data as stale
// and refetch if any component uses the query (either directly, or
// through activeComputed)
query.invalidateOne("hello", "world");

// Invalidate query for all entries for which selector returns true.
// This marks data as stale and refetch queries used in any visible
// React component (either directly or through activeComputed)
// Options:
// - reset (default false) - reset the query to the initial state
//                           (idle, with no data or error)
query.invalidate(
  selector: (...args: P) => boolean,
  options?: { reset?: boolean }
);
```

### activeComputed

Creates a computed state based on any other active state. If any React component is subscribed to it, it
recomputes automatically whenever any of its dependency changes.

```typescript
// The provided factory function must not be async
// (or return a Promise) - TypeScript will complain when this happens.
// You can use any combination of activeState, activeQuery, or
// activeComputed inside.
const computed = activeComputed(factory: (...args: P) => R);

// As active computed can depend on active query, it has to
// follow its async semantics:
// - If the computed for "hello" "world" has already resolved,
//   returns the value.
// - If it rejected it throws the rejection reason
//   as an exception
// - If it's pending, it throws a React Suspense error that
//   suspends rendering React components and activeComputed
//   that depend on it (more on this below).
computed.get("hello", "world");

// Returns a promise for computed for given parameters
computed.getAsync("hello", "world");


// Returns the current state of the computed value.
// The returned state has the following fields:
// - status: "pending" | "success" | "error";
// - data?
// - error?
computed.state("hello", "world");
```

### useActive

It's like `useSelector` from Redux. It connects your components with store.

```typescript
// Subscribes to the value of the activeComputed property.
// Every time the value changes, component is re-rendered.
const value = useActive(() => store.computed.get(userId));

// If `get` doesn't take any parameters, you can just pass
// a reference to the getter:
const value = useActive(store.currentUser.get);

// For convenience you can skip the `.get` part and
// `useActive` will call it automatically:
const value = useActive(store.currentUser);
```

### ActiveBoundary

Active boundary wraps a section of the app that loads and fails together.
It's basically `<Suspense>` and React error boundary in a single component.

- fallback is used while data required to load child components is loading.
- errorFallback is used when any of the data fails to load with an exception

You can find an example of using it in the "Quick start" section.

## How does suspending activeQuery and activeComputed work

This library uses the [React Suspense API](https://react.dev/reference/react/Suspense) for handling loading state.
Under the hood it (ab)uses exceptions.

When `activeComputed` tries to get value of an active query (e.g. `user.get('mateusz')`) that is
currently in a pending state, an special kind of exception is thrown. The trick is that the
exception is _also_ a Promise.

When the promise resolves, React re-renders the component so `activeComputed` recomputes the value and this time
the query is already resolved so it successfully computes the value.

## Low level primitives

### activeExternalState

This is the basic primitive of the libray, i.e. every other function
described here uses `activeExternalState` under the hood.

Ideally, this should be used only by libraries providing higher level primitives.

```typescript
const state = activeExternalState(
  // the "get" method should return the current value of some external state
  get() {
    return _current_value_of_some_external_state_;
  };
  // the onSubscribe method is called when first React component subscribes
  // to the active value either directly or through activeComputed
  onSubscribe(notify) {
    // Here is the code to start observing some value.
    // This might be e.g. current network state, firebase object value, screen width etc.


    // Return a function that is called when last React component unsubscribes
    // from this active value. This is the place to do a cleanup
    return () => console.log("unsubscribed");
  }
)
```

For example, `activeState` is defined as follows:

```typescript
export function activeState<V>(initialValue: V) {
  let value = initialValue;
  const topic = activeExternalState(
    () => value,
    () => () => null
  );
  const result = {
    get: topic.get,
    set(newValue: V) {
      if (!Object.is(newValue, value)) {
        value = newValue;
        topic.notify();
      }
    },
    subscribe: topic.subscribe,
  };
  return result;
}
```

### activeMap

Keeps a reactive collection of items. This is used in e.g. `activeQuery`
and `activeComputed` to create a separate reactive object for each set of parameters.

## License

The project is licensed under the MIT permissive license
