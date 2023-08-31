import createState from "../lib/create-state";
import { createComputed } from "../lib/create-computed";

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

  return {
    getNewItem: newItem.get,
    setNewItem: newItem.set,
    getItems: items.get,
    getCount: count.get,
    addItem,
    removeItem,
    toggleItem,
  };
}

const store = createTodoApp();
export default store;
