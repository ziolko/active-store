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

  const time = activeQuery(
    () => new Promise<number>((res) => setTimeout(() => res(Date.now()), 1000)),
    {
      onSubscribe() {
        const interval = setInterval(
          () =>
            time.setState({
              status: "error",
              error: Date.now(),
              isStale: true,
            }),
          5000
        );
        return () => clearInterval(interval);
      },
    }
  );

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
      new Promise<string>((res) => {
        console.log("Refetch", name);
        return setTimeout(() => res("Name: " + name), 3000);
      })
  );

  attacheRefetchOnTabVisible(query);

  const optimisticQuery = activeLocalState(query);

  return {
    newItem,
    time,
    items,
    count,
    breedList,
    resetBreedList: () => breedList.invalidate(true, { reset: true }),
    breedUpperCase,
    addItem,
    removeItem,
    toggleItem,
    optimisticQuery,
  };
}

function attacheRefetchOnTabVisible<S extends ActiveQuery<any>>(source: S) {
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      source.invalidate(() => true);
    }
  });
}

function activeLocalState<S extends ActiveQuery<any> | ActiveComputed<any>>(
  source: S
) {
  const localValueMap = activeMap({
    createItem: (...params: Parameters<S["get"]>) =>
      null as { value: ReturnType<S["get"]>; id: number } | null,
  });

  let lastLocalValueId = 0;
  return {
    ...activeComputed(
      (...params: Parameters<S["get"]>): ReturnType<S["get"]> => {
        const localState = localValueMap.getOrCreate(...params);
        return localState === null ? source.get(...params) : localState.value;
      }
    ),
    local: (...params: Parameters<S["get"]>) => ({
      set(value: ReturnType<S["get"]>) {
        const currentId = (lastLocalValueId += 1);

        localValueMap.set({ value, id: lastLocalValueId }, ...params);

        return function cancel() {
          if (localValueMap.getOrCreate(...params)?.id === currentId) {
            localValueMap.set(null, ...params);
          }
        };
      },
      clear() {
        localValueMap.set(null, ...params);
      },
    }),
  };
}

const store = createTodoApp();
export default store;
