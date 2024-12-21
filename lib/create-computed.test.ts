import { expect, describe, it, jest } from "@jest/globals";
import { activeState } from "./create-state";
import { activeComputed } from "./create-computed";
import { activeTopic, compute, getActive } from "./core";
import { activeAsync } from "./create-query";

describe("createComputed", () => {
  jest.useFakeTimers();

  it("Returns computed value", () => {
    const { computed } = createTestContext();
    expect(computed.get().text).toEqual("Hello World");
  });

  it("Updates returned value when one of dependencies changes", () => {
    const { world, computed } = createTestContext();

    world.set("DEMO");
    expect(computed.get().text).toBe("Hello DEMO");
  });

  it("Doesn't recompute value with each 'get' if there's no active subscription", () => {
    const { computed, topic } = createTestContext();
    const version = topic.get!();

    const result1 = computed.get();
    const result2 = computed.get();

    expect(result1).toBe(result2);
    expect(topic.get()).toBe(version);
  });

  it("Returns different results for different keys", () => {
    const computed = activeComputed((value: number) => ({ value }));

    expect(computed.get(1)).toEqual({ value: 1 });
    expect(computed.get(2)).toEqual({ value: 2 });
  });

  it("Subscribes to effects of nested dependencies", () => {
    const {
      topic,
      computed,
      onNestedDependencySubscribed,
      onNestedDependencyUnsubscribed,
    } = createTestContext();

    computed.get();

    const unsubscribe1 = topic.subscribe(() => null);
    const unsubscribe2 = topic.subscribe(() => null);

    expect(onNestedDependencySubscribed).toBeCalledTimes(1);
    expect(onNestedDependencyUnsubscribed).toBeCalledTimes(0);

    unsubscribe1();
    expect(onNestedDependencySubscribed).toBeCalledTimes(1);
    expect(onNestedDependencyUnsubscribed).toBeCalledTimes(0);

    unsubscribe2();
    expect(onNestedDependencySubscribed).toBeCalledTimes(1);
    expect(onNestedDependencyUnsubscribed).toBeCalledTimes(1);
  });

  it("Doesn't recompute value with each 'get' if there's an active subscription", () => {
    const { computed, topic } = createTestContext();

    topic.subscribe(() => null);

    const version = topic.get();

    const result1 = computed.get();
    const result2 = computed.get();

    expect(result1).toBe(result2);
    expect(version).toBe(topic.get());
  });

  it("Notifies about changes in one of dependencies if there's active subscription", () => {
    const { world, topic } = createTestContext();
    const listener = jest.fn();

    topic.subscribe(listener);

    expect(listener).toHaveBeenCalledTimes(0);

    world.set("DEMO 1");
    expect(topic.get()).toEqual({ text: "Hello DEMO 1" });
    expect(listener).toHaveBeenCalledTimes(1);

    world.set("DEMO 2");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(topic.get()).toEqual({ text: "Hello DEMO 2" });
  });

  it("computed.promise waits until query resolves", async () => {
    const query = activeAsync(
      () =>
        new Promise((resolve) => setTimeout(() => resolve("Hello world"), 2000))
    );
    const computed = activeComputed(() => query.get());
    const promise = getActive(computed);
    await jest.advanceTimersByTimeAsync(5000);
    expect(await promise).toBe("Hello world");
  });

  it("computed.promise runs queries sequentially", async () => {
    const helloMock = jest.fn(
      () => new Promise((res) => setTimeout(() => res("Hello"), 2000))
    );
    const worldMock = jest.fn(
      () => new Promise((res) => setTimeout(() => res("world"), 2000))
    );

    const helloQuery = activeAsync(helloMock);
    const worldQuery = activeAsync(worldMock);

    const computed = activeComputed(
      () => `${helloQuery.get()} ${worldQuery.get()}`
    );

    expect(helloMock).not.toBeCalled();
    expect(worldMock).not.toBeCalled();

    const promise = getActive(computed);

    expect(helloMock).toBeCalled();
    expect(worldMock).not.toBeCalled();

    await jest.advanceTimersByTimeAsync(3000);

    expect(helloMock).toBeCalled();
    expect(worldMock).toBeCalled();

    await jest.advanceTimersByTimeAsync(3000);
    expect(await promise).toBe("Hello world");
  });

  it("computed.promise runs queries in parallel when prefetched with query.state", async () => {
    const helloMock = jest.fn(
      () => new Promise((res) => setTimeout(() => res("Hello"), 2000))
    );
    const worldMock = jest.fn(
      () => new Promise((res) => setTimeout(() => res("world"), 2000))
    );

    const helloQuery = activeAsync(helloMock);
    const worldQuery = activeAsync(worldMock);

    const computed = activeComputed(() => {
      [helloQuery.state(), worldQuery.state()]; // prefetch
      return `${helloQuery.get()} ${worldQuery.get()}`;
    });

    expect(helloMock).not.toBeCalled();
    expect(worldMock).not.toBeCalled();

    const promise = getActive(computed);

    expect(helloMock).toBeCalled();
    expect(worldMock).toBeCalled();

    await jest.advanceTimersByTimeAsync(3000);
    expect(await promise).toBe("Hello world");
  });
});

function createTestContext() {
  const hello = activeState("Hello");
  const world = activeState("World");
  const onNestedDependencyUnsubscribed = jest.fn(() => null);
  const onNestedDependencySubscribed = jest.fn(
    () => onNestedDependencyUnsubscribed
  );
  const nestedDependency = activeTopic(() => 0, onNestedDependencySubscribed);
  const computed = activeComputed(() => {
    nestedDependency.get();
    return { text: `${hello.get()} ${world.get()}` };
  });

  const { dependencies: topics } = compute(() => computed.get());

  expect(topics.size).toEqual(2);
  const iterator = topics.values();
  iterator.next(); // skip the activeMap topic
  const topic = iterator.next().value!;

  return {
    hello,
    world,
    computed,
    topic,
    onNestedDependencySubscribed,
    onNestedDependencyUnsubscribed,
  };
}
