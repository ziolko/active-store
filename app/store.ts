import createState from "../lib/create-state";
import { createComputed } from "../lib/create-computed";
import { createQuery } from "../lib/create-query";

type ToDoItem = { id: number; name: string; isDone: boolean };

function createTodoApp() {
  const newItem = createState("");
  const items = createState<ToDoItem[]>([]);

  const addItem = () => {
    items.set([
      ...items.get(),
      { id: Date.now(), name: newItem.get(), isDone: false },
    ]);
    newItem.set("");
  };

  const removeItem = (id: number) => {
    items.set(items.get().filter((x) => x.id !== id));
  };

  const toggleItem = (id: number) => {
    items.set(
      items
        .get()
        .map((item) =>
          item.id === id ? { ...item, isDone: !item.isDone } : item
        )
    );
  };

  const count = createComputed((value: number) => items.get().length + value);

  const breedList = createQuery(() =>
    fetch("https://dog.ceo/api/breeds/list/all")
      .then((x) => x.json())
      .then((data) => Object.keys(data.message))
  );

  const versionedBreedImage = createQuery((breed: string, version: number) =>
    fetch(`https://dog.ceo/api/breed/${breed}/images/random?version=${version}`)
      .then((x) => x.json())
      .then((data) => data.message as string)
  );

  const breedImage = createComputed((breed: string) =>
    versionedBreedImage.get(breed, items.get().length)
  );

  const updateBreedImage = (breed: string) =>
    versionedBreedImage.update(breed, items.get().length);

  return {
    getNewItem: newItem.get,
    setNewItem: newItem.set,
    getItems: items.get,
    getCount: count.get,
    addItem,
    removeItem,
    toggleItem,
    getBreedList: breedList.get,
    getBreedImage: breedImage.get,
    updateBreedImage,
  };
}

const store = createTodoApp();
export default store;
