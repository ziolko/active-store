import { expect, describe, it, jest } from "@jest/globals";
import { createCollection } from "./create-collection";
import { compute } from "./core";

describe("createCollection", () => {
  jest.useFakeTimers();

  it("Returns the same cached object for the same params", () => {
    const collection = createCollection((id: number) => ({ id }));
    expect(collection(1)).toBe(collection(1));
  });

  it("Returns different cached objects for different params", () => {
    const collection = createCollection((id: number) => ({ id }));
    expect(collection(1)).not.toBe(collection(2));
  });

  it("Returns the sam cached object for the same complex key object", () => {
    const collection = createCollection((id: number, param: any) => ({ id }));

    const param1 = { array: [1, 2, 3], test: { name: 12 } };
    const param2 = { test: { name: 12 }, array: [1, 2, 3] };
    const param3 = { test: { name: 22 }, array: [1, 2, 3] };

    expect(collection(1, param1)).toBe(collection(1, param2));
    expect(collection(1, param1)).not.toBe(collection(1, param3));
  });

  it("Removes entry after inertia timeout", () => {
    const collection = createCollection((id: number) => ({ id }), {
      inertia: 5000,
    });

    const value = collection(1);
    expect(collection(1)).toBe(value);

    jest.advanceTimersByTime(4000);
    expect(collection(1)).toBe(value);

    jest.advanceTimersByTime(2000);
    expect(collection(1)).not.toBe(value);
  });

  it("Doesn't remove entry if somebody is subscribed", () => {
    const collection = createCollection((id: number) => ({ id }), {
      inertia: 5000,
    });

    const value = collection(1);
    expect(collection(1)).toBe(value);

    const { dependencies: topics } = compute(() => collection(1));
    const unsubscribes = [];

    for (const topic of topics) {
      unsubscribes.push(topic.subscribe(() => null));
    }

    jest.advanceTimersByTime(6000);
    expect(collection(1)).toBe(value);

    for (const unsubscribe of unsubscribes) {
      unsubscribe();
    }

    jest.advanceTimersByTime(5001);
    expect(collection(1)).not.toBe(value);
  });
});
