import {
  useActions,
  useData,
  useStaleWhileRevalidate,
} from "../lib/use-selector";

import store from "./store";

export default function () {
  const page = useData(() => store.couter.get());
  const setPage = useActions(() => store.couter.set);

  if (page === undefined) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <SearchInput />
      <button onClick={() => setPage(page - 1)}>-1</button>
      {page}
      <button onClick={() => setPage(page + 1)}>+1</button>
      <Dogs page={page} />
    </div>
  );
}

function SearchInput() {
  const text = useData(() => store.text.get() ?? "");
  const setText = useActions(() => store.text.set);
  const textLength = useData(() => store.textLength.get());

  return (
    <div>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <span>{textLength}</span>
    </div>
  );
}

function Dogs(props: { page: number }) {
  const breeds = useData(() => store.getBreedList());
  const refreshAll = useActions(() => store.updateAllBreeds);

  if (!breeds.isSuccess) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <button onClick={() => refreshAll(props.page)}>Refresh all</button>
      <ul>
        {breeds.data?.map((name) => (
          <Breed breed={name} page={props.page} key={name} />
        ))}
      </ul>
    </div>
  );
}

function Breed(props: { breed: string; page: number }) {
  const refresh = useActions(() => store.updateSingleBreed);
  const image = useData(() => store.getBreedImage(props.breed, props.page));
  const imageData = useStaleWhileRevalidate(image.data, image.isSuccess);

  return (
    <li style={{ marginBottom: 10 }}>
      {props.breed}

      <button onClick={() => refresh(props.breed, props.page)}>Refresh</button>
      <br />
      {imageData ? <img src={imageData.img} height={80} /> : null}
      {imageData?.page}
      {image.isLoading && "Loading..."}
      {image.isError && <span style={{ color: "red" }}>ERROR!</span>}
    </li>
  );
}
