import store from "./store";
import { useActive, ActiveBoundary, ActiveBoundaryErrorProps } from "../lib";

export default function () {
  return (
    <ActiveBoundary
      fallback="Loading..."
      errorFallback={ErrorHandler}
      onError={(err) => console.log("My error", err)}
    >
      <App />
    </ActiveBoundary>
  );
}

function ErrorHandler(props: ActiveBoundaryErrorProps) {
  return (
    <div>
      Error: {props.error.message}{" "}
      <button
        onClick={() => {
          store.resetBreedList();
          props.resetError();
        }}
      >
        Retry
      </button>
    </div>
  );
}

function App() {
  const optimistic = useActive(() => store.optimisticQuery.get("mateusz"));
  const breed = useActive(store.breedUpperCase);
  const time = useActive(store.time.state);

  return (
    <div>
      <div>
        <div>{optimistic}</div>
        <div>
          TIME: {time.data ?? "Unknown"}
          {time.error ? ` Error: ${time.error as unknown as string} ` : null}
          {time.isStale && " (stale) "}
          {time.isFetching && " (fetching) "}
        </div>
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
      <ol>
        {breed.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ol>
    </div>
  );
}
