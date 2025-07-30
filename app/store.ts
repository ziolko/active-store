import {
  state,
  computed,
  query,
  Computed,
  Query,
} from "../lib";
import { activeMap } from "../lib/create-collection";

type ToDoItem = { id: number; name: string; isDone: boolean };

function createTodoApp() {
  const newItem = state("");
  const items = state<ToDoItem[]>([]);

  const time = query(
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

  const count = computed((value: number) => items.get().length + value);

  const breedList = query(async () => {
    await new Promise((x) => setTimeout(x, 500));
    const x_1 = await fetch("https://dog.ceo/api/breeds/list/all");
    const data = await x_1.json();
    return Object.keys(data.message).filter((_, i) => i > -1) as string[];
  });

  const breedUpperCase = computed(() => {
    const breeds = breedList.get();
    return breeds.map((item) => item.toUpperCase());
  });

  const testQuery = query(
    (name: string) =>
      new Promise<string>((res) => {
        console.log("Refetch", name);
        return setTimeout(() => res("Name: " + name), 3000);
      })
  );

  attacheRefetchOnTabVisible(testQuery);

  const optimisticQuery = activeLocalState(testQuery);

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

function attacheRefetchOnTabVisible<S extends Query<any>>(source: S) {
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      source.invalidate(() => true);
    }
  });
}

function activeLocalState<S extends Query<any> | Computed<any>>(
  source: S
) {
  const localValueMap = activeMap({
    createItem: (...params: Parameters<S["get"]>) =>
      null as { value: ReturnType<S["get"]>; id: number } | null,
  });

  let lastLocalValueId = 0;
  return {
    ...computed(
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
