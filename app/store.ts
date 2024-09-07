import {
  activeState,
  activeComputed,
  activeQuery,
  ActiveComputed,
  ActiveQuery,
} from "../lib";
import { activeMap } from "../lib/create-collection";

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

  const query = activeQuery(
    (name: string) =>
      new Promise<string>((res) => setTimeout(() => res("Name: " + name), 3000))
  );

  const optimisticQuery = activeLocalState(query);

  // optimisticQuery.

  // issue.get();
  // const unset = issue.local().set(["test"]);
  // issue.local().clear();
  // unset();

  return {
    newItem,
    items,
    count,
    breedList,
    breedUpperCase,
    addItem,
    removeItem,
    toggleItem,
    optimisticQuery,
  };
}

function activeLocalState<S extends ActiveQuery<any> | ActiveComputed<any>>(
  source: S
) {
  let lastLocalValueId = 0;

  const localValue = activeMap({
    initItem: (...params: Parameters<S["get"]>) =>
      activeState<{ value: ReturnType<S["get"]>; id: number } | null>(null),
  });

  return {
    local: (...params: Parameters<S["get"]>) => ({
      set(value: ReturnType<S["get"]>) {
        const currentId = (lastLocalValueId += 1);
        localValue.getOrInit(...params).set({ value, id: lastLocalValueId });
        return function cancel() {
          if (localValue.getOrInit(...params).get()?.id === currentId) {
            localValue.getOrInit(...params).set(null);
          }
        };
      },
      clear() {
        localValue.getOrInit(...params).set(null);
      },
    }),
    ...activeComputed(
      (...params: Parameters<S["get"]>): ReturnType<S["get"]> => {
        const localState = localValue.getOrInit(...params).get();
        return localState === null ? source.get(...params) : localState.value;
      }
    ),
  };
}

const store = createTodoApp();
export default store;
