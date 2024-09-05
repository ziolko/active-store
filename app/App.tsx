import { Suspense, useState } from "react";

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
  const breeds = useActive(() => store.breedUpperCase.state());

  return (
    <div>
      <div>
        Hello world{" "}
        {breeds.data?.map((name) => (
          <div key={name}>{name}</div>
        ))}
      </div>
    </div>
  );
}
