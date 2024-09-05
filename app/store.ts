import { activeState, activeComputed, activeQuery } from "../lib";

type ToDoItem = { id: number; name: string; isDone: boolean };

function createTodoApp() {
  const newItem = activeState("");
  const items = activeState<ToDoItem[]>([]);

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

  const count = activeComputed((value: number) => items.get().length + value);

  const breedList = activeQuery(async () => {
    await new Promise((x) => setTimeout(x, 500));
    const x_1 = await fetch("https://dog.ceo/api/breeds/list/all");
    const data = await x_1.json();
    return Object.keys(data.message).filter((_, i) => i > -1) as string[];
  });

  const breedUpperCase = activeComputed(() => {
    const breeds = breedList.get();
    return breeds.map((item) => item.toUpperCase());
  });

  return {
    newItem,
    items,
    count,
    breedList,
    breedUpperCase,
    addItem,
    removeItem,
    toggleItem,
  };
}

const store = createTodoApp();
export default store;
