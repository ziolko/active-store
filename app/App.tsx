import { useState } from "react";
import { useActions, useData } from "../lib/use-selector";

import store from "./store";

export default function () {
  const [value, setValue] = useState(0);

  const data = useData(() => ({
    newItem: store.getNewItem(),
    items: store.getItems(),
    count: store.getCount(value),
  }));

  const actions = useActions(() => ({
    setNewItem: store.setNewItem,
    addItem: store.addItem,
    removeItem: store.removeItem,
  }));

  return (
    <div>
      <div>
        <button onClick={() => setValue(value - 1)}>-1</button>
        {value}
        <button onClick={() => setValue(value + 1)}>+1</button>
      </div>
      <input
        value={data.newItem}
        onChange={(e) => actions.setNewItem(e.target.value)}
      />
      <button onClick={actions.addItem}>Add</button>
      <div>Items: {data.count}</div>
      {data.items.map((item) => (
        <div key={item.id}>
          {item.name}{" "}
          <button onClick={() => actions.removeItem(item.id)}>x</button>
        </div>
      ))}

      <Dogs />
    </div>
  );
}

function Dogs() {
  const { breeds } = useData(() => ({
    breeds: store.getBreedList(),
  }));

  if (breeds.status !== "success") {
    return <div>Loading...</div>;
  }

  return (
    <ul>
      {breeds.data?.map((name) => (
        <Breed breed={name} key={name} />
      ))}
    </ul>
  );
}

function Breed(props: { breed: string }) {
  const image = useData(() => store.getBreedImage(props.breed));
  const refresh = useActions(() => store.updateBreedImage);

  return (
    <li style={{ marginBottom: 10 }}>
      {props.breed}
      <button onClick={() => refresh(props.breed)}>Refresh</button>
      <br />
      {image.data ? <img src={image.data} height={80} /> : "Loading"}
    </li>
  );
}
