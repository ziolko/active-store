import { createState, createComputed, createQuery } from "../lib";

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
      .then((data) => Object.keys(data.message).filter((_, i) => i > -1))
  );

  const breedImage = createQuery((breed: string, page: number) =>
    new Promise((x) => setTimeout(x, 500))
      .then(() => fetch(`https://dog.ceo/api/breed/${breed}/images/random`))
      .then((x) => x.json())
      .then((data) => ({ img: data.message as string, page }))
  );

  const updateSingleBreed = (breed: string, page: number) =>
    breedImage.fetch(breed, page);

  const updateAllBreeds = () =>
    breedImage.getAll().forEach((item) => item.fetch());

  async function asyncAction(name: string, age: number) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return `${name} -- ${age}`;
  }

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
    updateSingleBreed,
    updateAllBreeds,
    asyncAction,
  };
}

const store = createTodoApp();
export default store;
