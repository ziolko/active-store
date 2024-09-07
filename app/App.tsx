import { Suspense } from "react";

import store from "./store";
import { useActive } from "../lib";

export default function () {
  return (
    <Suspense fallback="Loading...">
      <App />
    </Suspense>
  );
}

function App() {
  const optimistic = useActive(() => store.optimisticQuery.get("mateusz"));

  return (
    <div>
      <div>
        <div>{optimistic}</div>
        <input
          value={optimistic}
          onChange={(e) =>
            store.optimisticQuery.local("mateusz").set(e.target.value)
          }
        ></input>
        <button onClick={() => store.optimisticQuery.local("mateusz").clear()}>
          Reset
        </button>
      </div>
    </div>
  );
}
