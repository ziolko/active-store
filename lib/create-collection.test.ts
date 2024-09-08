import { expect, describe, it, jest } from "@jest/globals";
import { activeMap } from "./create-collection";
import { compute } from "./core";

describe("createCollection", () => {
  jest.useFakeTimers();

  it("Returns the same cached object for the same params", () => {
    const collection = activeMap({
      createItem: (id: number) => ({ id }),
      gcTime: 1000,
    });
    expect(collection.getOrCreate(1)).toBe(collection.getOrCreate(1));
  });

  it("Returns different cached objects for different params", () => {
    const collection = activeMap({
      createItem: (id: number) => ({ id }),
      gcTime: 1000,
    });
    expect(collection.getOrCreate(1)).not.toBe(collection.getOrCreate(2));
  });

  it("Returns the sam cached object for the same complex key object", () => {
    const collection = activeMap({
      createItem: (id: number, param: any) => ({ id }),
      gcTime: 1000,
    });

    const param1 = { array: [1, 2, 3], test: { name: 12 } };
    const param2 = { test: { name: 12 }, array: [1, 2, 3] };
    const param3 = { test: { name: 22 }, array: [1, 2, 3] };

    expect(collection.getOrCreate(1, param1)).toBe(
      collection.getOrCreate(1, param2)
    );
    expect(collection.getOrCreate(1, param1)).not.toBe(
      collection.getOrCreate(1, param3)
    );
  });

  it("Removes entry after gcTime", () => {
    const collection = activeMap({
      createItem: (id: number) => ({ id }),
      gcTime: 5000,
    });

    const value = collection.getOrCreate(1);
    expect(collection.getOrCreate(1)).toBe(value);

    jest.advanceTimersByTime(4000);
    expect(collection.getOrCreate(1)).toBe(value);

    jest.advanceTimersByTime(2000);
    expect(collection.getOrCreate(1)).not.toBe(value);
  });

  it("Doesn't remove entry if somebody is subscribed", () => {
    const collection = activeMap({
      createItem: (id: number) => ({ id }),
      gcTime: 5000,
    });

    const value = collection.getOrCreate(1);
    expect(collection.getOrCreate(1)).toBe(value);

    const { dependencies: topics } = compute(() => collection.getOrCreate(1));
    const unsubscribes = [];

    for (const topic of topics) {
      unsubscribes.push(topic.subscribe(() => null));
    }

    jest.advanceTimersByTime(6000);
    expect(collection.getOrCreate(1)).toBe(value);

    for (const unsubscribe of unsubscribes) {
      unsubscribe();
    }

    jest.advanceTimersByTime(5001);
    expect(collection.getOrCreate(1)).not.toBe(value);
  });

  it("notifies when entry is set manually", () => {
    const collection = activeMap({
      createItem: (id: number) => ({ id }),
    });

    const { dependencies: topics } = compute(() => collection.getOrCreate(1));
    const onChange = jest.fn(() => null);

    for (const topic of topics) {
      topic.subscribe(onChange);
    }

    collection.set(1).value({ id: -1 });

    expect(onChange).toBeCalledTimes(1);
  });
});
