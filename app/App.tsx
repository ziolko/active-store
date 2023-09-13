import { useState } from "react";
import {
  useActions,
  useAsyncAction,
  useData,
  useStaleWhileRevalidate,
} from "../lib/react";

import store from "./store";

export default function () {
  const [page, setPage] = useState(0);

  const data = useData(() => ({
    newItem: store.getNewItem(),
    items: store.getItems(),
    count: store.getCount(page),
  }));

  const actions = useActions(() => ({
    setNewItem: store.setNewItem,
    addItem: store.addItem,
    removeItem: store.removeItem,
    asyncAction: store.asyncAction,
  }));

  return (
    <div>
      <button onClick={() => setPage(page - 1)}>-1</button>
      {page}
      <button onClick={() => setPage(page + 1)}>+1</button>
      <Dogs page={page} />
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
      <button onClick={refreshAll}>Refresh all</button>
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
